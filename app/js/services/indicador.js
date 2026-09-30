/* ── SERVICES / INDICADORES ────────────────────────────────────────
   Duas responsabilidades:
   1) Registro de ocorrências de falha — banco oficial passou a ser a
      tabela `indicador_ocorrencias` (coi.*), no lugar do localStorage
      (migração de sincronização, 2026-09-21 — mesmo padrão do
      Horímetro/Fertirrigação: cache em memória sincronizado do
      Supabase, gravações async).
   2) Cálculo dos indicadores operacionais, de disponibilidade e de
      manutenção, combinando ocorrências de falha + lançamentos de
      horímetro (js/services/horimetro.js) + js/services/calculos.js.

   Falha (categoria/motivo) continua vindo do cadastro local
   (js/cadastro.js) — gravada como texto, não FK (mesmo caso do
   produto em Fertirrigação; ver migration 012_ferti_indicador.sql).

   As telas nunca calculam nada sozinhas — só chamam estas funções.
   ──────────────────────────────────────────────────────────────── */

let _indicadorCache=[];
let _indicadorSyncOk=false;

function indicadorFalhaInfo(falhaId){
  return (cadAll('falhas')||[]).find(f=>f.id===falhaId)||null;
}

function _indicadorRowToLocal(row){
  const pivoSup=_pivosSupabaseCache.find(p=>p.id===row.pivo_id);
  const pivoLocal=pivoSup?_pivoLocalPorNumero(pivoSup.numero):null;
  return {
    id:row.id, grupoId:row.grupo_id, versao:row.versao, atual:row.atual, status:row.status,
    pivoId:pivoLocal?pivoLocal.id:null, _pivoNumero:pivoSup?pivoSup.numero:null,
    data:row.data, falhaCategoria:row.falha_categoria||'', falhaMotivo:row.falha_motivo||'',
    /* falhaId: melhor esforço, resolvido por categoria+motivo contra o
       cadastro local — mesma ressalva do produtoId em fertirrigacao.js. */
    falhaId:((cadAll('falhas')||[]).find(f=>f.categoria===row.falha_categoria&&f.motivo===row.falha_motivo)||{}).id||null,
    observacao:row.observacao||'', criadoEm:row.criado_em,
  };
}

/* Sincroniza o cache em memória com o banco oficial. Chamada 1x no boot
   (main.js) e novamente após cada gravação. */
async function indicadorSyncCache(){
  if(typeof window.coiDB==='undefined'){ console.warn('[indicador] Supabase não configurado — cache vazio.'); return false; }
  try{
    const data=await sbFetchAll((from,to)=>window.coiDB.schema('coi').from('indicador_ocorrencias').select('*').order('criado_em',{ascending:true}).range(from,to));
    _indicadorCache=data.map(_indicadorRowToLocal);
    _indicadorSyncOk=true;
    return true;
  }catch(err){
    console.error('[indicador] Falha ao sincronizar com o Supabase:',err);
    _indicadorSyncOk=false;
    return false;
  }
}

const indicadorTodos = () => _indicadorCache;
const indicadorAtivos = () => indicadorTodos().filter(r=>r.atual&&r.status==='ativo');

function _indicadorDadosParaRow(dados,pivoSupabaseId,extra){
  const falha=indicadorFalhaInfo(dados.falhaId);
  return {
    pivo_id:pivoSupabaseId, data:dados.data,
    falha_categoria:falha?falha.categoria:'', falha_motivo:falha?falha.motivo:'',
    observacao:dados.observacao||'', origem:'app',
    ...extra,
  };
}

