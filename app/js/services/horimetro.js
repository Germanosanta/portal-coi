/* ── SERVICES / HORÍMETRO ──────────────────────────────────────────
   Única camada que lê/grava lançamentos de horímetro. As telas (js/lanc.js)
   NUNCA acessam localStorage diretamente — só chamam as funções daqui.

   Histórico é permanente: `horimetroAtualizar` nunca sobrescreve um
   registro antigo, sempre cria uma nova versão (mesmo `grupoId`, `versao`
   +1) e marca a anterior como não-atual. `horimetroExcluir` é um soft-
   delete (`status:'excluido'`) — o registro nunca é removido do storage.
   Toda inclusão/alteração/exclusão grava em auditoria (js/audit.js).
   ──────────────────────────────────────────────────────────────── */

const HORIMETRO_KEY='coi_horimetro_lancamentos';

const horimetroTodos = () => lsGet(HORIMETRO_KEY,[]);
const horimetroSalvarTudo = arr => lsSet(HORIMETRO_KEY,arr);

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

/* Cria um novo lançamento (grupoId novo, versão 1). Retorna
   {ok:false, erros:[]} em caso de validação, ou {ok:true, dataFuturaPendente:true}
   se só faltar confirmação de data futura, ou {ok:true, registro} ao salvar. */
function horimetroCriar(dados){
  const contexto=horimetroMontarContexto(dados,null);
  const {horas,lamina}=horimetroCalcularCampos(dados);
  const check=validarHorimetroLancamento(dados,contexto);
  if(!check.valido){
    if(check.erros.length===1&&check.erros[0]==='DATA_FUTURA') return {ok:false,dataFuturaPendente:true};
    return {ok:false,erros:check.erros.filter(e=>e!=='DATA_FUTURA')};
  }
  const id=gId();
  const registro={
    id, grupoId:id, versao:1, atual:true, status:'ativo',
    pivoId:dados.pivoId, data:dados.data, horaInicio:dados.horaInicio||'',
    horimetroInicial:Number(dados.horimetroInicial), horimetroFinal:Number(dados.horimetroFinal),
    horas, percentual:Number(dados.percentual), lamina,
    pressao:dados.pressao!==''&&dados.pressao!=null?Number(dados.pressao):null,
    horasOciosas:dados.horasOciosas!==''&&dados.horasOciosas!=null?Number(dados.horasOciosas):null,
    cultura:dados.cultura||'', areaPivo:dados.areaPivo||'COMPLETO', operador:dados.operador||'',
    observacao:dados.observacao||'', safra:dados.safra||'',
    criadoEm:new Date().toISOString(),
  };
  const todos=horimetroTodos();
  todos.push(registro);
  horimetroSalvarTudo(todos);
  const pivo=horimetroPivoInfo(dados.pivoId);
  auditLog('Horímetro','INCLUSÃO',`Pivô ${pivo?pivo.numero:'?'} — ${fmtD(dados.data)} — ${horas}h`);
  return {ok:true,registro};
}

/* Cria uma nova versão de um lançamento existente. A versão anterior
   permanece no storage com `atual:false` — nunca é apagada nem sobrescrita. */
function horimetroAtualizar(grupoId,dados){
  const todos=horimetroTodos();
  const atual=todos.find(r=>r.grupoId===grupoId&&r.atual);
  if(!atual) return {ok:false,erros:['Lançamento não encontrado.']};

  const contexto=horimetroMontarContexto(dados,grupoId);
  const {horas,lamina}=horimetroCalcularCampos(dados);
  const check=validarHorimetroLancamento(dados,contexto);
  if(!check.valido){
    if(check.erros.length===1&&check.erros[0]==='DATA_FUTURA') return {ok:false,dataFuturaPendente:true};
    return {ok:false,erros:check.erros.filter(e=>e!=='DATA_FUTURA')};
  }

  atual.atual=false;
  const novaVersao={
    ...atual, id:gId(), versao:atual.versao+1, atual:true, status:'ativo',
    pivoId:dados.pivoId, data:dados.data, horaInicio:dados.horaInicio||'',
    horimetroInicial:Number(dados.horimetroInicial), horimetroFinal:Number(dados.horimetroFinal),
    horas, percentual:Number(dados.percentual), lamina,
    pressao:dados.pressao!==''&&dados.pressao!=null?Number(dados.pressao):null,
    horasOciosas:dados.horasOciosas!==''&&dados.horasOciosas!=null?Number(dados.horasOciosas):null,
    cultura:dados.cultura||'', areaPivo:dados.areaPivo||'COMPLETO', operador:dados.operador||'',
    observacao:dados.observacao||'', safra:dados.safra||'',
    criadoEm:new Date().toISOString(),
  };
  todos.push(novaVersao);
  horimetroSalvarTudo(todos);
  const pivo=horimetroPivoInfo(dados.pivoId);
  auditLog('Horímetro','ALTERAÇÃO',`Pivô ${pivo?pivo.numero:'?'} — ${fmtD(dados.data)} — versão ${novaVersao.versao}`);
  return {ok:true,registro:novaVersao};
}

/* Soft-delete: o registro nunca sai do storage, só deixa de contar como
   ativo. Preserva o histórico permanente exigido para o horímetro. */
function horimetroExcluir(grupoId){
  const todos=horimetroTodos();
  const atual=todos.find(r=>r.grupoId===grupoId&&r.atual);
  if(!atual) return {ok:false,erros:['Lançamento não encontrado.']};
  atual.status='excluido';
  horimetroSalvarTudo(todos);
  const pivo=horimetroPivoInfo(atual.pivoId);
  auditLog('Horímetro','EXCLUSÃO',`Pivô ${pivo?pivo.numero:'?'} — ${fmtD(atual.data)}`);
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
