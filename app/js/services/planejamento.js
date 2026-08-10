/* ── SERVICES / PLANEJAMENTO ───────────────────────────────────────
   Única camada que lê/grava o planejamento de irrigação — o que DEVE
   ser irrigado, em contraste com o Horímetro (o que FOI irrigado de
   fato). Mesmo padrão de histórico permanente dos demais serviços.
   Alimentado manualmente (Ponto 5, marcar Não Feito) ou em lote pela
   Importação de Planejamento (js/services/importacao.js) — a
   importação nunca grava direto, sempre passa por aqui.

   Diferença importante de regra (inalterada): data de planejamento é
   esperada ser hoje/futura (é um plano), então NÃO usa o gate de "data
   futura" dos demais serviços (Horímetro/Parada/Ferti).

   Fase 18 — mesmo padrão de Horímetro/Paradas/Calibração: banco oficial
   passou a ser o Supabase (tabela `planejamento_lancamentos`, ver
   scratchpad/schema_planejamento.sql). Só a CAMADA DE ACESSO mudou —
   `planejamentoValidar`/`planejamentoResumo`/`planejamentoStatusExecucao`
   continuam exatamente as mesmas regras/fórmulas de antes, agora lendo
   de um cache sincronizado do Supabase em vez do localStorage.
   ──────────────────────────────────────────────────────────────── */

let _planejamentoCache=[];

function _planejamentoRowToLocal(row,pivosSupabase){
  const pivoSup=pivosSupabase.find(p=>p.id===row.pivo_id);
  const pivoLocal=pivoSup?_pivoLocalPorNumero(pivoSup.numero):null;
  return {
    id:row.id, grupoId:row.grupo_id, versao:row.versao, atual:row.atual, status:row.status,
    pivoId:pivoLocal?pivoLocal.id:null, _pivoNumero:pivoSup?pivoSup.numero:null,
    data:row.data, percentual:Number(row.percentual),
    cultura:row.cultura||'', areaPivo:row.area_pivo||'COMPLETO', observacao:row.observacao||'',
    naoFeito:!!row.nao_feito, motivoNaoFeito:row.motivo_nao_feito||'',
    criadoEm:row.criado_em,
  };
}

async function planejamentoSyncCache(){
  if(typeof window.coiDB==='undefined'){ console.warn('[planejamento] Supabase não configurado — cache vazio.'); return false; }
  try{
    if(!_pivosSupabaseCache.length){
      const {data:pivosData,error:pErr}=await window.coiDB.schema('coi').from('pivos').select('id,numero');
      if(pErr) throw pErr;
      _pivosSupabaseCache=pivosData||[];
    }
    const {data,error}=await window.coiDB.schema('coi').from('planejamento_lancamentos').select('*').order('criado_em',{ascending:true});
    if(error) throw error;
    _planejamentoCache=(data||[]).map(r=>_planejamentoRowToLocal(r,_pivosSupabaseCache));
    return true;
  }catch(err){
    console.error('[planejamento] Falha ao sincronizar com o Supabase:',err);
    return false;
  }
}

const planejamentoTodos = () => _planejamentoCache;
const planejamentoAtivos = () => planejamentoTodos().filter(r=>r.atual&&r.status==='ativo');

/* Regra de validação — INALTERADA. */
function planejamentoValidar(dados,contexto){
  const erros=[];
  if(!dados.pivoId) erros.push('Selecione um pivô.');
  if(!dados.data) erros.push('Informe a data.');
  if(!percentualValido(dados.percentual)) erros.push('Percentual deve ser um número entre 1 e 100.');
  if(contexto&&contexto.duplicado) erros.push('Já existe planejamento para este pivô nesta data.');
  return {valido:erros.length===0,erros};
}

