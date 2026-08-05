/* ── SERVICES / FERTIRRIGAÇÃO ──────────────────────────────────────
   Única camada que lê/grava lançamentos de fertirrigação (`coi_ferti`).
   Mesmo padrão de histórico permanente dos demais serviços (Horímetro/
   Indicadores/Paradas): grupoId/versao/atual + soft-delete, auditoria
   automática, e nenhuma regra de cálculo/validação reescrita — tudo
   vem de js/services/calculos.js e js/services/validacoes.js.

   Produto/Categoria/Unidade vêm do cadastro (js/cadastro.js) — nunca
   listas fixas aqui.
   ──────────────────────────────────────────────────────────────── */

const FERTI_KEY='coi_ferti';

const fertiTodos = () => lsGet(FERTI_KEY,[]);
const fertiSalvarTudo = arr => lsSet(FERTI_KEY,arr);
const fertiAtivos = () => fertiTodos().filter(r=>r.atual&&r.status==='ativo');

function fertiProdutoInfo(produtoId){
  return (cadAll('produtos')||[]).find(p=>p.id===produtoId)||null;
}

/* ── CRUD (grupoId/versao/atual, igual aos demais serviços) ───────── */
function fertiMontarRegistro(dados){
  return {
    pivoId:dados.pivoId, produtoId:dados.produtoId, cultura:dados.cultura, safra:dados.safra||'',
    data:dados.data, horaInicial:dados.horaInicial, horaFinal:dados.horaFinal,
    tempoAplicacaoHoras:calcDuracaoHoras(dados.horaInicial,dados.horaFinal),
    quantidadeAplicada:Number(dados.quantidadeAplicada),
    concentracao:dados.concentracao!==''&&dados.concentracao!=null?Number(dados.concentracao):null,
    volumeAgua:dados.volumeAgua!==''&&dados.volumeAgua!=null?Number(dados.volumeAgua):null,
    vazao:dados.vazao!==''&&dados.vazao!=null?Number(dados.vazao):null,
    operador:dados.operador||'', observacao:dados.observacao||'',
  };
}

function fertiCriar(dados){
  const check=validarFertirrigacao(dados);
  if(!check.valido){
    if(check.erros.length===1&&check.erros[0]==='DATA_FUTURA') return {ok:false,dataFuturaPendente:true};
    return {ok:false,erros:check.erros.filter(e=>e!=='DATA_FUTURA')};
  }
  const id=gId();
  const registro={id,grupoId:id,versao:1,atual:true,status:'ativo',...fertiMontarRegistro(dados),criadoEm:new Date().toISOString()};
  const todos=fertiTodos();
  todos.push(registro);
  fertiSalvarTudo(todos);

  const pivo=horimetroPivoInfo(dados.pivoId), produto=fertiProdutoInfo(dados.produtoId);
  auditLog('Fertirrigação','INCLUSÃO',`Pivô ${pivo?pivo.numero:'?'} — ${produto?produto.nome:'?'} — ${fmt(registro.quantidadeAplicada,1)}`);
  return {ok:true,registro};
}

function fertiAtualizar(grupoId,dados){
  const todos=fertiTodos();
  const atual=todos.find(r=>r.grupoId===grupoId&&r.atual);
  if(!atual) return {ok:false,erros:['Lançamento não encontrado.']};

  const check=validarFertirrigacao(dados);
  if(!check.valido){
    if(check.erros.length===1&&check.erros[0]==='DATA_FUTURA') return {ok:false,dataFuturaPendente:true};
    return {ok:false,erros:check.erros.filter(e=>e!=='DATA_FUTURA')};
  }

  atual.atual=false;
  const nova={...atual,id:gId(),versao:atual.versao+1,atual:true,status:'ativo',...fertiMontarRegistro(dados),criadoEm:new Date().toISOString()};
  todos.push(nova);
  fertiSalvarTudo(todos);
  const pivo=horimetroPivoInfo(dados.pivoId);
  auditLog('Fertirrigação','ALTERAÇÃO',`Pivô ${pivo?pivo.numero:'?'} — versão ${nova.versao}`);
  return {ok:true,registro:nova};
}

function fertiExcluir(grupoId){
  const todos=fertiTodos();
  const atual=todos.find(r=>r.grupoId===grupoId&&r.atual);
  if(!atual) return {ok:false,erros:['Lançamento não encontrado.']};
  atual.status='excluido';
  fertiSalvarTudo(todos);
  const pivo=horimetroPivoInfo(atual.pivoId);
  auditLog('Fertirrigação','EXCLUSÃO',`Pivô ${pivo?pivo.numero:'?'} — ${fmtD(atual.data)}`);
  return {ok:true};
}

function fertiHistoricoVersoes(grupoId){
  return fertiTodos().filter(r=>r.grupoId===grupoId).sort((a,b)=>a.versao-b.versao);
}

