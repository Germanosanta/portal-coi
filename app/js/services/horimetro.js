/* ── SERVICES / HORÍMETRO ──────────────────────────────────────────
   Única camada que lê/grava lançamentos de horímetro. As telas (js/lanc.js)
   NUNCA acessam o banco diretamente — só chamam as funções daqui.

   Fase 14 — banco oficial passou a ser o Supabase (tabelas `pivos` e
   `horimetro_lancamentos`, ver scratchpad/schema_horimetro.sql), no lugar
   do localStorage. Para não reescrever as ~20 telas que chamam
   `horimetroAtivos()`/`horimetroConsultar()`/etc. de forma síncrona,
   mantém-se um cache em memória (`_horimetroCache`) sincronizado do
   Supabase em `horimetroSyncCache()` (chamado 1x no boot, em main.js, e
   depois de cada gravação) — os READS continuam síncronos e com a mesma
   assinatura de sempre; só as 3 GRAVAÇÕES (Criar/Atualizar/Excluir) viram
   `async` porque dependem de uma ida real ao banco.

   Histórico é permanente: `horimetroAtualizar` nunca sobrescreve um
   registro antigo, sempre cria uma nova versão (mesmo `grupoId`, `versao`
   +1) e marca a anterior como não-atual. `horimetroExcluir` é um soft-
   delete (`status:'excluido'`) — o registro nunca é removido do banco.
   Toda inclusão/alteração/exclusão grava em auditoria (js/audit.js).

   Pivô: o cadastro de pivôs (js/cadastro.js, `cad_pivos`) ainda é local
   (migração do módulo de Cadastros é uma etapa própria, não desta) — o elo
   entre o `id` local do pivô e o `pivos.id` (uuid) do Supabase é o
   NÚMERO do pivô (`numero`), que é único nos dois lados. Pivôs que só
   existem no histórico importado do Supabase e ainda não foram
   cadastrados localmente aparecem com pivoId nulo (telas já tratam
   pivô ausente mostrando "P.?", nenhuma tela quebra por isso).
   ──────────────────────────────────────────────────────────────── */

let _horimetroCache=[];
let _pivosSupabaseCache=[];
let _horimetroSyncOk=false;

function _pivoLocalPorNumero(numero){
  return (typeof cadAll==='function'?(cadAll('pivos')||[]):[]).find(p=>Number(p.numero)===Number(numero))||null;
}

function _rowToLocal(row){
  const pivoSup=_pivosSupabaseCache.find(p=>p.id===row.pivo_id);
  const pivoLocal=pivoSup?_pivoLocalPorNumero(pivoSup.numero):null;
  return {
    id:row.id, grupoId:row.grupo_id, versao:row.versao, atual:row.atual, status:row.status,
    pivoId:pivoLocal?pivoLocal.id:null, _pivoNumero:pivoSup?pivoSup.numero:null,
    data:row.data, horaInicio:row.hora_inicio||'',
    horimetroInicial:Number(row.horimetro_inicial), horimetroFinal:Number(row.horimetro_final),
    horas:row.horas!=null?Number(row.horas):null, percentual:row.percentual!=null?Number(row.percentual):null,
    lamina:row.lamina!=null?Number(row.lamina):null,
    pressao:row.pressao!=null?Number(row.pressao):null,
    horasOciosas:row.horas_ociosas!=null?Number(row.horas_ociosas):null,
    cultura:row.cultura||'', areaPivo:row.area_pivo||'COMPLETO', operador:row.operador||'',
    observacao:row.observacao||'', safra:row.safra||'', criadoEm:row.criado_em,
  };
}

/* Garante que existe uma linha em `pivos` (Supabase) para este número de
   pivô, criando se ainda não existir — nunca duplica (numero é unique). */
async function _pivoSupabaseIdPorNumero(numero){
  const existente=_pivosSupabaseCache.find(p=>Number(p.numero)===Number(numero));
  if(existente) return existente.id;
  const {data,error}=await window.coiDB.schema('coi').from('pivos').select('id,numero').eq('numero',numero).maybeSingle();
  if(error) throw error;
  if(data){ _pivosSupabaseCache.push(data); return data.id; }
  const ins=await window.coiDB.schema('coi').from('pivos').insert({numero}).select('id,numero').single();
  if(ins.error) throw ins.error;
  _pivosSupabaseCache.push(ins.data);
  return ins.data.id;
}

/* Sincroniza o cache em memória com o banco oficial (Supabase). Chamada
   1x no boot (main.js, depois de cadSeedIfEmpty) e novamente após cada
   gravação — nunca inventa dado local, sempre relê do banco. */
