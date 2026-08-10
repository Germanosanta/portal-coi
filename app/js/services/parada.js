/* ── SERVICES / PARADAS ────────────────────────────────────────────
   Única camada que lê/grava paradas operacionais. Mesmo padrão de
   histórico permanente do Horímetro (grupoId/versao/atual + soft-delete)
   e mesma regra: categoria/motivo/submotivo/prioridade/criticidade NÃO
   são reescritos aqui — vêm por `falhaId`, referência ao cadastro de
   Falhas (js/cadastro.js), para nunca duplicar essa taxonomia.

   Fase 15 — mesmo padrão do Horímetro (js/services/horimetro.js): banco
   oficial é o Supabase (tabela `paradas_lancamentos`, ver
   scratchpad/schema_paradas.sql). Leituras continuam síncronas via cache
   em memória (`_paradaCache`), sincronizado no boot e depois de cada
   gravação; só as 3 gravações (Criar/Atualizar/Excluir) são `async`.
   O elo pivô local↔Supabase é o mesmo de horimetro.js: número do pivô.

   Este serviço também é a fonte de "tempo parado" para os Indicadores
   (disponibilidade/MTTR) — ver js/services/indicador.js.
   ──────────────────────────────────────────────────────────────── */

let _paradaCache=[];

function _paradaRowToLocal(row,pivosSupabase){
  const pivoSup=pivosSupabase.find(p=>p.id===row.pivo_id);
  const pivoLocal=pivoSup?_pivoLocalPorNumero(pivoSup.numero):null;
  return {
    id:row.id, grupoId:row.grupo_id, versao:row.versao, atual:row.atual, status:row.status,
    pivoId:pivoLocal?pivoLocal.id:null, _pivoNumero:pivoSup?pivoSup.numero:null,
    data:row.data, horaInicial:row.hora_inicial, horaFinal:row.hora_final,
    tempoParadoHoras:row.tempo_parado_horas!=null?Number(row.tempo_parado_horas):null,
    falhaId:row._falhaId||null, motivoTexto:row.motivo||'',
    operador:row.operador||'', tecnicoId:row.tecnico||'',
    tipoParada:row.tipo_parada||'Não Programada', observacao:row.observacao||'',
    criadoEm:row.criado_em,
  };
}

/* Sincroniza o cache com o Supabase — chamada no boot (main.js) e depois
   de cada gravação. Reaproveita o cache de pivôs já mantido por
   horimetro.js (`_pivosSupabaseCache`) em vez de buscar de novo. */
async function paradaSyncCache(){
  if(typeof window.coiDB==='undefined'){ console.warn('[parada] Supabase não configurado — cache vazio.'); return false; }
  try{
    if(!_pivosSupabaseCache.length){
      const {data:pivosData,error:pErr}=await window.coiDB.schema('coi').from('pivos').select('id,numero');
      if(pErr) throw pErr;
      _pivosSupabaseCache=pivosData||[];
    }
    const {data,error}=await window.coiDB.schema('coi').from('paradas_lancamentos').select('*').order('criado_em',{ascending:true});
    if(error) throw error;
    _paradaCache=(data||[]).map(r=>_paradaRowToLocal(r,_pivosSupabaseCache));
    return true;
  }catch(err){
    console.error('[parada] Falha ao sincronizar com o Supabase:',err);
    return false;
  }
}

const paradaTodos = () => _paradaCache;
const paradaAtivas = () => paradaTodos().filter(r=>r.atual&&r.status==='ativo');

function _paradaDadosParaRow(dados,pivoSupabaseId,extra){
  const falha=typeof indicadorFalhaInfo==='function'?indicadorFalhaInfo(dados.falhaId):null;
  return {
    pivo_id:pivoSupabaseId, data:dados.data, hora_inicial:dados.horaInicial, hora_final:dados.horaFinal,
    tempo_parado_horas:calcDuracaoHoras(dados.horaInicial,dados.horaFinal),
    motivo:falha?`${falha.categoria} — ${falha.motivo}`:'',
    tipo_parada:dados.tipoParada||'Não Programada',
    operador:dados.operador||'', tecnico:dados.tecnicoId||'', observacao:dados.observacao||'',
    origem:'app',
    ...extra,
  };
}

