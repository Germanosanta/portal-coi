/* ── SERVICES / PARADAS ────────────────────────────────────────────
   Única camada que lê/grava paradas operacionais (`coi_paradas`).
   Mesmo padrão de histórico permanente do Horímetro/Indicadores
   (grupoId/versao/atual + soft-delete) e mesma regra: categoria,
   motivo, submotivo, prioridade e criticidade NÃO são reescritos aqui
   — vêm por `falhaId`, referência ao cadastro de Falhas (js/cadastro.js),
   para nunca duplicar essa taxonomia.

   Este serviço também passa a ser a fonte de "tempo parado" para os
   Indicadores (disponibilidade/MTTR) — ver js/services/indicador.js.
   ──────────────────────────────────────────────────────────────── */

const PARADA_KEY='coi_paradas';

const paradaTodos = () => lsGet(PARADA_KEY,[]);
const paradaSalvarTudo = arr => lsSet(PARADA_KEY,arr);
const paradaAtivas = () => paradaTodos().filter(r=>r.atual&&r.status==='ativo');

/* ── CRUD (grupoId/versao/atual, igual aos demais serviços) ───────── */
function paradaMontarRegistro(dados){
  return {
    pivoId:dados.pivoId, falhaId:dados.falhaId, data:dados.data,
    horaInicial:dados.horaInicial, horaFinal:dados.horaFinal,
    tempoParadoHoras:calcDuracaoHoras(dados.horaInicial,dados.horaFinal),
    operador:dados.operador||'', tecnicoId:dados.tecnicoId||'',
    tipoParada:dados.tipoParada||'Não Programada',
    observacao:dados.observacao||'',
  };
}

function paradaCriar(dados){
  const check=validarParada(dados);
  if(!check.valido){
    if(check.erros.length===1&&check.erros[0]==='DATA_FUTURA') return {ok:false,dataFuturaPendente:true};
    return {ok:false,erros:check.erros.filter(e=>e!=='DATA_FUTURA')};
  }
  const id=gId();
  const registro={id,grupoId:id,versao:1,atual:true,status:'ativo',...paradaMontarRegistro(dados),criadoEm:new Date().toISOString()};
  const todos=paradaTodos();
  todos.push(registro);
  paradaSalvarTudo(todos);

  const pivo=horimetroPivoInfo(dados.pivoId), falha=indicadorFalhaInfo(dados.falhaId);
  auditLog('Paradas','INCLUSÃO',`Pivô ${pivo?pivo.numero:'?'} — ${falha?falha.categoria+'/'+falha.motivo:'?'} — ${fmt(registro.tempoParadoHoras,1)}h`);
  return {ok:true,registro};
}

function paradaAtualizar(grupoId,dados){
  const todos=paradaTodos();
  const atual=todos.find(r=>r.grupoId===grupoId&&r.atual);
  if(!atual) return {ok:false,erros:['Parada não encontrada.']};

  const check=validarParada(dados);
  if(!check.valido){
    if(check.erros.length===1&&check.erros[0]==='DATA_FUTURA') return {ok:false,dataFuturaPendente:true};
    return {ok:false,erros:check.erros.filter(e=>e!=='DATA_FUTURA')};
  }

  atual.atual=false;
  const nova={...atual,id:gId(),versao:atual.versao+1,atual:true,status:'ativo',...paradaMontarRegistro(dados),criadoEm:new Date().toISOString()};
  todos.push(nova);
  paradaSalvarTudo(todos);
  const pivo=horimetroPivoInfo(dados.pivoId);
  auditLog('Paradas','ALTERAÇÃO',`Pivô ${pivo?pivo.numero:'?'} — versão ${nova.versao}`);
  return {ok:true,registro:nova};
}

function paradaExcluir(grupoId){
  const todos=paradaTodos();
  const atual=todos.find(r=>r.grupoId===grupoId&&r.atual);
  if(!atual) return {ok:false,erros:['Parada não encontrada.']};
  atual.status='excluido';
  paradaSalvarTudo(todos);
  const pivo=horimetroPivoInfo(atual.pivoId);
  auditLog('Paradas','EXCLUSÃO',`Pivô ${pivo?pivo.numero:'?'} — ${fmtD(atual.data)}`);
  return {ok:true};
}

function paradaHistoricoVersoes(grupoId){
  return paradaTodos().filter(r=>r.grupoId===grupoId).sort((a,b)=>a.versao-b.versao);
}