/* ── CRUD (grupoId/versao/atual, igual ao serviço de Horímetro) ──── */
async function indicadorCriar(dados){
  if(!dados.pivoId||!dados.falhaId||!dados.data){
    return {ok:false,erros:['Selecione pivô, falha e data.']};
  }
  if(dataEhFutura(dados.data)&&!dados.dataFuturaAutorizada) return {ok:false,dataFuturaPendente:true};

  const pivo=horimetroPivoInfo(dados.pivoId);
  if(!pivo) return {ok:false,erros:['Pivô não encontrado no cadastro.']};

  let pivoSupabaseId;
  try{ pivoSupabaseId=await _pivoSupabaseIdPorNumero(pivo.numero); }
  catch(err){ return {ok:false,erros:['Falha ao conectar ao banco de indicadores: '+err.message]}; }

  const grupoId=(crypto&&crypto.randomUUID)?crypto.randomUUID():gId();
  const row=_indicadorDadosParaRow(dados,pivoSupabaseId,{grupo_id:grupoId,versao:1,atual:true,status:'ativo'});
  const {data:inserted,error}=await window.coiDB.schema('coi').from('indicador_ocorrencias').insert(row).select('*').single();
  if(error) return {ok:false,erros:['Falha ao gravar no banco: '+error.message]};

  const registro=_indicadorRowToLocal(inserted);
  _indicadorCache.push(registro);
  const falha=indicadorFalhaInfo(dados.falhaId);
  auditLog('Indicadores','INCLUSÃO',`Pivô ${pivo.numero} — ${falha?falha.categoria+'/'+falha.motivo:'?'} — ${fmtD(dados.data)}`);
  return {ok:true,registro};
}

async function indicadorAtualizar(grupoId,dados){
  const atualLocal=indicadorTodos().find(r=>r.grupoId===grupoId&&r.atual);
  if(!atualLocal) return {ok:false,erros:['Ocorrência não encontrada.']};
  if(dataEhFutura(dados.data)&&!dados.dataFuturaAutorizada) return {ok:false,dataFuturaPendente:true};

  const pivo=horimetroPivoInfo(dados.pivoId);
  if(!pivo) return {ok:false,erros:['Pivô não encontrado no cadastro.']};

  let pivoSupabaseId;
  try{ pivoSupabaseId=await _pivoSupabaseIdPorNumero(pivo.numero); }
  catch(err){ return {ok:false,erros:['Falha ao conectar ao banco de indicadores: '+err.message]}; }

  const {error:updErr}=await window.coiDB.schema('coi').from('indicador_ocorrencias').update({atual:false}).eq('id',atualLocal.id);
  if(updErr) return {ok:false,erros:['Falha ao versionar registro anterior: '+updErr.message]};

  const row=_indicadorDadosParaRow(dados,pivoSupabaseId,{grupo_id:grupoId,versao:atualLocal.versao+1,atual:true,status:'ativo'});
  const {data:inserted,error}=await window.coiDB.schema('coi').from('indicador_ocorrencias').insert(row).select('*').single();
  if(error){
    const {error:revertErr}=await window.coiDB.schema('coi').from('indicador_ocorrencias').update({atual:true}).eq('id',atualLocal.id);
    if(revertErr) console.error('[indicador] Falha ao reverter atual=true após erro de gravação — grupo pode ter ficado sem versão atual:',grupoId,revertErr);
    return {ok:false,erros:['Falha ao gravar nova versão: '+error.message]};
  }

  atualLocal.atual=false;
  const registro=_indicadorRowToLocal(inserted);
  _indicadorCache.push(registro);
  const pivoInfo=horimetroPivoInfo(dados.pivoId);
  auditLog('Indicadores','ALTERAÇÃO',`Pivô ${pivoInfo?pivoInfo.numero:'?'} — versão ${registro.versao}`);
  return {ok:true,registro};
}