/* Cria uma parada para 1 pivô. `dados.falhaId` fica guardado só em
   memória (`_falhaId` no registro local) para a tela continuar mostrando
   categoria/motivo/submotivo pelo cadastro de Falhas sem duplicar a
   taxonomia no banco — o Supabase grava o texto resolvido em `motivo`. */
async function paradaCriar(dados){
  const check=validarParada(dados);
  if(!check.valido){
    if(check.erros.length===1&&check.erros[0]==='DATA_FUTURA') return {ok:false,dataFuturaPendente:true};
    return {ok:false,erros:check.erros.filter(e=>e!=='DATA_FUTURA')};
  }
  const pivo=horimetroPivoInfo(dados.pivoId);
  if(!pivo) return {ok:false,erros:['Pivô não encontrado no cadastro.']};

  let pivoSupabaseId;
  try{ pivoSupabaseId=await _pivoSupabaseIdPorNumero(pivo.numero); }
  catch(err){ return {ok:false,erros:['Falha ao conectar ao banco de paradas: '+err.message]}; }

  const grupoId=(crypto&&crypto.randomUUID)?crypto.randomUUID():gId();
  const row=_paradaDadosParaRow(dados,pivoSupabaseId,{grupo_id:grupoId,versao:1,atual:true,status:'ativo'});
  const {data:inserted,error}=await window.coiDB.schema('coi').from('paradas_lancamentos').insert(row).select('*').single();
  if(error) return {ok:false,erros:['Falha ao gravar no banco: '+error.message]};

  const registro=_paradaRowToLocal(inserted,_pivosSupabaseCache);
  registro._falhaId=dados.falhaId;
  _paradaCache.push(registro);

  const falha=indicadorFalhaInfo(dados.falhaId);
  auditLog('Paradas','INCLUSÃO',`Pivô ${pivo.numero} — ${falha?falha.categoria+'/'+falha.motivo:'?'}`,{
    registro:registro.grupoId, valorNovo:`${dados.horaInicial}–${dados.horaFinal} (${fmt(registro.tempoParadoHoras,1)}h)`,
  });
  return {ok:true,registro};
}

/* Ponto 4 — "permitir vários pivôs no mesmo fluxo": cria a MESMA parada
   (data/hora/motivo/observação) para uma lista de pivôs, reaproveitando
   paradaCriar (mesma validação, mesmo histórico, mesma auditoria) para
   cada um — nenhuma regra nova, só o laço. Retorna um resultado por
   pivô para a tela poder mostrar sucesso parcial sem perder nenhum. */
async function paradaCriarMultiplo(pivoIds,dadosComuns){
  const resultados=[];
  for(const pivoId of pivoIds){
    resultados.push({pivoId,...(await paradaCriar({...dadosComuns,pivoId}))});
  }
  return {
    ok:resultados.every(r=>r.ok),
    sucesso:resultados.filter(r=>r.ok).length,
    falhas:resultados.filter(r=>!r.ok).length,
    resultados,
  };
}