async function horimetroSyncCache(){
  if(typeof window.coiDB==='undefined'){ console.warn('[horimetro] Supabase não configurado — cache vazio.'); return false; }
  try{
    const {data:pivosData,error:pErr}=await window.coiDB.schema('coi').from('pivos').select('id,numero');
    if(pErr) throw pErr;
    _pivosSupabaseCache=pivosData||[];

    const {data,error}=await window.coiDB.schema('coi').from('horimetro_lancamentos').select('*').order('criado_em',{ascending:true});
    if(error) throw error;
    _horimetroCache=(data||[]).map(_rowToLocal);
    _horimetroSyncOk=true;
    return true;
  }catch(err){
    console.error('[horimetro] Falha ao sincronizar com o Supabase:',err);
    _horimetroSyncOk=false;
    return false;
  }
}

const horimetroTodos = () => _horimetroCache;

/* Visão "atual": só a versão vigente de cada lançamento, excluindo
   os marcados como excluídos. É o que Dashboard/Relatórios/Histórico
   devem usar — nunca ler `horimetroTodos()` diretamente para exibir dados. */
function horimetroAtivos(){
  return horimetroTodos().filter(r=>r.atual&&r.status==='ativo');
}

function horimetroPivoInfo(pivoId){
  return (cadAll('pivos')||[]).find(p=>p.id===pivoId)||null;
}

/* Último lançamento ativo de um pivô (o mais recente por data), usado para
   auto-preencher o Horímetro Inicial e para impedir retrocesso do
   horímetro acumulado. `excluirGrupoId` tira o próprio registro da conta
   ao editar (senão uma correção sempre "colidiria" consigo mesma). */
function horimetroUltimoDoPivo(pivoId,excluirGrupoId){
  const regs=horimetroAtivos()
    .filter(r=>r.pivoId===pivoId&&r.grupoId!==excluirGrupoId)
    .sort((a,b)=>(a.data+a.criadoEm).localeCompare(b.data+b.criadoEm));
  return regs.length?regs[regs.length-1]:null;
}

function horimetroExisteDuplicado(dados,excluirGrupoId){
  return horimetroAtivos().some(r=>
    r.grupoId!==excluirGrupoId&&
    r.pivoId===dados.pivoId&&
    r.data===dados.data&&
    Number(r.horimetroInicial)===Number(dados.horimetroInicial)&&
    Number(r.horimetroFinal)===Number(dados.horimetroFinal)
  );
}

function horimetroMontarContexto(dados,excluirGrupoId){
  const ultimo=horimetroUltimoDoPivo(dados.pivoId,excluirGrupoId);
  return {
    ultimoHorimetroFinal: ultimo?Number(ultimo.horimetroFinal):null,
    duplicado: horimetroExisteDuplicado(dados,excluirGrupoId),
  };
}

function horimetroCalcularCampos(dados){
  const pivo=horimetroPivoInfo(dados.pivoId);
  const horas=calcHoras(dados.horimetroInicial,dados.horimetroFinal);
  const lamina=pivo?calcLamina(dados.percentual,pivo.laminaBase100):null;
  return {horas,lamina};
}

function _dadosParaRow(dados,horas,lamina,pivoSupabaseId,extra){
  return {
    pivo_id:pivoSupabaseId, data:dados.data, hora_inicio:dados.horaInicio||'',
    horimetro_inicial:Number(dados.horimetroInicial), horimetro_final:Number(dados.horimetroFinal),
    horas, percentual:Number(dados.percentual), lamina,
    pressao:dados.pressao!==''&&dados.pressao!=null?Number(dados.pressao):null,
    horas_ociosas:dados.horasOciosas!==''&&dados.horasOciosas!=null?Number(dados.horasOciosas):null,
    cultura:dados.cultura||'', area_pivo:dados.areaPivo||'COMPLETO', operador:dados.operador||'',
    observacao:dados.observacao||'', safra:dados.safra||'', origem:'app',
    ...extra,
  };
}

/* Cria um novo lançamento (grupoId novo, versão 1) — grava no Supabase e
   só then atualiza o cache local com o que o banco realmente confirmou
   (nunca otimista: se a gravação falhar, o cache não muda). Retorna
   {ok:false, erros:[]} em caso de validação, ou {ok:true, dataFuturaPendente:true}
   se só faltar confirmação de data futura, ou {ok:true, registro} ao salvar. */
