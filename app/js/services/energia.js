/* ── SERVICES / CONSUMO DE ENERGIA ─────────────────────────────────
   Relaciona IRRIGAÇÃO EXECUTADA (services/horimetro.js) com a ficha
   técnica do conjunto motor-bomba de cada pivô (tabela
   `pivos_potencia_tecnica`, importada de BASE DE DADOS/informações
   pivôs e reservatorios Elavatórias Captacões e Poços.xlsx, aba
   "Infor_Pivos") para estimar a energia elétrica consumida.

   REGRA DE OURO deste serviço: nunca inventar potência/rendimento/vazão.
   Quando o pivô não tem potência cadastrada na planilha de origem, todo
   cálculo retorna `energiaKwh:null` e `origemPotencia:'DADO_NAO_DISPONIVEL'`
   — a tela mostra isso explicitamente, nunca um número estimado sem base.

   Conversão CV→kW: 0.7457 — o MESMO fator já embutido nas fórmulas da
   planilha de origem (conferido: potencia_kw/potencia_cv = 0.7457 em
   toda a amostra de 106 pivôs com dado). Não é o fator "oficial" do CV
   métrico (0.7355) — é reproduzido fielmente da fonte, não corrigido,
   documentado aqui e em scratchpad/schema_energia.sql.

   Histórico: cada lançamento de Horímetro que gera um snapshot em
   `consumo_energia_calculo` (via `energiaRegistrarSnapshot`, chamado
   por js/lanc.js depois de um Horímetro salvo com sucesso — nunca
   dentro de horimetro.js, que não foi tocado) preserva a potência
   USADA NAQUELE MOMENTO. Se o cadastro técnico do pivô mudar depois,
   os snapshots antigos não são recalculados — só lançamentos futuros
   usam o valor novo. Lançamentos anteriores a este módulo (sem
   snapshot) são calculados ao vivo com a potência ATUAL como melhor
   estimativa disponível, marcados como `origemSnapshot:false` para não
   confundir com um valor histórico congelado.
   ──────────────────────────────────────────────────────────────── */

const ENERGIA_FATOR_CV_KW = 0.7457;

let _potenciaCache=[];     // por pivoId local: {pivoId, casaBomba, marca, areaHa, vazaoM3h, potenciaCv, fatorConversao, potenciaKw, fonte}
let _consumoSnapshotCache=[]; // por horimetroGrupoId: snapshot já persistido

function _potenciaRowToLocal(row,pivosSupabase){
  const pivoSup=pivosSupabase.find(p=>p.id===row.pivo_id);
  const pivoLocal=pivoSup?_pivoLocalPorNumero(pivoSup.numero):null;
  return {
    pivoId:pivoLocal?pivoLocal.id:null, _pivoNumero:pivoSup?pivoSup.numero:null,
    fazenda:row.fazenda||'', modulo:row.modulo||'', casaBomba:row.casa_bomba||'', marca:row.marca||'',
    areaHa:row.area_ha!=null?Number(row.area_ha):null, vazaoM3h:row.vazao_m3h!=null?Number(row.vazao_m3h):null,
    potenciaCv:row.potencia_cv!=null?Number(row.potencia_cv):null,
    fatorConversao:row.fator_conversao!=null?Number(row.fator_conversao):ENERGIA_FATOR_CV_KW,
    potenciaKw:row.potencia_kw!=null?Number(row.potencia_kw):null,
    fonte:row.fonte||'DADO_NAO_DISPONIVEL',
  };
}
function _snapshotRowToLocal(row){
  return {
    horimetroGrupoId:row.horimetro_grupo_id, pivoId:null, _pivoIdSupabase:row.pivo_id,
    data:row.data, horas:Number(row.horas),
    potenciaCv:row.potencia_cv!=null?Number(row.potencia_cv):null,
    fatorConversao:row.fator_conversao!=null?Number(row.fator_conversao):null,
    potenciaKw:row.potencia_kw!=null?Number(row.potencia_kw):null,
    rendimento:row.rendimento!=null?Number(row.rendimento):null,
    energiaKwh:row.energia_kwh!=null?Number(row.energia_kwh):null,
    origemPotencia:row.origem_potencia||'DADO_NAO_DISPONIVEL',
  };
}

