/* ── SERVICES / CALIBRAÇÃO DE LÂMINA ───────────────────────────────
   Única camada que lê/grava calibrações de lâmina. Mesmo padrão de
   histórico permanente dos demais serviços — uma calibração corrigida
   nunca é sobrescrita, sempre vira nova versão.

   Ao salvar, atualiza automaticamente `laminaBase100` no cadastro do
   pivô (via `cadPatchRecord`, js/cadastro.js) — é esse campo que o
   Horímetro e a Fertirrigação já usam para os próprios cálculos
   (calcLamina), então não é preciso "avisar" ninguém.

   Fase 17 — mesmo padrão do Horímetro/Paradas: banco oficial passou a
   ser o Supabase (tabela `calibracoes_lancamentos`, ver
   scratchpad/schema_calibracao.sql). Leituras síncronas via cache em
   memória; as 3 gravações são `async`. Fonte de referência: BASE DE
   DADOS/LAMINA E HORA PIVÔS_Atualização.xlsx confirma a MESMA fórmula
   já usada aqui (lâmina a um percentual = lâmina base100 / (pct/100)) —
   nenhuma fórmula foi alterada.
   ──────────────────────────────────────────────────────────────── */

const METODOS_CALIBRACAO=['Teste de Campo (Coletor)','Cálculo Teórico','Fabricante','Outro'];

let _calibracaoCache=[];

function _calibracaoRowToLocal(row,pivosSupabase){
  const pivoSup=pivosSupabase.find(p=>p.id===row.pivo_id);
  const pivoLocal=pivoSup?_pivoLocalPorNumero(pivoSup.numero):null;
  return {
    id:row.id, grupoId:row.grupo_id, versao:row.versao, atual:row.atual, status:row.status,
    pivoId:pivoLocal?pivoLocal.id:null, _pivoNumero:pivoSup?pivoSup.numero:null,
    data:row.data, hora:row.hora||'',
    laminaMedida:Number(row.lamina_medida), percentualUtilizado:Number(row.percentual_utilizado),
    laminaCalculada100:Number(row.lamina_calculada_100),
    laminaAnterior:row.lamina_anterior!=null?Number(row.lamina_anterior):null,
    diferencaAnterior:row.diferenca_anterior!=null?Number(row.diferenca_anterior):null,
    percentualVariacao:row.percentual_variacao!=null?Number(row.percentual_variacao):null,
    operador:row.operador||'', responsavelCalibracao:row.responsavel_calibracao||'',
    metodoCalibracao:row.metodo_calibracao||METODOS_CALIBRACAO[0],
    observacoes:row.observacoes||'', criadoEm:row.criado_em,
  };
}

async function calibracaoSyncCache(){
  if(typeof window.coiDB==='undefined'){ console.warn('[calibracao] Supabase não configurado — cache vazio.'); return false; }
  try{
    if(!_pivosSupabaseCache.length){
      const {data:pivosData,error:pErr}=await window.coiDB.schema('coi').from('pivos').select('id,numero');
      if(pErr) throw pErr;
      _pivosSupabaseCache=pivosData||[];
    }
    const {data,error}=await window.coiDB.schema('coi').from('calibracoes_lancamentos').select('*').order('criado_em',{ascending:true});
    if(error) throw error;
    _calibracaoCache=(data||[]).map(r=>_calibracaoRowToLocal(r,_pivosSupabaseCache));
    return true;
  }catch(err){
    console.error('[calibracao] Falha ao sincronizar com o Supabase:',err);
    return false;
  }
}

const calibracaoTodos = () => _calibracaoCache;
const calibracaoAtivas = () => calibracaoTodos().filter(r=>r.atual&&r.status==='ativo');

function calibracaoPorPivo(pivoId){
  return calibracaoAtivas().filter(r=>r.pivoId===pivoId).sort((a,b)=>(a.data+a.hora).localeCompare(b.data+b.hora));
}
function calibracaoPorFazenda(fazendaId){
  const pivoIds=new Set((cadAll('pivos')||[]).filter(p=>p.fazendaId===fazendaId).map(p=>p.id));
  return calibracaoAtivas().filter(r=>pivoIds.has(r.pivoId));
}
/* Última calibração ATIVA de um pivô (mais recente por data+hora).
   `excluirGrupoId` tira o próprio registro da conta ao editar/excluir. */
function calibracaoUltimaDoPivo(pivoId,excluirGrupoId){
  const regs=calibracaoPorPivo(pivoId).filter(r=>r.grupoId!==excluirGrupoId);
  return regs.length?regs[regs.length-1]:null;
}