async function horimetroCriar(dados){
  const contexto=horimetroMontarContexto(dados,null);
  const {horas,lamina}=horimetroCalcularCampos(dados);
  const check=validarHorimetroLancamento(dados,contexto);
  if(!check.valido){
    if(check.erros.length===1&&check.erros[0]==='DATA_FUTURA') return {ok:false,dataFuturaPendente:true};
    return {ok:false,erros:check.erros.filter(e=>e!=='DATA_FUTURA')};
  }
  const pivo=horimetroPivoInfo(dados.pivoId);
  if(!pivo) return {ok:false,erros:['Pivô não encontrado no cadastro.']};

  let pivoSupabaseId;
  try{ pivoSupabaseId=await _pivoSupabaseIdPorNumero(pivo.numero); }
  catch(err){ return {ok:false,erros:['Falha ao conectar ao banco de horímetros: '+err.message]}; }

  const grupoId=(crypto&&crypto.randomUUID)?crypto.randomUUID():gId();
  const row=_dadosParaRow(dados,horas,lamina,pivoSupabaseId,{grupo_id:grupoId,versao:1,atual:true,status:'ativo'});
  const {data:inserted,error}=await window.coiDB.schema('coi').from('horimetro_lancamentos').insert(row).select('*').single();
  if(error) return {ok:false,erros:['Falha ao gravar no banco: '+error.message]};

  const registro=_rowToLocal(inserted);
  _horimetroCache.push(registro);
  auditLog('Horímetro','INCLUSÃO',`Pivô ${pivo.numero} — ${fmtD(dados.data)}`,{
    registro:registro.grupoId, valorNovo:`horímetro ${dados.horimetroInicial}→${dados.horimetroFinal} (${horas}h)`,
  });
  return {ok:true,registro};
}

/* Cria uma nova versão de um lançamento existente. A versão anterior
   permanece no banco com `atual:false` — nunca é apagada nem sobrescrita. */
async function horimetroAtualizar(grupoId,dados){
  const atualLocal=horimetroTodos().find(r=>r.grupoId===grupoId&&r.atual);
  if(!atualLocal) return {ok:false,erros:['Lançamento não encontrado.']};

  const contexto=horimetroMontarContexto(dados,grupoId);
  const {horas,lamina}=horimetroCalcularCampos(dados);
  const check=validarHorimetroLancamento(dados,contexto);
  if(!check.valido){
    if(check.erros.length===1&&check.erros[0]==='DATA_FUTURA') return {ok:false,dataFuturaPendente:true};
    return {ok:false,erros:check.erros.filter(e=>e!=='DATA_FUTURA')};
  }
  const pivo=horimetroPivoInfo(dados.pivoId);
  if(!pivo) return {ok:false,erros:['Pivô não encontrado no cadastro.']};

  let pivoSupabaseId;
  try{ pivoSupabaseId=await _pivoSupabaseIdPorNumero(pivo.numero); }
  catch(err){ return {ok:false,erros:['Falha ao conectar ao banco de horímetros: '+err.message]}; }

  const {error:updErr}=await window.coiDB.schema('coi').from('horimetro_lancamentos').update({atual:false}).eq('id',atualLocal.id);
  if(updErr) return {ok:false,erros:['Falha ao versionar registro anterior: '+updErr.message]};

  const row=_dadosParaRow(dados,horas,lamina,pivoSupabaseId,{grupo_id:grupoId,versao:atualLocal.versao+1,atual:true,status:'ativo'});
  const {data:inserted,error}=await window.coiDB.schema('coi').from('horimetro_lancamentos').insert(row).select('*').single();
  if(error){
    // reverte a versão anterior para não deixar o grupo sem "atual"
    await window.coiDB.schema('coi').from('horimetro_lancamentos').update({atual:true}).eq('id',atualLocal.id);
    return {ok:false,erros:['Falha ao gravar nova versão: '+error.message]};
  }

  const valorAnterior=`horímetro ${atualLocal.horimetroInicial}→${atualLocal.horimetroFinal} (${fmt(atualLocal.horas,1)}h)`;
  atualLocal.atual=false;
  const registro=_rowToLocal(inserted);
  _horimetroCache.push(registro);
  const valorNovo=`horímetro ${registro.horimetroInicial}→${registro.horimetroFinal} (${fmt(registro.horas,1)}h)`;
  auditLog('Horímetro','ALTERAÇÃO',`Pivô ${pivo.numero} — ${fmtD(dados.data)} — versão ${registro.versao}`,{
    registro:grupoId, valorAnterior, valorNovo,
  });
  return {ok:true,registro};
}

/* Soft-delete: o registro nunca sai do banco, só deixa de contar como
   ativo. Preserva o histórico permanente exigido para o horímetro. */