async function indicadorExcluir(grupoId){
  const atualLocal=indicadorTodos().find(r=>r.grupoId===grupoId&&r.atual);
  if(!atualLocal) return {ok:false,erros:['Ocorrência não encontrada.']};

  const {error}=await window.coiDB.schema('coi').from('indicador_ocorrencias').update({status:'excluido'}).eq('id',atualLocal.id);
  if(error) return {ok:false,erros:['Falha ao excluir: '+error.message]};

  atualLocal.status='excluido';
  const pivo=horimetroPivoInfo(atualLocal.pivoId);
  auditLog('Indicadores','EXCLUSÃO',`Pivô ${pivo?pivo.numero:'?'} — ${fmtD(atualLocal.data)}`);
  return {ok:true};
}

function indicadorHistoricoVersoes(grupoId){
  return indicadorTodos().filter(r=>r.grupoId===grupoId).sort((a,b)=>a.versao-b.versao);
}

/* ── CONSULTAS ────────────────────────────────────────────────────── */
function indicadorPorPivo(pivoId){
  return indicadorAtivos().filter(r=>r.pivoId===pivoId).sort((a,b)=>a.data.localeCompare(b.data));
}
function indicadorPorFazenda(fazendaId){
  const pivoIds=new Set((cadAll('pivos')||[]).filter(p=>p.fazendaId===fazendaId).map(p=>p.id));
  return indicadorAtivos().filter(r=>pivoIds.has(r.pivoId));
}
function indicadorPorCasaBomba(casaBombaId){
  const pivoIds=new Set((cadAll('pivos')||[]).filter(p=>p.casaBombaId===casaBombaId).map(p=>p.id));
  return indicadorAtivos().filter(r=>pivoIds.has(r.pivoId));
}

/* Distribuição das falhas por categoria (para gráfico de pizza/barras).
   Agora lê `falhaCategoria` (denormalizado no registro), não mais via
   lookup em `indicadorFalhaInfo` — o registro grava o texto no momento
   do lançamento, então continua correto mesmo se a falha for renomeada/
   removida do cadastro depois. */
function indicadorDistribuicaoCategoria(ocorrencias){
  const arr=ocorrencias||indicadorAtivos();
  return agruparPorChave(arr,r=>r.falhaCategoria||'Não classificado',()=>1);
}

/* ── INDICADORES DE MANUTENÇÃO (estrutura pronta; retornam null quando
   ainda não há dados suficientes — nunca um número inventado) ──── */

/* MTBF: tempo médio (em dias) entre falhas consecutivas de um pivô. */
function indicadorMTBF(pivoId){
  const falhas=indicadorPorPivo(pivoId);
  if(falhas.length<2) return null;
  let somaDias=0;
  for(let i=1;i<falhas.length;i++){
    somaDias+=(new Date(falhas[i].data)-new Date(falhas[i-1].data))/86400000;
  }
  return +(somaDias/(falhas.length-1)).toFixed(1);
}

/* MTTR: tempo médio (em horas) de reparo — vem das Paradas reais
   (js/services/parada.js), que são quem sabe a duração exata (hora
   inicial/final). Retorna null enquanto não houver paradas registradas. */
function indicadorMTTR(pivoId){
  const paradas=pivoId?paradaPorPivo(pivoId):paradaAtivas();
  if(!paradas.length) return null;
  return paradaTempoMedio(paradas);
}

function indicadorQuantidadeFalhas(pivoId){
  return pivoId?indicadorPorPivo(pivoId).length:indicadorAtivos().length;
}

/* ── INDICADORES OPERACIONAIS (horas — vêm do serviço de Horímetro) ── */
function indicadorHorasHoje(){ return calcAcumulado(horimetroAtivos().filter(r=>r.data===today())); }
function indicadorHorasSemana(){
  const {inicio,fim}=semanaAtual();
  return calcAcumulado(horimetroAtivos().filter(r=>r.data>=inicio&&r.data<=fim));
}
function indicadorHorasMes(){ return calcAcumulado(horimetroAtivos().filter(r=>r.data.slice(0,7)===today().slice(0,7))); }
function indicadorHorasSafra(safra){ return calcAcumulado(horimetroAtivos().filter(r=>r.safra===safra)); }