async function energiaSyncCache(){
  if(typeof window.coiDB==='undefined'){ console.warn('[energia] Supabase não configurado — cache vazio.'); return false; }
  try{
    if(!_pivosSupabaseCache.length){
      const {data:pivosData,error:pErr}=await window.coiDB.from('pivos').select('id,numero');
      if(pErr) throw pErr;
      _pivosSupabaseCache=pivosData||[];
    }
    const {data:potData,error:potErr}=await window.coiDB.from('pivos_potencia_tecnica').select('*');
    if(potErr) throw potErr;
    _potenciaCache=(potData||[]).map(r=>_potenciaRowToLocal(r,_pivosSupabaseCache));

    const {data:snapData,error:snapErr}=await window.coiDB.from('consumo_energia_calculo').select('*');
    if(snapErr) throw snapErr;
    _consumoSnapshotCache=(snapData||[]).map(_snapshotRowToLocal);
    return true;
  }catch(err){
    console.error('[energia] Falha ao sincronizar com o Supabase:',err);
    return false;
  }
}

function energiaPotenciaDoPivo(pivoId){
  return _potenciaCache.find(p=>p.pivoId===pivoId)||null;
}

/* Cálculo puro (sem storage) — reaproveitável por snapshot e por
   consulta ao vivo. Nunca inventa: `potencia` ausente → tudo null. */
function energiaCalcular(horas,potencia){
  if(!potencia||potencia.potenciaKw==null){
    return {potenciaCv:potencia?potencia.potenciaCv:null,fatorConversao:potencia?potencia.fatorConversao:null,
      potenciaKw:null,rendimento:null,energiaKwh:null,origemPotencia:'DADO_NAO_DISPONIVEL'};
  }
  const energiaKwh=isFinite(Number(horas))?+(Number(horas)*potencia.potenciaKw).toFixed(2):null;
  return {
    potenciaCv:potencia.potenciaCv, fatorConversao:potencia.fatorConversao, potenciaKw:potencia.potenciaKw,
    rendimento:null, // não disponível na fonte — nunca inventado
    energiaKwh, origemPotencia:potencia.fonte,
  };
}

/* Chamado por js/lanc.js depois de um Horímetro salvo com sucesso —
   congela a potência USADA NAQUELE MOMENTO. horimetro.js não é tocado. */
async function energiaRegistrarSnapshot(horimetroRegistro){
  if(typeof window.coiDB==='undefined') return {ok:false};
  const potencia=energiaPotenciaDoPivo(horimetroRegistro.pivoId);
  const calculo=energiaCalcular(horimetroRegistro.horas,potencia);
  const pivo=horimetroPivoInfo(horimetroRegistro.pivoId);
  if(!pivo) return {ok:false};
  let pivoSupabaseId;
  try{ pivoSupabaseId=await _pivoSupabaseIdPorNumero(pivo.numero); }catch{ return {ok:false}; }

  const row={
    horimetro_grupo_id:horimetroRegistro.grupoId, pivo_id:pivoSupabaseId, data:horimetroRegistro.data,
    horas:horimetroRegistro.horas, potencia_cv:calculo.potenciaCv, fator_conversao:calculo.fatorConversao,
    potencia_kw:calculo.potenciaKw, rendimento:calculo.rendimento, energia_kwh:calculo.energiaKwh,
    origem_potencia:calculo.origemPotencia,
  };
  const {data:inserted,error}=await window.coiDB.from('consumo_energia_calculo')
    .upsert(row,{onConflict:'horimetro_grupo_id'}).select('*').single();
  if(error){ console.error('[energia] Falha ao registrar snapshot:',error); return {ok:false}; }
  _consumoSnapshotCache=_consumoSnapshotCache.filter(s=>s.horimetroGrupoId!==horimetroRegistro.grupoId);
  _consumoSnapshotCache.push(_snapshotRowToLocal(inserted));
  return {ok:true};
}