async function horimetroExcluir(grupoId){
  const atualLocal=horimetroTodos().find(r=>r.grupoId===grupoId&&r.atual);
  if(!atualLocal) return {ok:false,erros:['Lançamento não encontrado.']};

  const {error}=await window.coiDB.schema('coi').from('horimetro_lancamentos').update({status:'excluido'}).eq('id',atualLocal.id);
  if(error) return {ok:false,erros:['Falha ao excluir: '+error.message]};

  atualLocal.status='excluido';
  const pivo=horimetroPivoInfo(atualLocal.pivoId);
  auditLog('Horímetro','EXCLUSÃO',`Pivô ${pivo?pivo.numero:'?'} — ${fmtD(atualLocal.data)}`,{registro:grupoId});
  return {ok:true};
}

/* Todas as versões de um lançamento (para auditoria/inspeção). */
function horimetroHistoricoVersoes(grupoId){
  return horimetroTodos().filter(r=>r.grupoId===grupoId).sort((a,b)=>a.versao-b.versao);
}

/* ── CONSULTAS ────────────────────────────────────────────────────── */
function horimetroPorPivo(pivoId){
  return horimetroAtivos().filter(r=>r.pivoId===pivoId).sort((a,b)=>a.data.localeCompare(b.data));
}
function horimetroPorFazenda(fazendaId){
  const pivoIds=new Set((cadAll('pivos')||[]).filter(p=>p.fazendaId===fazendaId).map(p=>p.id));
  return horimetroAtivos().filter(r=>pivoIds.has(r.pivoId));
}
function horimetroPorCasaBomba(casaBombaId){
  const pivoIds=new Set((cadAll('pivos')||[]).filter(p=>p.casaBombaId===casaBombaId).map(p=>p.id));
  return horimetroAtivos().filter(r=>pivoIds.has(r.pivoId));
}

/* Consulta única e flexível — período/fazenda/pivô/casa de bomba/operador/
   cultura/safra — preparada para ser reaproveitada pelo módulo de
   Relatórios (Excel/PDF) sem duplicar filtro nenhum: os relatórios só
   chamam esta função com os filtros que o usuário escolher. */
function horimetroConsultar(filtros){
  const f=filtros||{};
  const pivosPorFiltro=(f.fazendaId||f.casaBombaId)?new Set((cadAll('pivos')||[])
    .filter(p=>(!f.fazendaId||p.fazendaId===f.fazendaId)&&(!f.casaBombaId||p.casaBombaId===f.casaBombaId))
    .map(p=>p.id)):null;

  return horimetroAtivos().filter(r=>{
    if(f.dataInicio&&r.data<f.dataInicio) return false;
    if(f.dataFim&&r.data>f.dataFim) return false;
    if(f.pivoId&&r.pivoId!==f.pivoId) return false;
    if(pivosPorFiltro&&!pivosPorFiltro.has(r.pivoId)) return false;
    if(f.operador&&r.operador!==f.operador) return false;
    if(f.cultura&&r.cultura!==f.cultura) return false;
    if(f.safra&&r.safra!==f.safra) return false;
    return true;
  });
}

/* Evolução do horímetro acumulado (leitura do equipamento ao longo do
   tempo) — para o gráfico de "linha do tempo" de cada pivô. */
function horimetroEvolucaoAcumulada(pivoId){
  return horimetroPorPivo(pivoId).map(r=>({x:r.data,y:r.horimetroFinal}));
}

/* Resumo completo de um pivô: acumulado, médias, série mensal/anual/safra
   e utilização — tudo a partir das mesmas funções de js/services/calculos.js,
   para nunca recalcular a mesma coisa de formas diferentes em telas distintas. */
function horimetroResumoPivo(pivoId){
  const regs=horimetroPorPivo(pivoId);
  if(!regs.length){
    return {acumulado:0,mediaDiaria:0,mediaMensal:0,porMes:[],porAno:[],porSafra:[],utilizacao:0,ultimoRegistro:null};
  }
  const primeira=regs[0].data, ultima=regs[regs.length-1].data;
  return {
    acumulado:calcAcumulado(regs),
    mediaDiaria:calcMediaDiaria(regs),
    mediaMensal:calcMediaMensal(regs),
    porMes:agruparPorMes(regs),
    porAno:agruparPorAno(regs),
    porSafra:agruparPorSafra(regs),
    utilizacao:calcUtilizacao(regs,primeira,ultima),
    ultimoRegistro:regs[regs.length-1],
  };
}