/* ── CONSULTAS ────────────────────────────────────────────────────── */
function paradaPorPivo(pivoId){
  return paradaAtivas().filter(r=>r.pivoId===pivoId).sort((a,b)=>(a.data+a.horaInicial).localeCompare(b.data+b.horaInicial));
}
function paradaPorFazenda(fazendaId){
  const pivoIds=new Set((cadAll('pivos')||[]).filter(p=>p.fazendaId===fazendaId).map(p=>p.id));
  return paradaAtivas().filter(r=>pivoIds.has(r.pivoId));
}
function paradaPorCasaBomba(casaBombaId){
  const pivoIds=new Set((cadAll('pivos')||[]).filter(p=>p.casaBombaId===casaBombaId).map(p=>p.id));
  return paradaAtivas().filter(r=>pivoIds.has(r.pivoId));
}

/* Consulta única e flexível (período/fazenda/pivô/casa de bomba/operador/
   técnico/categoria) — mesmo papel do `horimetroConsultar`, preparada para
   o módulo de Relatórios. */
function paradaConsultar(filtros){
  const f=filtros||{};
  const pivosPorFiltro=(f.fazendaId||f.casaBombaId)?new Set((cadAll('pivos')||[])
    .filter(p=>(!f.fazendaId||p.fazendaId===f.fazendaId)&&(!f.casaBombaId||p.casaBombaId===f.casaBombaId))
    .map(p=>p.id)):null;

  return paradaAtivas().filter(r=>{
    if(f.dataInicio&&r.data<f.dataInicio) return false;
    if(f.dataFim&&r.data>f.dataFim) return false;
    if(f.pivoId&&r.pivoId!==f.pivoId) return false;
    if(pivosPorFiltro&&!pivosPorFiltro.has(r.pivoId)) return false;
    if(f.operador&&r.operador!==f.operador) return false;
    if(f.tecnicoId&&r.tecnicoId!==f.tecnicoId) return false;
    if(f.categoria){ const fa=indicadorFalhaInfo(r.falhaId); if(!fa||fa.categoria!==f.categoria) return false; }
    return true;
  });
}

/* ── INDICADORES DO DIA/SEMANA/MÊS ────────────────────────────────── */
function paradasHoje(){ return paradaAtivas().filter(r=>r.data===today()); }
function paradasSemana(){ const {inicio,fim}=semanaAtual(); return paradaAtivas().filter(r=>r.data>=inicio&&r.data<=fim); }
function paradasMes(){ return paradaAtivas().filter(r=>r.data.slice(0,7)===today().slice(0,7)); }

function paradaTempoMedio(paradas){
  const arr=paradas||paradaAtivas();
  if(!arr.length) return 0;
  return +(calcAcumulado(arr,'tempoParadoHoras')/arr.length).toFixed(2);
}

/* ── RANKINGS ─────────────────────────────────────────────────────── */
function paradaRankingFalhas(paradas){
  return agruparPorChave(paradas||paradaAtivas(),r=>{
    const f=indicadorFalhaInfo(r.falhaId); return f?`${f.categoria} — ${f.motivo}`:'Não classificado';
  },()=>1).sort((a,b)=>b.valor-a.valor).map(r=>({motivo:r.chave,ocorrencias:r.valor}));
}
function paradaRankingPivos(paradas){
  return agruparPorChave(paradas||paradaAtivas(),r=>r.pivoId,r=>r.tempoParadoHoras||0)
    .map(r=>{ const p=horimetroPivoInfo(r.chave); return {pivo:p?'P.'+p.numero:'?',horas:r.valor}; })
    .sort((a,b)=>b.horas-a.horas);
}

/* ── GRÁFICOS ─────────────────────────────────────────────────────── */
function paradaPorCategoria(paradas){
  return agruparPorChave(paradas||paradaAtivas(),r=>{ const f=indicadorFalhaInfo(r.falhaId); return f?f.categoria:'Não classificado'; },r=>r.tempoParadoHoras||0);
}
function paradaEvolucaoMensal(pivoId){
  return agruparPorMes(pivoId?paradaPorPivo(pivoId):paradaAtivas(),'tempoParadoHoras');
}

/* Resumo completo de paradas de um pivô: tempo acumulado, frequência,
   ranking de motivos e linha do tempo — para a aba Histórico. */
function paradaResumoPivo(pivoId){
  const regs=paradaPorPivo(pivoId);
  return {
    tempoAcumulado:calcAcumulado(regs,'tempoParadoHoras'),
    frequencia:regs.length,
    tempoMedio:paradaTempoMedio(regs),
    rankingMotivos:paradaRankingFalhas(regs),
    porMes:agruparPorMes(regs,'tempoParadoHoras'),
    linhaDoTempo:regs.map(r=>({data:r.data,horas:r.tempoParadoHoras})),
  };
}