async function paradaAtualizar(grupoId,dados){
  const atualLocal=paradaTodos().find(r=>r.grupoId===grupoId&&r.atual);
  if(!atualLocal) return {ok:false,erros:['Parada não encontrada.']};

  const check=validarParada(dados);
  if(!check.valido){
    if(check.erros.length===1&&check.erros[0]==='DATA_FUTURA') return {ok:false,dataFuturaPendente:true};
    return {ok:false,erros:check.erros.filter(e=>e!=='DATA_FUTURA')};
  }
  const pivo=horimetroPivoInfo(dados.pivoId);
  if(!pivo) return {ok:false,erros:['Pivô não encontrado no cadastro.']};

  let pivoSupabaseId;
  try{ pivoSupabaseId=await _pivoSupabaseIdPorNumero(pivo.numero); }
  catch(err){ return {ok:false,erros:['Falha ao conectar ao banco de paradas: '+err.message]}; }

  const valorAnterior=`${atualLocal.horaInicial}–${atualLocal.horaFinal} (${fmt(atualLocal.tempoParadoHoras,1)}h)`;

  const {error:updErr}=await window.coiDB.schema('coi').from('paradas_lancamentos').update({atual:false}).eq('id',atualLocal.id);
  if(updErr) return {ok:false,erros:['Falha ao versionar registro anterior: '+updErr.message]};

  const row=_paradaDadosParaRow(dados,pivoSupabaseId,{grupo_id:grupoId,versao:atualLocal.versao+1,atual:true,status:'ativo'});
  const {data:inserted,error}=await window.coiDB.schema('coi').from('paradas_lancamentos').insert(row).select('*').single();
  if(error){
    await window.coiDB.schema('coi').from('paradas_lancamentos').update({atual:true}).eq('id',atualLocal.id);
    return {ok:false,erros:['Falha ao gravar nova versão: '+error.message]};
  }

  atualLocal.atual=false;
  const registro=_paradaRowToLocal(inserted,_pivosSupabaseCache);
  registro._falhaId=dados.falhaId;
  _paradaCache.push(registro);

  const valorNovo=`${registro.horaInicial}–${registro.horaFinal} (${fmt(registro.tempoParadoHoras,1)}h)`;
  auditLog('Paradas','ALTERAÇÃO',`Pivô ${pivo.numero} — versão ${registro.versao}`,{
    registro:grupoId, valorAnterior, valorNovo,
  });
  return {ok:true,registro};
}

async function paradaExcluir(grupoId){
  const atualLocal=paradaTodos().find(r=>r.grupoId===grupoId&&r.atual);
  if(!atualLocal) return {ok:false,erros:['Parada não encontrada.']};

  const {error}=await window.coiDB.schema('coi').from('paradas_lancamentos').update({status:'excluido'}).eq('id',atualLocal.id);
  if(error) return {ok:false,erros:['Falha ao excluir: '+error.message]};

  atualLocal.status='excluido';
  const pivo=horimetroPivoInfo(atualLocal.pivoId);
  auditLog('Paradas','EXCLUSÃO',`Pivô ${pivo?pivo.numero:'?'} — ${fmtD(atualLocal.data)}`,{registro:grupoId});
  return {ok:true};
}

function paradaHistoricoVersoes(grupoId){
  return paradaTodos().filter(r=>r.grupoId===grupoId).sort((a,b)=>a.versao-b.versao);
}

/* ── CONSULTAS (inalteradas — mesma assinatura de antes) ───────────── */
function paradaPorPivo(pivoId){
  return paradaAtivas().filter(r=>r.pivoId===pivoId).sort((a,b)=>(a.data+a.horaInicial).localeCompare(b.data+b.horaInicial));
}
function paradaPorFazenda(fazendaId){
  const pivoIds=new Set((cadAll('pivos')||[]).filter(p=>p.fazendaId===fazendaId).map(p=>p.id));
  return paradaAtivas().filter(r=>pivoIds.has(r.pivoId));
}
function paradaPorCasaBomba(casaBombaId){
  const pivoIds=new Set((cadAll('pivos')||[]).filter(p=>p.casaBombaId===casaBombaId).map(p=>p.id));
  return paradaAtivas().filter(r=>pivoIds.has(r.pivoId));
}

