/* ── SERVICES / CALIBRAÇÃO DE LÂMINA ───────────────────────────────
   Única camada que lê/grava calibrações de lâmina (`coi_calibracoes`).
   Mesmo padrão de histórico permanente dos demais serviços — uma
   calibração corrigida nunca é sobrescrita, sempre vira nova versão.

   Ao salvar, atualiza automaticamente `laminaBase100` no cadastro do
   pivô (via `cadPatchRecord`, js/cadastro.js) — é esse campo que o
   Horímetro e a Fertirrigação já usam para os próprios cálculos
   (calcLamina), então não é preciso "avisar" ninguém: o valor novo já
   está lá na próxima vez que qualquer serviço ler o pivô.
   ──────────────────────────────────────────────────────────────── */

const CALIBRACAO_KEY='coi_calibracoes';
const METODOS_CALIBRACAO=['Teste de Campo (Coletor)','Cálculo Teórico','Fabricante','Outro'];

const calibracaoTodos = () => lsGet(CALIBRACAO_KEY,[]);
const calibracaoSalvarTudo = arr => lsSet(CALIBRACAO_KEY,arr);
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

function calibracaoMontarRegistro(dados,laminaCalculada100,variacao){
  return {
    pivoId:dados.pivoId, data:dados.data, hora:dados.hora,
    operador:dados.operador||'', responsavelCalibracao:dados.responsavelCalibracao||'',
    laminaMedida:Number(dados.laminaMedida), percentualUtilizado:Number(dados.percentualUtilizado),
    laminaCalculada100, diferencaAnterior:variacao.diferenca, percentualVariacao:variacao.percentual,
    metodoCalibracao:dados.metodoCalibracao||METODOS_CALIBRACAO[0],
    observacoes:dados.observacoes||'',
  };
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

/* ── CRUD (grupoId/versao/atual, igual aos demais serviços) ───────── */
function calibracaoCriar(dados){
  const check=calibracaoValidar(dados);
  if(!check.valido) return {ok:false,erros:check.erros};

  const laminaCalculada100=calcLaminaBase100(dados.percentualUtilizado,dados.laminaMedida);
  const pivo=horimetroPivoInfo(dados.pivoId);
  const anterior=calibracaoUltimaDoPivo(dados.pivoId,null);
  const valorAnterior=anterior?anterior.laminaCalculada100:(pivo?pivo.laminaBase100:null);
  const variacao=calcVariacao(valorAnterior,laminaCalculada100);

  const id=gId();
  const registro={id,grupoId:id,versao:1,atual:true,status:'ativo',...calibracaoMontarRegistro(dados,laminaCalculada100,variacao),criadoEm:new Date().toISOString()};
  const todos=calibracaoTodos();
  todos.push(registro);
  calibracaoSalvarTudo(todos);

  cadPatchRecord('pivos',dados.pivoId,{laminaBase100:laminaCalculada100});
  auditLog('Calibração de Lâmina','INCLUSÃO',`Pivô ${pivo?pivo.numero:'?'} — lâmina base ${valorAnterior??'—'} → ${laminaCalculada100}${variacao.percentual!=null?` (${variacao.percentual>0?'+':''}${variacao.percentual}%)`:''}`);
  return {ok:true,registro};
}

function calibracaoAtualizar(grupoId,dados){
  const todos=calibracaoTodos();
  const atual=todos.find(r=>r.grupoId===grupoId&&r.atual);
  if(!atual) return {ok:false,erros:['Calibração não encontrada.']};

  const check=calibracaoValidar(dados);
  if(!check.valido) return {ok:false,erros:check.erros};

  const laminaCalculada100=calcLaminaBase100(dados.percentualUtilizado,dados.laminaMedida);
  const pivo=horimetroPivoInfo(dados.pivoId);
  const anterior=calibracaoUltimaDoPivo(dados.pivoId,grupoId);
  const valorAnterior=anterior?anterior.laminaCalculada100:(pivo?pivo.laminaBase100:null);
  const variacao=calcVariacao(valorAnterior,laminaCalculada100);

  atual.atual=false;
  const nova={...atual,id:gId(),versao:atual.versao+1,atual:true,status:'ativo',...calibracaoMontarRegistro(dados,laminaCalculada100,variacao),criadoEm:new Date().toISOString()};
  todos.push(nova);
  calibracaoSalvarTudo(todos);

  calibracaoAtualizarPivoSeMaisRecente(dados.pivoId,grupoId,laminaCalculada100);
  auditLog('Calibração de Lâmina','ALTERAÇÃO',`Pivô ${pivo?pivo.numero:'?'} — versão ${nova.versao}`);
  return {ok:true,registro:nova};
}

function calibracaoExcluir(grupoId){
  const todos=calibracaoTodos();
  const atual=todos.find(r=>r.grupoId===grupoId&&r.atual);
  if(!atual) return {ok:false,erros:['Calibração não encontrada.']};

  const eraAMaisRecente=(()=>{ const m=calibracaoUltimaDoPivo(atual.pivoId,null); return m&&m.grupoId===grupoId; })();
  atual.status='excluido';
  calibracaoSalvarTudo(todos);

  if(eraAMaisRecente){
    const novaMaisRecente=calibracaoUltimaDoPivo(atual.pivoId,null);
    if(novaMaisRecente) cadPatchRecord('pivos',atual.pivoId,{laminaBase100:novaMaisRecente.laminaCalculada100});
    // Se não havia calibração anterior, o cadastro do pivô mantém o valor
    // atual (não há como recuperar com segurança o valor pré-calibração).
  }
  const pivo=horimetroPivoInfo(atual.pivoId);
  auditLog('Calibração de Lâmina','EXCLUSÃO',`Pivô ${pivo?pivo.numero:'?'} — ${fmtD(atual.data)}`);
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
/* "Vencida": estrutura pronta para uso futuro — ainda não existe uma
   regra oficial de prazo de validade por pivô/cultura, então usa um
   padrão configurável só para o indicador já existir e funcionar assim
   que esse prazo for definido. */
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
