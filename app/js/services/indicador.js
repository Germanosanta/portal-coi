/* ── SERVICES / INDICADORES ────────────────────────────────────────
   Duas responsabilidades:
   1) Registro de ocorrências de falha (única camada que grava em
      `coi_indicador_ocorrencias` — mesmo padrão de versionamento
      permanente do serviço de Horímetro).
   2) Cálculo dos indicadores operacionais, de disponibilidade e de
      manutenção, combinando ocorrências de falha + lançamentos de
      horímetro (js/services/horimetro.js) + js/services/calculos.js.

   As telas nunca calculam nada sozinhas — só chamam estas funções.
   ──────────────────────────────────────────────────────────────── */

const INDICADOR_KEY='coi_indicador_ocorrencias';

const indicadorTodos = () => lsGet(INDICADOR_KEY,[]);
const indicadorSalvarTudo = arr => lsSet(INDICADOR_KEY,arr);
const indicadorAtivos = () => indicadorTodos().filter(r=>r.atual&&r.status==='ativo');

function indicadorFalhaInfo(falhaId){
  return (cadAll('falhas')||[]).find(f=>f.id===falhaId)||null;
}

/* ── CRUD (grupoId/versao/atual, igual ao serviço de Horímetro) ──── */
function indicadorCriar(dados){
  if(!dados.pivoId||!dados.falhaId||!dados.data){
    return {ok:false,erros:['Selecione pivô, falha e data.']};
  }
  if(dataEhFutura(dados.data)&&!dados.dataFuturaAutorizada) return {ok:false,dataFuturaPendente:true};

  const id=gId();
  const registro={
    id, grupoId:id, versao:1, atual:true, status:'ativo',
    pivoId:dados.pivoId, falhaId:dados.falhaId, data:dados.data,
    observacao:dados.observacao||'',
    criadoEm:new Date().toISOString(),
  };
  const todos=indicadorTodos();
  todos.push(registro);
  indicadorSalvarTudo(todos);

  const pivo=horimetroPivoInfo(dados.pivoId), falha=indicadorFalhaInfo(dados.falhaId);
  auditLog('Indicadores','INCLUSÃO',`Pivô ${pivo?pivo.numero:'?'} — ${falha?falha.categoria+'/'+falha.motivo:'?'} — ${fmtD(dados.data)}`);
  return {ok:true,registro};
}

function indicadorAtualizar(grupoId,dados){
  const todos=indicadorTodos();
  const atual=todos.find(r=>r.grupoId===grupoId&&r.atual);
  if(!atual) return {ok:false,erros:['Ocorrência não encontrada.']};
  if(dataEhFutura(dados.data)&&!dados.dataFuturaAutorizada) return {ok:false,dataFuturaPendente:true};

  atual.atual=false;
  const nova={
    ...atual, id:gId(), versao:atual.versao+1, atual:true, status:'ativo',
    pivoId:dados.pivoId, falhaId:dados.falhaId, data:dados.data,
    observacao:dados.observacao||'',
    criadoEm:new Date().toISOString(),
  };
  todos.push(nova);
  indicadorSalvarTudo(todos);
  const pivo=horimetroPivoInfo(dados.pivoId);
  auditLog('Indicadores','ALTERAÇÃO',`Pivô ${pivo?pivo.numero:'?'} — versão ${nova.versao}`);
  return {ok:true,registro:nova};
}

function indicadorExcluir(grupoId){
  const todos=indicadorTodos();
  const atual=todos.find(r=>r.grupoId===grupoId&&r.atual);
  if(!atual) return {ok:false,erros:['Ocorrência não encontrada.']};
  atual.status='excluido';
  indicadorSalvarTudo(todos);
  const pivo=horimetroPivoInfo(atual.pivoId);
  auditLog('Indicadores','EXCLUSÃO',`Pivô ${pivo?pivo.numero:'?'} — ${fmtD(atual.data)}`);
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

/* Distribuição das falhas por categoria (para gráfico de pizza/barras). */
function indicadorDistribuicaoCategoria(ocorrencias){
  const arr=ocorrencias||indicadorAtivos();
  return agruparPorChave(arr,r=>{ const f=indicadorFalhaInfo(r.falhaId); return f?f.categoria:'Não classificado'; },()=>1);
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
