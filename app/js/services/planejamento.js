/* ── SERVICES / PLANEJAMENTO ───────────────────────────────────────
   Única camada que lê/grava o planejamento de irrigação (`coi_planejamento`)
   — o que DEVE ser irrigado, em contraste com o Horímetro (o que FOI
   irrigado de fato). Mesmo padrão de histórico permanente dos demais
   serviços. Alimentado manualmente (futura tela) ou em lote pela
   Importação de Planejamento (js/services/importacao.js) — a
   importação nunca grava direto no storage, sempre passa por aqui.

   Diferença importante de regra: data de planejamento é esperada ser
   hoje/futura (é um plano), então NÃO usa o gate de "data futura" dos
   demais serviços (Horímetro/Parada/Ferti), que registram o que já
   aconteceu.
   ──────────────────────────────────────────────────────────────── */

const PLANEJAMENTO_KEY='coi_planejamento';

const planejamentoTodos = () => lsGet(PLANEJAMENTO_KEY,[]);
const planejamentoSalvarTudo = arr => lsSet(PLANEJAMENTO_KEY,arr);
const planejamentoAtivos = () => planejamentoTodos().filter(r=>r.atual&&r.status==='ativo');

function planejamentoMontarRegistro(dados){
  return {
    pivoId:dados.pivoId, data:dados.data, percentual:Number(dados.percentual),
    cultura:dados.cultura||'', areaPivo:dados.areaPivo||'COMPLETO', observacao:dados.observacao||'',
  };
}

function planejamentoValidar(dados,contexto){
  const erros=[];
  if(!dados.pivoId) erros.push('Selecione um pivô.');
  if(!dados.data) erros.push('Informe a data.');
  if(!percentualValido(dados.percentual)) erros.push('Percentual deve ser um número entre 1 e 100.');
  if(contexto&&contexto.duplicado) erros.push('Já existe planejamento para este pivô nesta data.');
  return {valido:erros.length===0,erros};
}

/* ── CRUD (grupoId/versao/atual, igual aos demais serviços) ───────── */
function planejamentoCriar(dados){
  const duplicado=planejamentoAtivos().some(r=>r.pivoId===dados.pivoId&&r.data===dados.data);
  const check=planejamentoValidar(dados,{duplicado});
  if(!check.valido) return {ok:false,erros:check.erros};

  const id=gId();
  const registro={id,grupoId:id,versao:1,atual:true,status:'ativo',...planejamentoMontarRegistro(dados),criadoEm:new Date().toISOString()};
  const todos=planejamentoTodos();
  todos.push(registro);
  planejamentoSalvarTudo(todos);

  const pivo=horimetroPivoInfo(dados.pivoId);
  auditLog('Planejamento','INCLUSÃO',`Pivô ${pivo?pivo.numero:'?'} — ${fmtD(dados.data)} — ${dados.percentual}%`);
  return {ok:true,registro};
}

function planejamentoAtualizar(grupoId,dados){
  const todos=planejamentoTodos();
  const atual=todos.find(r=>r.grupoId===grupoId&&r.atual);
  if(!atual) return {ok:false,erros:['Planejamento não encontrado.']};

  const duplicado=planejamentoAtivos().some(r=>r.grupoId!==grupoId&&r.pivoId===dados.pivoId&&r.data===dados.data);
  const check=planejamentoValidar(dados,{duplicado});
  if(!check.valido) return {ok:false,erros:check.erros};

  atual.atual=false;
  const nova={...atual,id:gId(),versao:atual.versao+1,atual:true,status:'ativo',...planejamentoMontarRegistro(dados),criadoEm:new Date().toISOString()};
  todos.push(nova);
  planejamentoSalvarTudo(todos);
  const pivo=horimetroPivoInfo(dados.pivoId);
  auditLog('Planejamento','ALTERAÇÃO',`Pivô ${pivo?pivo.numero:'?'} — versão ${nova.versao}`);
  return {ok:true,registro:nova};
}

function planejamentoExcluir(grupoId){
  const todos=planejamentoTodos();
  const atual=todos.find(r=>r.grupoId===grupoId&&r.atual);
  if(!atual) return {ok:false,erros:['Planejamento não encontrado.']};
  atual.status='excluido';
  planejamentoSalvarTudo(todos);
  const pivo=horimetroPivoInfo(atual.pivoId);
  auditLog('Planejamento','EXCLUSÃO',`Pivô ${pivo?pivo.numero:'?'} — ${fmtD(atual.data)}`);
  return {ok:true};
}

function planejamentoHistoricoVersoes(grupoId){
  return planejamentoTodos().filter(r=>r.grupoId===grupoId).sort((a,b)=>a.versao-b.versao);
}

/* ── CONSULTAS ────────────────────────────────────────────────────── */
function planejamentoPorPivo(pivoId){
  return planejamentoAtivos().filter(r=>r.pivoId===pivoId).sort((a,b)=>a.data.localeCompare(b.data));
}
function planejamentoPorFazenda(fazendaId){
  const pivoIds=new Set((cadAll('pivos')||[]).filter(p=>p.fazendaId===fazendaId).map(p=>p.id));
  return planejamentoAtivos().filter(r=>pivoIds.has(r.pivoId));
}
function planejamentoConsultar(filtros){
  const f=filtros||{};
  const pivosPorFiltro=(f.fazendaId||f.casaBombaId)?new Set((cadAll('pivos')||[])
    .filter(p=>(!f.fazendaId||p.fazendaId===f.fazendaId)&&(!f.casaBombaId||p.casaBombaId===f.casaBombaId))
    .map(p=>p.id)):null;
  return planejamentoAtivos().filter(r=>{
    if(f.dataInicio&&r.data<f.dataInicio) return false;
    if(f.dataFim&&r.data>f.dataFim) return false;
    if(f.pivoId&&r.pivoId!==f.pivoId) return false;
    if(pivosPorFiltro&&!pivosPorFiltro.has(r.pivoId)) return false;
    if(f.cultura&&r.cultura!==f.cultura) return false;
    return true;
  });
}

/* Planejado × Executado real: cruza o planejamento com os lançamentos de
   Horímetro (mesmo pivô + mesma data = "feito"). Alimenta o dashboard
   Planejado × Executado (js/render.js) sem duplicar a consulta de cada
   serviço — só junta os dois resultados. */
function planejamentoResumo(dataInicio,dataFim){
  const planejados=planejamentoConsultar({dataInicio,dataFim});
  const executados=new Set(horimetroConsultar({dataInicio,dataFim}).map(r=>r.pivoId+'_'+r.data));
  const feito=planejados.filter(p=>executados.has(p.pivoId+'_'+p.data)).length;
  const total=planejados.length;
  return {total,feito,pendente:total-feito,assertividade:total?+(feito/total*100).toFixed(1):0};
}