function _planejamentoDadosParaRow(dados,pivoSupabaseId,extra){
  return {
    pivo_id:pivoSupabaseId, data:dados.data, percentual:Number(dados.percentual),
    cultura:dados.cultura||'', area_pivo:dados.areaPivo||'COMPLETO', observacao:dados.observacao||'',
    nao_feito:dados.naoFeito||false, motivo_nao_feito:dados.naoFeito?(dados.motivoNaoFeito||''):'',
    origem:'app',
    ...extra,
  };
}

/* ── CRUD (grupoId/versao/atual, igual aos demais serviços) ───────── */
async function planejamentoCriar(dados){
  const duplicado=planejamentoAtivos().some(r=>r.pivoId===dados.pivoId&&r.data===dados.data);
  const check=planejamentoValidar(dados,{duplicado});
  if(!check.valido) return {ok:false,erros:check.erros};

  const pivo=horimetroPivoInfo(dados.pivoId);
  if(!pivo) return {ok:false,erros:['Pivô não encontrado no cadastro.']};
  let pivoSupabaseId;
  try{ pivoSupabaseId=await _pivoSupabaseIdPorNumero(pivo.numero); }
  catch(err){ return {ok:false,erros:['Falha ao conectar ao banco de planejamento: '+err.message]}; }

  const grupoId=(crypto&&crypto.randomUUID)?crypto.randomUUID():gId();
  const row=_planejamentoDadosParaRow(dados,pivoSupabaseId,{grupo_id:grupoId,versao:1,atual:true,status:'ativo'});
  const {data:inserted,error}=await window.coiDB.schema('coi').from('planejamento_lancamentos').insert(row).select('*').single();
  if(error) return {ok:false,erros:['Falha ao gravar no banco: '+error.message]};

  const registro=_planejamentoRowToLocal(inserted,_pivosSupabaseCache);
  _planejamentoCache.push(registro);
  auditLog('Planejamento','INCLUSÃO',`Pivô ${pivo.numero} — ${fmtD(dados.data)}`,{registro:registro.grupoId,valorNovo:`${dados.percentual}%`});
  return {ok:true,registro};
}

async function planejamentoAtualizar(grupoId,dados){
  const atualLocal=planejamentoTodos().find(r=>r.grupoId===grupoId&&r.atual);
  if(!atualLocal) return {ok:false,erros:['Planejamento não encontrado.']};

  const duplicado=planejamentoAtivos().some(r=>r.grupoId!==grupoId&&r.pivoId===dados.pivoId&&r.data===dados.data);
  const check=planejamentoValidar(dados,{duplicado});
  if(!check.valido) return {ok:false,erros:check.erros};

  const pivo=horimetroPivoInfo(dados.pivoId);
  if(!pivo) return {ok:false,erros:['Pivô não encontrado no cadastro.']};
  let pivoSupabaseId;
  try{ pivoSupabaseId=await _pivoSupabaseIdPorNumero(pivo.numero); }
  catch(err){ return {ok:false,erros:['Falha ao conectar ao banco de planejamento: '+err.message]}; }

  const statusAnterior=atualLocal.naoFeito?`não feito (${atualLocal.motivoNaoFeito||'—'})`:`${atualLocal.percentual}%`;

  const {error:updErr}=await window.coiDB.schema('coi').from('planejamento_lancamentos').update({atual:false}).eq('id',atualLocal.id);
  if(updErr) return {ok:false,erros:['Falha ao versionar registro anterior: '+updErr.message]};

  const row=_planejamentoDadosParaRow(dados,pivoSupabaseId,{grupo_id:grupoId,versao:atualLocal.versao+1,atual:true,status:'ativo'});
  const {data:inserted,error}=await window.coiDB.schema('coi').from('planejamento_lancamentos').insert(row).select('*').single();
  if(error){
    await window.coiDB.schema('coi').from('planejamento_lancamentos').update({atual:true}).eq('id',atualLocal.id);
    return {ok:false,erros:['Falha ao gravar nova versão: '+error.message]};
  }

  atualLocal.atual=false;
  const registro=_planejamentoRowToLocal(inserted,_pivosSupabaseCache);
  _planejamentoCache.push(registro);
  const statusNovo=registro.naoFeito?`não feito (${registro.motivoNaoFeito||'—'})`:`${registro.percentual}%`;
  auditLog('Planejamento','ALTERAÇÃO',`Pivô ${pivo.numero} — versão ${registro.versao}`,{
    registro:grupoId, valorAnterior:statusAnterior, valorNovo:statusNovo,
  });
  return {ok:true,registro};
}

