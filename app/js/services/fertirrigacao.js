/* ── SERVICES / FERTIRRIGAÇÃO ──────────────────────────────────────
   Única camada que lê/grava lançamentos de fertirrigação.

   Migração p/ Supabase (auditoria de sincronização, 2026-09-21): banco
   oficial passou a ser a tabela `ferti_lancamentos` (coi.*), no lugar do
   localStorage — mesmo padrão já usado pelo Horímetro (Fase 14): cache
   em memória (`_fertiCache`) sincronizado do Supabase em
   `fertiSyncCache()` (chamado no boot e após cada gravação); os READS
   continuam síncronos com a mesma assinatura de sempre, só as 3
   GRAVAÇÕES (Criar/Atualizar/Excluir) viram `async`.

   Produto/Categoria/Unidade continuam vindo do cadastro local
   (js/cadastro.js) — gravados como texto (nome/categoria), não FK,
   porque o cadastro de Produtos ainda não tem tabela própria no
   Supabase (ver comentário na migration 012_ferti_indicador.sql).

   Histórico é permanente: `fertiAtualizar` nunca sobrescreve um
   registro antigo, sempre cria nova versão (mesmo grupoId, versao+1) e
   marca a anterior como não-atual. `fertiExcluir` é soft-delete.
   ──────────────────────────────────────────────────────────────── */

let _fertiCache=[];
let _fertiSyncOk=false;

function fertiProdutoInfo(produtoId){
  return (cadAll('produtos')||[]).find(p=>p.id===produtoId)||null;
}

function _fertiRowToLocal(row){
  const pivoSup=_pivosSupabaseCache.find(p=>p.id===row.pivo_id);
  const pivoLocal=pivoSup?_pivoLocalPorNumero(pivoSup.numero):null;
  return {
    id:row.id, grupoId:row.grupo_id, versao:row.versao, atual:row.atual, status:row.status,
    pivoId:pivoLocal?pivoLocal.id:null, _pivoNumero:pivoSup?pivoSup.numero:null,
    data:row.data, horaInicial:row.hora_inicial||'', horaFinal:row.hora_final||'',
    tempoAplicacaoHoras:row.tempo_aplicacao_horas!=null?Number(row.tempo_aplicacao_horas):null,
    produtoNome:row.produto_nome||'', produtoCategoria:row.produto_categoria||'',
    /* produtoId: melhor esforço, resolvido pelo NOME contra o cadastro local
       (o banco guarda só o texto — ver comentário no topo do arquivo). Se o
       produto não existir no cadastro deste dispositivo (ou o nome mudou),
       fica null e as telas de edição mostram o combo vazio, sem quebrar. */
    produtoId:((cadAll('produtos')||[]).find(p=>p.nome===row.produto_nome)||{}).id||null,
    cultura:row.cultura||'', safra:row.safra||'',
    quantidadeAplicada:row.quantidade_aplicada!=null?Number(row.quantidade_aplicada):0,
    concentracao:row.concentracao!=null?Number(row.concentracao):null,
    volumeAgua:row.volume_agua!=null?Number(row.volume_agua):null,
    vazao:row.vazao!=null?Number(row.vazao):null,
    operador:row.operador||'', observacao:row.observacao||'', criadoEm:row.criado_em,
  };
}

/* Sincroniza o cache em memória com o banco oficial. Chamada 1x no boot
   (main.js) e novamente após cada gravação. */
async function fertiSyncCache(){
  if(typeof window.coiDB==='undefined'){ console.warn('[fertirrigação] Supabase não configurado — cache vazio.'); return false; }
  try{
    const data=await sbFetchAll((from,to)=>window.coiDB.schema('coi').from('ferti_lancamentos').select('*').order('criado_em',{ascending:true}).range(from,to));
    _fertiCache=data.map(_fertiRowToLocal);
    _fertiSyncOk=true;
    return true;
  }catch(err){
    console.error('[fertirrigação] Falha ao sincronizar com o Supabase:',err);
    _fertiSyncOk=false;
    return false;
  }
}