/* ── VALIDAÇÃO ────────────────────────────────────────────────────── */
function calibracaoValidar(dados){
  const erros=[];
  if(!dados.pivoId) erros.push('Selecione um pivô.');
  if(!dados.data) erros.push('Informe a data.');
  if(!dados.hora) erros.push('Informe a hora.');
  if(dados.laminaMedida===''||dados.laminaMedida==null) erros.push('Informe a lâmina medida.');
  if(!percentualValido(dados.percentualUtilizado)) erros.push('Percentual utilizado deve ser um número entre 1 e 100.');
  if(erros.length) return {valido:false,erros};

  if(!(Number(dados.laminaMedida)>0)) erros.push('Lâmina medida deve ser maior que 0.');
  return {valido:erros.length===0,erros};
}

/* Só atualiza o cadastro do pivô se esta calibração (nova ou corrigida)
   continuar sendo a mais recente dele — uma correção num registro antigo
   não deve sobrescrever um valor já superado por uma calibração mais nova. */
function calibracaoAtualizarPivoSeMaisRecente(pivoId,grupoId,laminaCalculada100){
  const maisRecente=calibracaoUltimaDoPivo(pivoId,null);
  if(!maisRecente||maisRecente.grupoId===grupoId){
    cadPatchRecord('pivos',pivoId,{laminaBase100:laminaCalculada100});
  }
}

function _calibracaoDadosParaRow(dados,laminaCalculada100,valorAnterior,variacao,pivoSupabaseId,extra){
  return {
    pivo_id:pivoSupabaseId, data:dados.data, hora:dados.hora,
    operador:dados.operador||'', responsavel_calibracao:dados.responsavelCalibracao||'',
    lamina_medida:Number(dados.laminaMedida), percentual_utilizado:Number(dados.percentualUtilizado),
    lamina_calculada_100:laminaCalculada100, lamina_anterior:valorAnterior,
    diferenca_anterior:variacao.diferenca, percentual_variacao:variacao.percentual,
    metodo_calibracao:dados.metodoCalibracao||METODOS_CALIBRACAO[0],
    observacoes:dados.observacoes||'', origem:'app',
    ...extra,
  };
}

/* ── CRUD ─────────────────────────────────────────────────────────── */
async function calibracaoCriar(dados){
  const check=calibracaoValidar(dados);
  if(!check.valido) return {ok:false,erros:check.erros};

  const laminaCalculada100=calcLaminaBase100(dados.percentualUtilizado,dados.laminaMedida);
  const pivo=horimetroPivoInfo(dados.pivoId);
  if(!pivo) return {ok:false,erros:['Pivô não encontrado no cadastro.']};
  const anterior=calibracaoUltimaDoPivo(dados.pivoId,null);
  const valorAnterior=anterior?anterior.laminaCalculada100:(pivo.laminaBase100??null);
  const variacao=calcVariacao(valorAnterior,laminaCalculada100);

  let pivoSupabaseId;
  try{ pivoSupabaseId=await _pivoSupabaseIdPorNumero(pivo.numero); }
  catch(err){ return {ok:false,erros:['Falha ao conectar ao banco de calibrações: '+err.message]}; }

  const grupoId=(crypto&&crypto.randomUUID)?crypto.randomUUID():gId();
  const row=_calibracaoDadosParaRow(dados,laminaCalculada100,valorAnterior,variacao,pivoSupabaseId,{grupo_id:grupoId,versao:1,atual:true,status:'ativo'});
  const {data:inserted,error}=await window.coiDB.schema('coi').from('calibracoes_lancamentos').insert(row).select('*').single();
  if(error) return {ok:false,erros:['Falha ao gravar no banco: '+error.message]};

  const registro=_calibracaoRowToLocal(inserted,_pivosSupabaseCache);
  _calibracaoCache.push(registro);
  cadPatchRecord('pivos',dados.pivoId,{laminaBase100:laminaCalculada100});
  auditLog('Calibração de Lâmina','INCLUSÃO',`Pivô ${pivo.numero}`,{
    registro:grupoId, valorAnterior:valorAnterior??'—', valorNovo:laminaCalculada100,
  });
  return {ok:true,registro};
}