/* Consulta principal: junta cada lançamento de Horímetro (irrigação
   EXECUTADA — nunca planejada/pendente) com seu snapshot (se existir)
   ou calcula ao vivo com a potência atual (fallback para lançamentos
   anteriores a este módulo). Mesma assinatura de filtros dos demais
   `xxxConsultar`. */
function energiaConsultar(filtros){
  return horimetroConsultar(filtros).map(reg=>{
    const snapshot=_consumoSnapshotCache.find(s=>s.horimetroGrupoId===reg.grupoId);
    if(snapshot){
      return {...reg, ...snapshot, origemSnapshot:true};
    }
    const potencia=energiaPotenciaDoPivo(reg.pivoId);
    const calculo=energiaCalcular(reg.horas,potencia);
    return {...reg, ...calculo, origemSnapshot:false};
  });
}

/* ── INDICADORES (Ponto 6 do módulo) — todos derivados de energiaConsultar,
   nunca uma segunda fonte. Registros com energiaKwh null são EXCLUÍDOS
   das somas (não contam como 0 — contam como "sem dado"), mas o total
   de "sem dado" é sempre reportado para transparência. */
function energiaResumo(filtros){
  const itens=energiaConsultar(filtros);
  const comDado=itens.filter(i=>i.energiaKwh!=null);
  const semDado=itens.filter(i=>i.energiaKwh==null);
  const totalKwh=+comDado.reduce((s,i)=>s+i.energiaKwh,0).toFixed(2);
  const totalHoras=+itens.reduce((s,i)=>s+(Number(i.horas)||0),0).toFixed(2);
  const pivosIrrigados=new Set(itens.map(i=>i.pivoId)).size;
  return {
    totalKwh, totalHoras, irrigacoesExecutadas:itens.length, pivosIrrigados,
    registrosSemDado:semDado.length,
    kwhPorHora:totalHoras>0?+(totalKwh/totalHoras).toFixed(2):null,
  };
}
function energiaPorPivo(filtros){
  const itens=energiaConsultar(filtros).filter(i=>i.energiaKwh!=null);
  return agruparPorChave(itens,i=>i.pivoId,i=>i.energiaKwh)
    .map(r=>{ const p=horimetroPivoInfo(r.chave); return {pivo:p?'P.'+p.numero:'?',pivoId:r.chave,kwh:r.valor}; })
    .sort((a,b)=>b.kwh-a.kwh);
}
function energiaPorDia(filtros){
  const itens=energiaConsultar(filtros).filter(i=>i.energiaKwh!=null);
  return agruparPorChave(itens,i=>i.data,i=>i.energiaKwh).sort((a,b)=>a.chave.localeCompare(b.chave))
    .map(r=>({data:r.chave,kwh:r.valor}));
}
/* kWh/ha e kWh/mm — só quando área/lâmina estiverem disponíveis no
   próprio lançamento de Horímetro (areaPivo é texto livre "COMPLETO" ou
   um valor; só entra na média quando for numérico real). */
function energiaPorHectare(filtros){
  const itens=energiaConsultar(filtros).filter(i=>i.energiaKwh!=null);
  let kwhTotal=0, haTotal=0;
  itens.forEach(i=>{
    const potencia=energiaPotenciaDoPivo(i.pivoId);
    if(potencia&&potencia.areaHa){ kwhTotal+=i.energiaKwh; haTotal+=potencia.areaHa; }
  });
  return haTotal>0?+(kwhTotal/haTotal).toFixed(2):null;
}
/* ── TELA (Ponto 7/8 do módulo: dashboard + memória de cálculo) ──────
   Fica no mesmo arquivo do service por ser um módulo novo e pequeno —
   os demais módulos do app (Painel Operacional, Consulta) também
   misturam render+service quando o volume não justifica separar em
   dois arquivos (ex.: js/dashboard.js). Nunca lê storage direto: só
   chama energiaConsultar/energiaResumo/energiaPorPivo/energiaPorDia. */