function indicadorHorasPorPivo(){
  return agruparPorChave(horimetroAtivos(),r=>r.pivoId)
    .map(r=>{ const p=horimetroPivoInfo(r.chave); return {pivo:p?'P.'+p.numero:'?',horas:r.valor}; })
    .sort((a,b)=>b.horas-a.horas);
}
function indicadorHorasPorFazenda(){
  return agruparPorChave(horimetroAtivos(),r=>{ const p=horimetroPivoInfo(r.pivoId); return p?p.fazendaId:null; })
    .map(r=>({fazenda:cadLookupLabel('fazendas',r.chave),horas:r.valor}));
}
function indicadorHorasPorCasaBomba(){
  return agruparPorChave(horimetroAtivos(),r=>{ const p=horimetroPivoInfo(r.pivoId); return p&&p.casaBombaId?p.casaBombaId:null; })
    .map(r=>({casaBomba:cadLookupLabel('casasBomba',r.chave),horas:r.valor}));
}
function indicadorHorasPorOperador(){
  return agruparPorChave(horimetroAtivos(),r=>r.operador||'Não informado')
    .map(r=>({operador:r.chave,horas:r.valor}))
    .sort((a,b)=>b.horas-a.horas);
}

/* ── DISPONIBILIDADE / UTILIZAÇÃO / EFICIÊNCIA ────────────────────── */
/* Todas usam `horimetroConsultar`/`paradaConsultar` (js/services/horimetro.js
   e js/services/parada.js) para filtrar por período — nunca refazem esse
   filtro na mão, e é a mesma consulta que o módulo de Relatórios vai
   reaproveitar depois. */
function indicadorTempoParado(dataInicio,dataFim){
  return calcAcumulado(paradaConsultar({dataInicio,dataFim}),'tempoParadoHoras');
}
function indicadorTempoOperacao(dataInicio,dataFim){
  return calcAcumulado(horimetroConsultar({dataInicio,dataFim}));
}
function indicadorDisponibilidade(dataInicio,dataFim){
  const horasOperacao=indicadorTempoOperacao(dataInicio,dataFim);
  const horasParadas=indicadorTempoParado(dataInicio,dataFim);
  const total=horasOperacao+horasParadas;
  return total>0?+((horasOperacao/total)*100).toFixed(1):100;
}
function indicadorUtilizacao(dataInicio,dataFim){
  return calcUtilizacao(horimetroConsultar({dataInicio,dataFim}),dataInicio,dataFim);
}
/* Eficiência operacional = utilização ponderada pela disponibilidade.
   Fórmula provisória: combina os dois indicadores já reais que temos hoje;
   quando o módulo Importação de Planejamento existir, isto pode evoluir
   para horas realizadas / horas planejadas sem mudar quem chama esta função. */
function indicadorEficiencia(dataInicio,dataFim){
  const util=indicadorUtilizacao(dataInicio,dataFim), disp=indicadorDisponibilidade(dataInicio,dataFim);
  return +((util*disp)/100).toFixed(1);
}

/* ── EVOLUÇÃO MENSAL (para gráficos de disponibilidade/utilização) ── */
function indicadorEvolucaoMensal(nMeses){
  const hoje=new Date();
  const meses=[];
  for(let i=nMeses-1;i>=0;i--){
    const d=new Date(hoje.getFullYear(),hoje.getMonth()-i,1);
    const ini=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
    const fimD=new Date(d.getFullYear(),d.getMonth()+1,0);
    const fim=`${fimD.getFullYear()}-${String(fimD.getMonth()+1).padStart(2,'0')}-${String(fimD.getDate()).padStart(2,'0')}`;
    meses.push({mes:ini.slice(0,7),disponibilidade:indicadorDisponibilidade(ini,fim),utilizacao:indicadorUtilizacao(ini,fim)});
  }
  return meses;
}