function paradaConsultar(filtros){
  const f=filtros||{};
  const pivosPorFiltro=(f.fazendaId||f.casaBombaId)?new Set((cadAll('pivos')||[])
    .filter(p=>(!f.fazendaId||p.fazendaId===f.fazendaId)&&(!f.casaBombaId||p.casaBombaId===f.casaBombaId))
    .map(p=>p.id)):null;

  return paradaAtivas().filter(r=>{
    if(f.dataInicio&&r.data<f.dataInicio) return false;
    if(f.dataFim&&r.data>f.dataFim) return false;
    if(f.pivoId&&r.pivoId!==f.pivoId) return false;
    if(pivosPorFiltro&&!pivosPorFiltro.has(r.pivoId)) return false;
    if(f.operador&&r.operador!==f.operador) return false;
    if(f.tecnicoId&&r.tecnicoId!==f.tecnicoId) return false;
    if(f.categoria){ const fa=indicadorFalhaInfo(r.falhaId); if(!fa||fa.categoria!==f.categoria) return false; }
    return true;
  });
}

/* ── INDICADORES DO DIA/SEMANA/MÊS/7 DIAS ─────────────────────────── */
function paradasHoje(){ return paradaAtivas().filter(r=>r.data===today()); }
function paradasSemana(){ const {inicio,fim}=semanaAtual(); return paradaAtivas().filter(r=>r.data>=inicio&&r.data<=fim); }
function paradasMes(){ return paradaAtivas().filter(r=>r.data.slice(0,7)===today().slice(0,7)); }
function paradasUltimosDias(n){ const {inicio,fim}=ultimosDias(n); return paradaAtivas().filter(r=>r.data>=inicio&&r.data<=fim); }

function paradaTempoMedio(paradas){
  const arr=paradas||paradaAtivas();
  if(!arr.length) return 0;
  return +(calcAcumulado(arr,'tempoParadoHoras')/arr.length).toFixed(2);
}

/* ── RANKINGS ─────────────────────────────────────────────────────── */
function paradaRankingFalhas(paradas){
  return agruparPorChave(paradas||paradaAtivas(),r=>{
    const f=indicadorFalhaInfo(r.falhaId); return f?`${f.categoria} — ${f.motivo}`:(r.motivoTexto||'Não classificado');
  },()=>1).sort((a,b)=>b.valor-a.valor).map(r=>({motivo:r.chave,ocorrencias:r.valor}));
}
function paradaRankingPivos(paradas){
  return agruparPorChave(paradas||paradaAtivas(),r=>r.pivoId,r=>r.tempoParadoHoras||0)
    .map(r=>{ const p=horimetroPivoInfo(r.chave); return {pivo:p?'P.'+p.numero:'?',horas:r.valor}; })
    .sort((a,b)=>b.horas-a.horas);
}

/* ── GRÁFICOS ─────────────────────────────────────────────────────── */
function paradaPorCategoria(paradas){
  return agruparPorChave(paradas||paradaAtivas(),r=>{ const f=indicadorFalhaInfo(r.falhaId); return f?f.categoria:(r.motivoTexto||'Não classificado'); },r=>r.tempoParadoHoras||0);
}
function paradaEvolucaoMensal(pivoId){
  return agruparPorMes(pivoId?paradaPorPivo(pivoId):paradaAtivas(),'tempoParadoHoras');
}

/* Resumo completo de paradas de um pivô: tempo acumulado, frequência,
   ranking de motivos e linha do tempo — para a aba Histórico. */
function paradaResumoPivo(pivoId){
  const regs=paradaPorPivo(pivoId);
  return {
    tempoAcumulado:calcAcumulado(regs,'tempoParadoHoras'),
    frequencia:regs.length,
    tempoMedio:paradaTempoMedio(regs),
    rankingMotivos:paradaRankingFalhas(regs),
    porMes:agruparPorMes(regs,'tempoParadoHoras'),
    linhaDoTempo:regs.map(r=>({data:r.data,horas:r.tempoParadoHoras})),
  };
}