/* ── CONSULTAS ────────────────────────────────────────────────────── */
function fertiPorPivo(pivoId){
  return fertiAtivos().filter(r=>r.pivoId===pivoId).sort((a,b)=>a.data.localeCompare(b.data));
}
function fertiPorFazenda(fazendaId){
  const pivoIds=new Set((cadAll('pivos')||[]).filter(p=>p.fazendaId===fazendaId).map(p=>p.id));
  return fertiAtivos().filter(r=>pivoIds.has(r.pivoId));
}
function fertiPorCasaBomba(casaBombaId){
  const pivoIds=new Set((cadAll('pivos')||[]).filter(p=>p.casaBombaId===casaBombaId).map(p=>p.id));
  return fertiAtivos().filter(r=>pivoIds.has(r.pivoId));
}

/* Consulta única e flexível (período/fazenda/casa de bomba/pivô/cultura/
   safra/operador/produto) — preparada para o módulo de Relatórios, mesmo
   papel do `horimetroConsultar`/`paradaConsultar`. */
function fertiConsultar(filtros){
  const f=filtros||{};
  const pivosPorFiltro=(f.fazendaId||f.casaBombaId)?new Set((cadAll('pivos')||[])
    .filter(p=>(!f.fazendaId||p.fazendaId===f.fazendaId)&&(!f.casaBombaId||p.casaBombaId===f.casaBombaId))
    .map(p=>p.id)):null;

  return fertiAtivos().filter(r=>{
    if(f.dataInicio&&r.data<f.dataInicio) return false;
    if(f.dataFim&&r.data>f.dataFim) return false;
    if(f.pivoId&&r.pivoId!==f.pivoId) return false;
    if(pivosPorFiltro&&!pivosPorFiltro.has(r.pivoId)) return false;
    if(f.cultura&&r.cultura!==f.cultura) return false;
    if(f.safra&&r.safra!==f.safra) return false;
    if(f.operador&&r.operador!==f.operador) return false;
    if(f.produtoId&&r.produtoId!==f.produtoId) return false;
    return true;
  });
}

/* Indicadores do dia/semana/mês usam `fertiConsultar({dataInicio,dataFim})`
   diretamente (ver js/render.js) em vez de funções dedicadas — evita ter
   duas formas de filtrar por período no mesmo serviço. */

/* ── AGRUPAMENTOS (todos via agruparPorChave, nenhum laço repetido) ── */
function fertiProdutosMaisUtilizados(lancamentos){
  return agruparPorChave(lancamentos||fertiAtivos(),r=>{ const p=fertiProdutoInfo(r.produtoId); return p?p.nome:'Não informado'; },r=>r.quantidadeAplicada||0)
    .sort((a,b)=>b.valor-a.valor).map(r=>({produto:r.chave,quantidade:r.valor}));
}
function fertiPorPivoResumo(lancamentos){
  return agruparPorChave(lancamentos||fertiAtivos(),r=>r.pivoId,r=>r.quantidadeAplicada||0)
    .map(r=>{ const p=horimetroPivoInfo(r.chave); return {pivo:p?'P.'+p.numero:'?',quantidade:r.valor}; })
    .sort((a,b)=>b.quantidade-a.quantidade);
}
function fertiPorFazendaResumo(lancamentos){
  return agruparPorChave(lancamentos||fertiAtivos(),r=>{ const p=horimetroPivoInfo(r.pivoId); return p?p.fazendaId:null; },r=>r.quantidadeAplicada||0)
    .map(r=>({fazenda:cadLookupLabel('fazendas',r.chave),quantidade:r.valor}));
}
function fertiPorCultura(lancamentos){
  return agruparPorChave(lancamentos||fertiAtivos(),r=>r.cultura,r=>r.quantidadeAplicada||0)
    .map(r=>({cultura:r.chave,quantidade:r.valor})).sort((a,b)=>b.quantidade-a.quantidade);
}
function fertiPorSafraResumo(lancamentos){
  return agruparPorSafra(lancamentos||fertiAtivos(),'quantidadeAplicada').map(r=>({safra:r.safra,quantidade:r.horas}));
}
function fertiPorOperador(lancamentos){
  return agruparPorChave(lancamentos||fertiAtivos(),r=>r.operador||'Não informado',r=>r.quantidadeAplicada||0)
    .map(r=>({operador:r.chave,quantidade:r.valor})).sort((a,b)=>b.quantidade-a.quantidade);
}

/* ── RESUMO POR PIVÔ (histórico completo, linha do tempo, etc.) ───── */
function fertiResumoPivo(pivoId){
  const regs=fertiPorPivo(pivoId);
  return {
    quantidadeAcumulada:calcAcumulado(regs,'quantidadeAplicada'),
    frequencia:regs.length,
    mediaPorAplicacao:regs.length?+(calcAcumulado(regs,'quantidadeAplicada')/regs.length).toFixed(2):0,
    mediaDiaria:calcMediaDiaria(regs,'quantidadeAplicada'),
    mediaMensal:calcMediaMensal(regs,'quantidadeAplicada'),
    porMes:agruparPorMes(regs,'quantidadeAplicada'),
    porProduto:fertiProdutosMaisUtilizados(regs),
    porCultura:fertiPorCultura(regs),
    porSafra:fertiPorSafraResumo(regs),
    linhaDoTempo:regs.map(r=>({data:r.data,quantidade:r.quantidadeAplicada})),
  };
}