function energiaFiltroLimpar(){
  ['en-faz','en-pivo','en-inicio','en-fim'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  renderEnergia();
}
function _energiaFiltrosAtuais(){
  const fazNome=v('en-faz');
  const fazRec=fazNome?(cadAll('fazendas')||[]).find(f=>f.nome===fazNome):null;
  return {
    fazendaId:fazRec?fazRec.id:undefined,
    pivoId:v('en-pivo')||undefined,
    dataInicio:v('en-inicio')||undefined,
    dataFim:v('en-fim')||undefined,
  };
}
function renderEnergia(){
  const fazSel=document.getElementById('en-faz');
  if(fazSel&&!fazSel.options.length){
    fazSel.innerHTML='<option value="">Fazenda</option>'+(cadAll('fazendas')||[]).map(f=>`<option>${f.nome}</option>`).join('');
  }
  const pivoSel=document.getElementById('en-pivo');
  if(pivoSel&&!pivoSel.dataset.built){
    pivoSel.innerHTML='<option value="">Pivô</option>'+pivoOptionsAgrupados((cadAll('pivos')||[]).sort((a,b)=>a.numero-b.numero));
    pivoSel.dataset.built='1';
  }

  const filtros=_energiaFiltrosAtuais();
  const resumo=energiaResumo(filtros);

  const kpis=document.getElementById('en-kpis');
  if(kpis) kpis.innerHTML=[
    kpi('Energia Estimada',fmt(resumo.totalKwh,1),'kWh','no período',null,null,'kpi-teal'),
    kpi('Horas de Bombeamento',fmt(resumo.totalHoras,1),'h','irrigação executada',null,null,'kpi-sky'),
    kpi('Pivôs Irrigados',resumo.pivosIrrigados,'','no período',null,null,'kpi-green'),
    kpi('Irrigações Executadas',resumo.irrigacoesExecutadas,'','lançamentos de Horímetro',null,null,'kpi-purple'),
    kpi('kWh por Hora',resumo.kwhPorHora!=null?fmt(resumo.kwhPorHora,2):'—','kWh/h','média do período',null,null,'kpi-amber'),
    kpi('Sem Dado de Potência',resumo.registrosSemDado,'','irrigações não entram na soma',null,null,resumo.registrosSemDado>0?'kpi-red':'kpi-green'),
  ].join('');

  const porDia=energiaPorDia(filtros);
  const diaBox=document.getElementById('en-por-dia');
  if(diaBox) diaBox.innerHTML=porDia.length?barH(porDia.slice(-20).map(d=>({l:fmtD(d.data),v:d.kwh,c:'var(--brand-600)',dec:1,unit:'kWh'})),85):emEl('Sem dados suficientes para calcular energia no período.');

  const porPivo=energiaPorPivo(filtros);
  const pivoBox=document.getElementById('en-por-pivo');
  if(pivoBox) pivoBox.innerHTML=porPivo.length?barH(porPivo.slice(0,15).map(p=>({l:p.pivo,v:p.kwh,c:'#0284c7',dec:1,unit:'kWh'})),45):emEl('Sem dados suficientes para calcular energia no período.');

  const itens=energiaConsultar(filtros).sort((a,b)=>b.data.localeCompare(a.data));
  const cnt=document.getElementById('en-tbl-cnt');
  if(cnt) cnt.textContent=itens.length.toLocaleString('pt-BR')+' registro(s)';
  const tbl=document.getElementById('en-tbl');
  if(tbl) tbl.innerHTML=itens.length?`<table class="table"><thead><tr><th>Data</th><th>Pivô</th><th>Horas</th><th>Potência</th><th>Energia</th><th></th></tr></thead><tbody>${itens.slice(0,300).map((i,idx)=>{
    const p=horimetroPivoInfo(i.pivoId);
    return `<tr>
      <td>${fmtD(i.data)}</td>
      <td><span class="badge b-brand">P.${p?p.numero:'?'}</span></td>
      <td>${fmt(i.horas,1)}h</td>
      <td>${i.potenciaKw!=null?fmt(i.potenciaKw,1)+' kW ('+fmt(i.potenciaCv,0)+' CV)':'<span class="badge b-neutral">Dado não disponível</span>'}</td>
      <td>${i.energiaKwh!=null?`<strong>${fmt(i.energiaKwh,1)} kWh</strong>`:'—'}</td>
      <td><button class="btn btn-ghost btn-xs" onclick="energiaVerMemoria('${i.grupoId}')">Ver memória de cálculo</button></td>
    </tr>`;
  }).join('')}</tbody></table>`:emEl('Nenhuma irrigação executada encontrada para os filtros escolhidos.');
}

/* Ponto 9 (memória de cálculo) — mostra exatamente de onde veio cada
   número, reaproveitando o modal genérico já usado por verVersoes()
   em todos os módulos de lançamento (js/nav.js showVersoesModal). */
function energiaVerMemoria(grupoId){
  const item=energiaConsultar({}).find(i=>i.grupoId===grupoId);
  if(!item) return;
  const p=horimetroPivoInfo(item.pivoId);
  const potencia=energiaPotenciaDoPivo(item.pivoId);
  const linhas=[
    ['Pivô', p?`P.${p.numero}`:'—'],
    ['Data', fmtD(item.data)],
    ['Casa de Bomba / Estrutura', potencia?.casaBomba||'—'],
    ['Tempo de irrigação', fmt(item.horas,2)+' h'],
    ['Lâmina', item.lamina?fmt(item.lamina,2)+' mm':'—'],
    ['Área do pivô (ficha técnica)', potencia?.areaHa?fmt(potencia.areaHa,2)+' ha':'—'],
    ['Potência (CV)', item.potenciaCv!=null?fmt(item.potenciaCv,0):'DADO NÃO DISPONÍVEL'],
    ['Fator de conversão CV→kW', item.fatorConversao!=null?item.fatorConversao:'—'],
    ['Potência considerada (kW)', item.potenciaKw!=null?fmt(item.potenciaKw,2):'DADO NÃO DISPONÍVEL'],
    ['Rendimento do conjunto', item.rendimento!=null?fmt(item.rendimento,2):'não disponível na fonte'],
    ['Energia estimada', item.energiaKwh!=null?fmt(item.energiaKwh,2)+' kWh':'DADO NÃO DISPONÍVEL'],
    ['Origem da potência', item.origemPotencia==='planilha_tecnica'?'Planilha técnica (BASE DE DADOS)':item.origemPotencia==='DADO_NAO_DISPONIVEL'?'Sem cadastro técnico':'Manual'],
    ['Congelado no momento do lançamento?', item.origemSnapshot?'Sim (snapshot)':'Não — calculado ao vivo com a potência atual (lançamento anterior a este módulo)'],
  ];
  const html=`<div style="display:flex;flex-direction:column;gap:.5rem;font-size:12.5px">${linhas.map(([k,val])=>
    `<div style="display:flex;justify-content:space-between;gap:1rem;padding:.35rem 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-tertiary)">${k}</span><strong>${val}</strong></div>`
  ).join('')}</div>`;
  if(typeof showInfoModal==='function') showInfoModal('Memória de Cálculo — Consumo de Energia',html);
  else alert(linhas.map(([k,val])=>`${k}: ${val}`).join('\n'));
}

function energiaPorLamina(filtros){
  const itens=energiaConsultar(filtros).filter(i=>i.energiaKwh!=null&&i.lamina);
  if(!itens.length) return null;
  const kwhTotal=itens.reduce((s,i)=>s+i.energiaKwh,0);
  const mmTotal=itens.reduce((s,i)=>s+Number(i.lamina),0);
  return mmTotal>0?+(kwhTotal/mmTotal).toFixed(3):null;
}