async function calibracaoAtualizar(grupoId,dados){
  const atualLocal=calibracaoTodos().find(r=>r.grupoId===grupoId&&r.atual);
  if(!atualLocal) return {ok:false,erros:['Calibração não encontrada.']};

  const check=calibracaoValidar(dados);
  if(!check.valido) return {ok:false,erros:check.erros};

  const laminaCalculada100=calcLaminaBase100(dados.percentualUtilizado,dados.laminaMedida);
  const pivo=horimetroPivoInfo(dados.pivoId);
  if(!pivo) return {ok:false,erros:['Pivô não encontrado no cadastro.']};
  const anterior=calibracaoUltimaDoPivo(dados.pivoId,grupoId);
  const valorAnterior=anterior?anterior.laminaCalculada100:(pivo.laminaBase100??null);
  const variacao=calcVariacao(valorAnterior,laminaCalculada100);

  let pivoSupabaseId;
  try{ pivoSupabaseId=await _pivoSupabaseIdPorNumero(pivo.numero); }
  catch(err){ return {ok:false,erros:['Falha ao conectar ao banco de calibrações: '+err.message]}; }

  const {error:updErr}=await window.coiDB.schema('coi').from('calibracoes_lancamentos').update({atual:false}).eq('id',atualLocal.id);
  if(updErr) return {ok:false,erros:['Falha ao versionar registro anterior: '+updErr.message]};

  const row=_calibracaoDadosParaRow(dados,laminaCalculada100,valorAnterior,variacao,pivoSupabaseId,{grupo_id:grupoId,versao:atualLocal.versao+1,atual:true,status:'ativo'});
  const {data:inserted,error}=await window.coiDB.schema('coi').from('calibracoes_lancamentos').insert(row).select('*').single();
  if(error){
    await window.coiDB.schema('coi').from('calibracoes_lancamentos').update({atual:true}).eq('id',atualLocal.id);
    return {ok:false,erros:['Falha ao gravar nova versão: '+error.message]};
  }

  atualLocal.atual=false;
  const registro=_calibracaoRowToLocal(inserted,_pivosSupabaseCache);
  _calibracaoCache.push(registro);
  calibracaoAtualizarPivoSeMaisRecente(dados.pivoId,grupoId,laminaCalculada100);
  auditLog('Calibração de Lâmina','ALTERAÇÃO',`Pivô ${pivo.numero} — versão ${registro.versao}`,{
    registro:grupoId, valorAnterior:atualLocal.laminaCalculada100, valorNovo:laminaCalculada100,
  });
  return {ok:true,registro};
}

async function calibracaoExcluir(grupoId){
  const atualLocal=calibracaoTodos().find(r=>r.grupoId===grupoId&&r.atual);
  if(!atualLocal) return {ok:false,erros:['Calibração não encontrada.']};

  const eraAMaisRecente=(()=>{ const m=calibracaoUltimaDoPivo(atualLocal.pivoId,null); return m&&m.grupoId===grupoId; })();

  const {error}=await window.coiDB.schema('coi').from('calibracoes_lancamentos').update({status:'excluido'}).eq('id',atualLocal.id);
  if(error) return {ok:false,erros:['Falha ao excluir: '+error.message]};
  atualLocal.status='excluido';

  if(eraAMaisRecente){
    const novaMaisRecente=calibracaoUltimaDoPivo(atualLocal.pivoId,null);
    if(novaMaisRecente) cadPatchRecord('pivos',atualLocal.pivoId,{laminaBase100:novaMaisRecente.laminaCalculada100});
    // Se não havia calibração anterior, o cadastro do pivô mantém o valor
    // atual (não há como recuperar com segurança o valor pré-calibração).
  }
  const pivo=horimetroPivoInfo(atualLocal.pivoId);
  auditLog('Calibração de Lâmina','EXCLUSÃO',`Pivô ${pivo?pivo.numero:'?'} — ${fmtD(atualLocal.data)}`,{registro:grupoId});
  return {ok:true};
}

function calibracaoHistoricoVersoes(grupoId){
  return calibracaoTodos().filter(r=>r.grupoId===grupoId).sort((a,b)=>a.versao-b.versao);
}

/* ── DASHBOARD ────────────────────────────────────────────────────── */
function calibracaoUltimas(n){
  return calibracaoAtivas().slice().sort((a,b)=>(b.data+b.hora).localeCompare(a.data+a.hora)).slice(0,n||10);
}
function calibracaoPivosSemCalibracao(){
  const comCalibracao=new Set(calibracaoAtivas().map(r=>r.pivoId));
  return (cadAll('pivos')||[]).filter(p=>!comCalibracao.has(p.id));
}
function calibracaoVencidas(diasValidade){
  const limite=diasValidade||180;
  const hoje=new Date();
  return (cadAll('pivos')||[]).map(p=>{
    const ultima=calibracaoUltimaDoPivo(p.id,null);
    if(!ultima) return null;
    const dias=Math.round((hoje-new Date(ultima.data))/86400000);
    return dias>limite?{pivo:p,ultima,dias}:null;
  }).filter(Boolean);
}
function calibracaoEvolucaoPivo(pivoId){
  return calibracaoPorPivo(pivoId).map(r=>({data:r.data,laminaCalculada100:r.laminaCalculada100}));
}