async function planejamentoExcluir(grupoId){
  const atualLocal=planejamentoTodos().find(r=>r.grupoId===grupoId&&r.atual);
  if(!atualLocal) return {ok:false,erros:['Planejamento não encontrado.']};

  const {error}=await window.coiDB.schema('coi').from('planejamento_lancamentos').update({status:'excluido'}).eq('id',atualLocal.id);
  if(error) return {ok:false,erros:['Falha ao excluir: '+error.message]};

  atualLocal.status='excluido';
  const pivo=horimetroPivoInfo(atualLocal.pivoId);
  auditLog('Planejamento','EXCLUSÃO',`Pivô ${pivo?pivo.numero:'?'} — ${fmtD(atualLocal.data)}`,{registro:grupoId});
  return {ok:true};
}

function planejamentoHistoricoVersoes(grupoId){
  return planejamentoTodos().filter(r=>r.grupoId===grupoId).sort((a,b)=>a.versao-b.versao);
}

/* Ponto 5 — marca um planejamento como NÃO FEITO com motivo obrigatório.
   Regra INALTERADA: gera nova versão via planejamentoAtualizar (mesmo
   histórico permanente); não exige horímetro nem hora. */
async function planejamentoMarcarNaoFeito(grupoId,motivo){
  if(!motivo||!motivo.trim()) return {ok:false,erros:['Informe o motivo do não cumprimento.']};
  const atual=planejamentoTodos().find(r=>r.grupoId===grupoId&&r.atual);
  if(!atual) return {ok:false,erros:['Planejamento não encontrado.']};
  return planejamentoAtualizar(grupoId,{...atual,naoFeito:true,motivoNaoFeito:motivo.trim()});
}

async function planejamentoDesmarcarNaoFeito(grupoId){
  const atual=planejamentoTodos().find(r=>r.grupoId===grupoId&&r.atual);
  if(!atual) return {ok:false,erros:['Planejamento não encontrado.']};
  return planejamentoAtualizar(grupoId,{...atual,naoFeito:false,motivoNaoFeito:''});
}

/* Status de execução — regra INALTERADA (feito tem prioridade sobre naoFeito). */
function planejamentoStatusExecucao(p,executadosSet){
  const feito=(executadosSet||new Set(horimetroConsultar({dataInicio:p.data,dataFim:p.data}).map(r=>r.pivoId+'_'+r.data))).has(p.pivoId+'_'+p.data);
  if(feito) return 'feito';
  if(p.naoFeito) return 'nao_feito';
  return 'pendente';
}

/* ── CONSULTAS — INALTERADAS ───────────────────────────────────────── */
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

/* Planejado × Executado real — fórmula INALTERADA. */
function planejamentoResumo(dataInicio,dataFim){
  const planejados=planejamentoConsultar({dataInicio,dataFim});
  const executados=new Set(horimetroConsultar({dataInicio,dataFim}).map(r=>r.pivoId+'_'+r.data));
  const feito=planejados.filter(p=>executados.has(p.pivoId+'_'+p.data)).length;
  const naoFeito=planejados.filter(p=>!executados.has(p.pivoId+'_'+p.data)&&p.naoFeito).length;
  const total=planejados.length;
  return {total,feito,naoFeito,pendente:total-feito-naoFeito,assertividade:total?+(feito/total*100).toFixed(1):0};
}