const fertiTodos = () => _fertiCache;
const fertiAtivos = () => fertiTodos().filter(r=>r.atual&&r.status==='ativo');

function _fertiDadosParaRow(dados,pivoSupabaseId,extra){
  const produto=fertiProdutoInfo(dados.produtoId);
  return {
    pivo_id:pivoSupabaseId, data:dados.data, hora_inicial:dados.horaInicial, hora_final:dados.horaFinal,
    tempo_aplicacao_horas:calcDuracaoHoras(dados.horaInicial,dados.horaFinal),
    produto_nome:produto?produto.nome:'', produto_categoria:produto?produto.categoria||'':'',
    cultura:dados.cultura||'', safra:dados.safra||'',
    quantidade_aplicada:Number(dados.quantidadeAplicada),
    concentracao:dados.concentracao!==''&&dados.concentracao!=null?Number(dados.concentracao):null,
    volume_agua:dados.volumeAgua!==''&&dados.volumeAgua!=null?Number(dados.volumeAgua):null,
    vazao:dados.vazao!==''&&dados.vazao!=null?Number(dados.vazao):null,
    operador:dados.operador||'', observacao:dados.observacao||'', origem:'app',
    ...extra,
  };
}

/* ── CRUD (grupoId/versao/atual, igual ao serviço de Horímetro) ───── */
async function fertiCriar(dados){
  const check=validarFertirrigacao(dados);
  if(!check.valido){
    if(check.erros.length===1&&check.erros[0]==='DATA_FUTURA') return {ok:false,dataFuturaPendente:true};
    return {ok:false,erros:check.erros.filter(e=>e!=='DATA_FUTURA')};
  }
  const pivo=horimetroPivoInfo(dados.pivoId);
  if(!pivo) return {ok:false,erros:['Pivô não encontrado no cadastro.']};

  let pivoSupabaseId;
  try{ pivoSupabaseId=await _pivoSupabaseIdPorNumero(pivo.numero); }
  catch(err){ return {ok:false,erros:['Falha ao conectar ao banco de fertirrigação: '+err.message]}; }

  const grupoId=(crypto&&crypto.randomUUID)?crypto.randomUUID():gId();
  const row=_fertiDadosParaRow(dados,pivoSupabaseId,{grupo_id:grupoId,versao:1,atual:true,status:'ativo'});
  const {data:inserted,error}=await window.coiDB.schema('coi').from('ferti_lancamentos').insert(row).select('*').single();
  if(error) return {ok:false,erros:['Falha ao gravar no banco: '+error.message]};

  const registro=_fertiRowToLocal(inserted);
  _fertiCache.push(registro);
  const produto=fertiProdutoInfo(dados.produtoId);
  auditLog('Fertirrigação','INCLUSÃO',`Pivô ${pivo.numero} — ${produto?produto.nome:'?'} — ${fmt(registro.quantidadeAplicada,1)}`);
  return {ok:true,registro};
}

async function fertiAtualizar(grupoId,dados){
  const atualLocal=fertiTodos().find(r=>r.grupoId===grupoId&&r.atual);
  if(!atualLocal) return {ok:false,erros:['Lançamento não encontrado.']};

  const check=validarFertirrigacao(dados);
  if(!check.valido){
    if(check.erros.length===1&&check.erros[0]==='DATA_FUTURA') return {ok:false,dataFuturaPendente:true};
    return {ok:false,erros:check.erros.filter(e=>e!=='DATA_FUTURA')};
  }
  const pivo=horimetroPivoInfo(dados.pivoId);
  if(!pivo) return {ok:false,erros:['Pivô não encontrado no cadastro.']};

  let pivoSupabaseId;
  try{ pivoSupabaseId=await _pivoSupabaseIdPorNumero(pivo.numero); }
  catch(err){ return {ok:false,erros:['Falha ao conectar ao banco de fertirrigação: '+err.message]}; }

  const {error:updErr}=await window.coiDB.schema('coi').from('ferti_lancamentos').update({atual:false}).eq('id',atualLocal.id);
  if(updErr) return {ok:false,erros:['Falha ao versionar registro anterior: '+updErr.message]};

  const row=_fertiDadosParaRow(dados,pivoSupabaseId,{grupo_id:grupoId,versao:atualLocal.versao+1,atual:true,status:'ativo'});
  const {data:inserted,error}=await window.coiDB.schema('coi').from('ferti_lancamentos').insert(row).select('*').single();
  if(error){
    const {error:revertErr}=await window.coiDB.schema('coi').from('ferti_lancamentos').update({atual:true}).eq('id',atualLocal.id);
    if(revertErr) console.error('[fertirrigação] Falha ao reverter atual=true após erro de gravação — grupo pode ter ficado sem versão atual:',grupoId,revertErr);
    return {ok:false,erros:['Falha ao gravar nova versão: '+error.message]};
  }

  atualLocal.atual=false;
  const registro=_fertiRowToLocal(inserted);
  _fertiCache.push(registro);
  const pivoInfo=horimetroPivoInfo(dados.pivoId);
  auditLog('Fertirrigação','ALTERAÇÃO',`Pivô ${pivoInfo?pivoInfo.numero:'?'} — versão ${registro.versao}`);
  return {ok:true,registro};
}

async function fertiExcluir(grupoId){
  const atualLocal=fertiTodos().find(r=>r.grupoId===grupoId&&r.atual);
  if(!atualLocal) return {ok:false,erros:['Lançamento não encontrado.']};

  const {error}=await window.coiDB.schema('coi').from('ferti_lancamentos').update({status:'excluido'}).eq('id',atualLocal.id);
  if(error) return {ok:false,erros:['Falha ao excluir: '+error.message]};

  atualLocal.status='excluido';
  const pivo=horimetroPivoInfo(atualLocal.pivoId);
  auditLog('Fertirrigação','EXCLUSÃO',`Pivô ${pivo?pivo.numero:'?'} — ${fmtD(atualLocal.data)}`);
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
   papel do `horimetroConsultar`/`paradaConsultar`. Filtro por produto
   agora compara pelo NOME (denormalizado), não mais por produtoId, já
   que o banco não guarda o id do cadastro local. */
function fertiConsultar(filtros){
  const f=filtros||{};
  const pivosPorFiltro=(f.fazendaId||f.casaBombaId)?new Set((cadAll('pivos')||[])
    .filter(p=>(!f.fazendaId||p.fazendaId===f.fazendaId)&&(!f.casaBombaId||p.casaBombaId===f.casaBombaId))
    .map(p=>p.id)):null;
  const produtoFiltro=f.produtoId?fertiProdutoInfo(f.produtoId):null;

  return fertiAtivos().filter(r=>{
    if(f.dataInicio&&r.data<f.dataInicio) return false;
    if(f.dataFim&&r.data>f.dataFim) return false;
    if(f.pivoId&&r.pivoId!==f.pivoId) return false;
    if(pivosPorFiltro&&!pivosPorFiltro.has(r.pivoId)) return false;
    if(f.cultura&&r.cultura!==f.cultura) return false;
    if(f.safra&&r.safra!==f.safra) return false;
    if(f.operador&&r.operador!==f.operador) return false;
    if(produtoFiltro&&r.produtoNome!==produtoFiltro.nome) return false;
    return true;
  });
}

/* ── AGRUPAMENTOS (todos via agruparPorChave, nenhum laço repetido) ── */
function fertiProdutosMaisUtilizados(lancamentos){
  return agruparPorChave(lancamentos||fertiAtivos(),r=>r.produtoNome||'Não informado',r=>r.quantidadeAplicada||0)
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
