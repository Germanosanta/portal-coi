/* ── DASHBOARD EXECUTIVO (Fase 9.2) ────────────────────────────────
   Só renderização: todo número aqui vem de um serviço já existente
   (services/horimetro.js, indicador.js, parada.js, fertirrigacao.js,
   planejamento.js, calibracao.js, cadastro.js, audit.js) ou de um
   agrupamento leve sobre o resultado desses serviços — nenhum cálculo
   de negócio novo, nenhuma regra de validação nova. O COI é um sistema
   de gestão operacional: "Pivôs em operação/parados" usa o status
   cadastrado manualmente pela equipe (js/cadastro.js), sem nenhuma
   integração automática.
   ──────────────────────────────────────────────────────────────── */

function execTrend(atual,anterior){
  if(anterior===0&&atual===0) return `<span class="exec2-trend flat">– estável</span>`;
  if(anterior===0) return `<span class="exec2-trend up">▲ novo</span>`;
  const pct=(atual-anterior)/anterior*100;
  const dir=pct>0.5?'up':pct<-0.5?'down':'flat';
  const arrow=dir==='up'?'▲':dir==='down'?'▼':'–';
  return `<span class="exec2-trend ${dir}">${arrow} ${Math.abs(pct).toFixed(0)}% sem.</span>`;
}

function execKpiCard(o){
  return `<div class="exec2-kpi ${o.color||''}">
    <div class="exec2-kpi-top">
      <div class="exec2-kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">${SB_ICON[o.icon]||''}</svg></div>
      ${o.trend||''}
    </div>
    <div class="exec2-kpi-label">${o.label}</div>
    <div class="exec2-kpi-value">${o.value}${o.unit?`<span class="exec2-kpi-unit">${o.unit}</span>`:''}</div>
    ${o.sub?`<div class="exec2-kpi-sub">${o.sub}</div>`:''}
  </div>`;
}

/* ── BLOCO 1 — CABEÇALHO DO PORTAL COI ─────────────────────────────
   Fase 12.1: o Portal não é mais um dashboard — só logo (bloco acima,
   .home-brand-strip, já traz o nome do sistema embutido na própria
   imagem) + mensagem de boas-vindas + nome do usuário. Cargo/perfil/
   último acesso/fazenda/safra/status de sincronização saíram daqui:
   não fazem parte da lista fechada de elementos do Portal — continuam
   reais e visíveis onde já apareciam antes (rodapé da sidebar já mostra
   registros carregados/fonte via atuSB(); Administração já mostra
   perfil/último acesso na tabela de Usuários). Nome ainda vem de
   usuarioAtual() (services/usuarios.js), nunca de um valor fictício. */
function renderExecHero(){
  const el=document.getElementById('exec2-hero'); if(!el) return;
  const h=new Date().getHours();
  const saud=h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';
  const u=typeof usuarioAtual==='function'?usuarioAtual():null;
  const nome=u?.nome||localStorage.getItem('coi_user')||'Operador Local';
  el.innerHTML=`
    <svg class="hero-watermark icon-pivot" viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.2"/><path d="M12 12 4 6M12 12l9-2M12 12l-3 8M12 12l6 6"/><circle cx="12" cy="12" r="9"/></svg>
    <div>
      <div class="exec2-hero-greet">${saud}, ${(nome.split(' ')[0]||nome)}</div>
      <div class="exec2-hero-sub">Escolha o ambiente de trabalho</div>
    </div>`;
}

/* ── DADOS-BASE DO PAINEL OPERACIONAL ───────────────────────────────
   Computa os dados uma vez só; renderIndicadoresDoDia e
   renderStatusPivos é que escolhem quais cartões mostrar a partir
   daqui — nenhuma contagem é feita duas vezes. Planejado/Executado/
   Pendente (Resumo Operacional e Planejamento) vêm à parte, de
   planejamentoResumo() — cruzamento próprio, já existente, não
   duplicado aqui. A Home/Portal COI (Fase 12.0) não tem recorte
   próprio de KPIs do dia: o mesmo dado já vive na landing do módulo
   (Painel Operacional), então mostrar de novo ali seria duplicar
   informação, não reforçá-la. */
function computeKpisPrincipaisData(){
  const hoje=today();
  const {inicio,fim}=semanaAtual();
  const antIni=new Date(inicio); antIni.setDate(antIni.getDate()-7);
  const antFim=new Date(fim); antFim.setDate(antFim.getDate()-7);
  const toISO=d=>d.toISOString().split('T')[0];
  const antIniS=toISO(antIni), antFimS=toISO(antFim);

  const parHoje=paradasHoje().length;
  const parSemAtual=paradasSemana().length;
  const parSemAnt=paradaAtivas().filter(r=>r.data>=antIniS&&r.data<=antFimS).length;

  const fertiAt=fertiAtivos();
  const fertiHoje=fertiAt.filter(r=>r.data===hoje).length;
  const fertiSemAtual=fertiAt.filter(r=>r.data>=inicio&&r.data<=fim).length;
  const fertiSemAnt=fertiAt.filter(r=>r.data>=antIniS&&r.data<=antFimS).length;

  const calAtivas=calibracaoAtivas();
  const cal30=calAtivas.filter(r=>Math.round((new Date()-new Date(r.data))/86400000)<=30).length;
  const calUlt=calibracaoUltimas(1)[0];

  const pivos=cadAll('pivos')||[];
  const ativos=pivos.filter(p=>p.status==='Ativo').length;
  const manut=pivos.filter(p=>p.status==='Manutenção').length;
  const inativos=pivos.filter(p=>p.status==='Inativo').length;

  return {parHoje,parSemAtual,parSemAnt,fertiHoje,fertiSemAtual,fertiSemAnt,cal30,calUlt,pivos,ativos,manut,inativos};
}

/* ── BLOCO 3 — OPERAÇÃO EM TEMPO REAL ──────────────────────────────── */
function execListRow(iconClass,iconKey,title,sub,time){
  return `<div class="exec2-list-row">
    <div class="exec2-list-icon ${iconClass}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${SB_ICON[iconKey]||''}</svg></div>
    <div class="exec2-list-main"><div class="exec2-list-title">${title}</div><div class="exec2-list-sub">${sub}</div></div>
    <div class="exec2-list-time">${time}</div>
  </div>`;
}
const horaDe=iso=>iso?new Date(iso).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'—';

/* Feed unificado por criadoEm — usado pelo Painel Operacional (Card B) e
   pela Home ("Atividades recentes"), sem recomputar em dois lugares. */
function buildFeedRecente(n){
  return [
    ...horimetroAtivos().map(r=>({tipo:'Horímetro',icon:'droplet',cls:'i-ok',pivo:r.pivoId,data:r.data,criadoEm:r.criadoEm,usuario:r.operador||'—',resumo:`${fmt(r.horas,1)}h lançadas`})),
    ...paradaAtivas().map(r=>({tipo:'Parada',icon:'pause',cls:'i-warn',pivo:r.pivoId,data:r.data,criadoEm:r.criadoEm,usuario:r.operador||'—',resumo:'parada registrada'})),
    ...fertiAtivos().map(r=>({tipo:'Fertirrigação',icon:'droplet',cls:'i-info',pivo:r.pivoId,data:r.data,criadoEm:r.criadoEm,usuario:r.operador||'—',resumo:'aplicação registrada'})),
    ...calibracaoAtivas().map(r=>({tipo:'Calibração',icon:'gaugeCal',cls:'i-info',pivo:r.pivoId,data:r.data,criadoEm:r.criadoEm,usuario:r.operador||'—',resumo:'lâmina recalibrada'})),
  ].sort((a,b)=>(b.criadoEm||'').localeCompare(a.criadoEm||'')).slice(0,n);
}
/* Sprint 01.1 — cada ocorrência mostra horário/pivô/tipo/usuário, com o
   tipo como badge do Design System (mesmo mapeamento cor-por-tipo já
   usado nos ícones de status: i-ok/i-warn/i-info → b-success/b-warning/b-info). */
const BADGE_POR_CLS={'i-ok':'b-success','i-warn':'b-warning','i-info':'b-info','i-danger':'b-danger','i-neutral':'b-neutral'};
function feedRowHtml(f){
  const p=(cadAll('pivos')||[]).find(x=>x.id===f.pivo);
  const titulo=`<span class="badge ${BADGE_POR_CLS[f.cls]||'b-neutral'}">${f.tipo}</span> P.${p?p.numero:'?'} · ${f.usuario}`;
  return execListRow(f.cls,f.icon,titulo,f.resumo,horaDe(f.criadoEm));
}

/* ── RESUMO OPERACIONAL (Ponto 9 — janela de ÚLTIMOS 7 DIAS, não mais
   "hoje": um pivô com irrigação de madrugada ou um lançamento feito com
   1 dia de atraso não pode desaparecer do painel). Mesmo cruzamento
   planejado×executado de planejamentoResumo já usado no restante do
   painel + indicadorEficiencia (já existente, utilização×disponibilidade)
   — nenhum cálculo novo, só o período mudou de 1 dia para 7. */
function renderResumoOperacional(){
  const box=document.getElementById('opdash-resumo'); if(!box) return;
  const {inicio,fim}=ultimosDias(7);
  const resumo=planejamentoResumo(inicio,fim);
  const pivosParada=new Set(paradaAtivas().filter(r=>r.data>=inicio&&r.data<=fim).map(r=>r.pivoId)).size;
  const eficiencia=indicadorEficiencia(inicio,fim);

  box.innerHTML=[
    execKpiCard({label:'Planejados (7 dias)',icon:'calendar',value:resumo.total,sub:'irrigação prevista nos últimos 7 dias'}),
    execKpiCard({label:'Executados (7 dias)',icon:'droplet',value:resumo.feito,sub:resumo.total?`${fmt(resumo.assertividade,0)}% do planejado`:'sem planejamento no período',color:'c-green'}),
    execKpiCard({label:'Com Parada (7 dias)',icon:'pause',value:pivosParada,sub:'pivôs pararam no período',color:pivosParada>0?'c-amber':'c-green'}),
    execKpiCard({label:'Não Feito (7 dias)',icon:'alert',value:resumo.naoFeito,sub:'marcados com motivo',color:resumo.naoFeito>0?'c-red':'c-green'}),
    execKpiCard({label:'Pendentes (7 dias)',icon:'clockCirc',value:resumo.pendente,sub:'planejados e ainda sem decisão',color:resumo.pendente>0?'c-amber':'c-green'}),
    execKpiCard({label:'Eficiência (7 dias)',icon:'trending',value:fmt(eficiencia,0),unit:'%',sub:'utilização × disponibilidade, últimos 7 dias',color:eficiencia>=70?'c-green':eficiencia>=40?'c-amber':'c-red'}),
  ].join('');

  /* Ponto 10 — donut Feito × Não Feito × Pendente, os MESMOS 3 números
     do resumo acima (nenhuma segunda consulta/fonte para o gráfico). */
  const donutBox=document.getElementById('opdash-resumo-donut');
  if(donutBox){
    donutBox.innerHTML=resumo.total
      ? donut([
          {v:resumo.feito,c:'#16a34a',l:'Feito'},
          {v:resumo.naoFeito,c:'#dc2626',l:'Não Feito'},
          {v:resumo.pendente,c:'#d97706',l:'Pendente'},
        ],resumo.total,'planejados (7d)',140)
      : emEl('Sem planejamento nos últimos 7 dias para comparar.');
  }
}

/* ── STATUS DOS PIVÔS (Sprint 01.2) — apoio ao Resumo Operacional:
   condição cadastral do equipamento (Ativo/Manutenção/Inativo) e horas
   por casa de bomba. Indicador diferente do Resumo (equipamento, não
   execução do dia) — não duplica informação. Agrupado em poucas linhas
   (nunca uma lista por pivô) para leitura rápida. */
function renderStatusPivos(){
  const box=document.getElementById('opdash-status-pivos'); if(!box) return;
  const d=computeKpisPrincipaisData();

  box.innerHTML=`
  <div class="exec2-card">
    <div class="exec2-card-head"><span class="t"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">${SB_ICON.pivot}</svg>Status dos Pivôs</span></div>
    <div class="exec2-card-body">
      <div class="exec2-stat-row"><span><span class="op-status-dot" style="background:var(--ds-success)"></span>Em operação</span><span class="exec2-stat-big" style="color:var(--ds-success)">${d.ativos}</span></div>
      <div class="exec2-stat-row"><span><span class="op-status-dot" style="background:var(--ds-warning)"></span>Em manutenção</span><span class="exec2-stat-big" style="color:var(--ds-warning)">${d.manut}</span></div>
      <div class="exec2-stat-row"><span><span class="op-status-dot" style="background:var(--ds-text-tertiary)"></span>Inativos</span><span class="exec2-stat-big" style="color:var(--ds-text-tertiary)">${d.inativos}</span></div>
    </div>
  </div>
  <div class="exec2-card">
    <div class="exec2-card-head"><span class="t"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">${SB_ICON.database}</svg>Horas por Casa de Bomba</span></div>
    <div class="exec2-card-body" id="exec2-casabomba"></div>
  </div>`;

  const casasBomba=indicadorHorasPorCasaBomba();
  clrEl('exec2-casabomba',casasBomba.length
    ?barH(casasBomba.map(c=>({l:c.casaBomba,v:c.horas,c:'var(--brand-600)',dec:1,unit:'h'})),110)
    :emEl('Nenhum lançamento de horímetro com casa de bomba definida ainda.'));
}

/* ── EXECUÇÃO DO DIA (Sprint 01.2) — o que já foi irrigado hoje
   (Horímetro). Nenhum campo novo: mesmos registros de horimetroAtivos()
   filtrados por hoje. Cada linha ganha um selo discreto "Concluído"
   (mesmo badge/cor de sucesso já usado em toda a tela). */
/* Ponto 9 — "Executado Hoje" virou "Executado nos Últimos 7 Dias". */
function renderExecutadoHoje(){
  const box=document.getElementById('opdash-executado-hoje'); if(!box) return;
  const {inicio,fim}=ultimosDias(7);
  const pivos=cadAll('pivos')||[];
  const pivoInfo=id=>pivos.find(p=>p.id===id);

  const executados=horimetroAtivos().filter(r=>r.data>=inicio&&r.data<=fim).sort((a,b)=>(b.criadoEm||'').localeCompare(a.criadoEm||''));
  box.innerHTML=`<div class="exec2-card">
    <div class="exec2-card-head"><span class="t"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">${SB_ICON.droplet}</svg>Executado (Últimos 7 Dias)</span>
      <span class="badge b-brand">${executados.length}</span></div>
    <div class="exec2-card-body" style="padding:0">
      <div class="table-wrap">${executados.length?`<table class="table"><thead><tr><th>Data</th><th>Pivô</th><th>Fazenda</th><th>Cultura</th><th>Horas</th><th></th></tr></thead><tbody>${executados.map(r=>{
        const p=pivoInfo(r.pivoId);
        return `<tr><td>${fmtD(r.data)}</td><td><span class="badge b-brand">P.${p?p.numero:'?'}</span></td><td>${p?cadLookupLabel('fazendas',p.fazendaId):'—'}</td><td>${r.cultura||'—'}</td><td>${fmt(r.horas,1)}h</td><td><span class="badge b-success"><svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="3">${SB_ICON.check}</svg>Concluído</span></td></tr>`;
      }).join('')}</tbody></table>`:emEl('Nenhum lançamento de horímetro nos últimos 7 dias.')}</div>
    </div>
  </div>`;
}

/* ── PIVÔS COM PROBLEMAS (Sprint 01.2) — quais pivôs pararam hoje
   (Paradas). Nenhum campo novo: mesmos registros de paradaAtivas()
   filtrados por hoje. Casos críticos (falha.criticidade==='Alta', mesmo
   campo já usado em Cadastros > Falhas e na tabela de Falha/Indicador)
   ganham destaque visual — nenhuma regra de negócio nova, só leitura do
   mesmo dado já cadastrado. */
/* Ponto 9 — "pararam hoje" virou "pararam nos últimos 7 dias". */
function renderPivosComProblemas(){
  const box=document.getElementById('opdash-pivos-problemas'); if(!box) return;
  const {inicio,fim}=ultimosDias(7);
  const pivos=cadAll('pivos')||[];
  const pivoInfo=id=>pivos.find(p=>p.id===id);

  const paradas7d=paradaAtivas().filter(r=>r.data>=inicio&&r.data<=fim).sort((a,b)=>(b.criadoEm||'').localeCompare(a.criadoEm||''));

  /* Ponto 10 — donut por categoria de motivo, derivado da MESMA lista
     paradas7d que alimenta a tabela abaixo (paradaPorCategoria já
     existia em services/parada.js, reaproveitado sem duplicar filtro). */
  const porCategoria=paradaPorCategoria(paradas7d);
  const CORES_CAT={'Mecânico':'#2563eb','Elétrico':'#dc2626','Operacional':'#d97706'};
  const donutHtml=porCategoria.length
    ? donut(porCategoria.map(c=>({v:c.valor,c:CORES_CAT[c.chave]||'#64748b',l:c.chave})),
        fmt(calcAcumulado(paradas7d,'tempoParadoHoras'),1)+'h','parado (7d)',130)
    : '';

  box.innerHTML=`<div class="exec2-card">
    <div class="exec2-card-head"><span class="t"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">${SB_ICON.alert}</svg>Pivôs com Problemas (7 dias)</span>
      <span class="badge ${paradas7d.length?'b-danger':'b-success'}">${paradas7d.length}</span></div>
    <div class="exec2-card-body" style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">
      ${donutHtml?`<div style="flex-shrink:0">${donutHtml}</div>`:''}
      <div class="table-wrap" style="flex:1;min-width:280px">${paradas7d.length?`<table class="table"><thead><tr><th>Data</th><th>Pivô</th><th>Fazenda</th><th>Motivo</th><th>Tempo Parado</th><th>Responsável</th></tr></thead><tbody>${paradas7d.map(r=>{
        const p=pivoInfo(r.pivoId), falha=indicadorFalhaInfo(r.falhaId);
        const critico=falha&&falha.criticidade==='Alta';
        const responsavel=r.tecnicoId?cadLookupLabel('tecnicos',r.tecnicoId):(r.operador||'—');
        return `<tr class="${critico?'op-critical':''}"><td>${fmtD(r.data)}</td><td><span class="badge b-brand">P.${p?p.numero:'?'}</span></td><td>${p?cadLookupLabel('fazendas',p.fazendaId):'—'}</td><td>${falha?`${falha.categoria} — ${falha.motivo}`:(r.motivoTexto||'—')}${critico?' <span class="badge b-danger">Crítico</span>':''}</td><td>${fmt(r.tempoParadoHoras,1)}h</td><td>${responsavel}</td></tr>`;
      }).join('')}</tbody></table>`:emEl('Nenhuma parada registrada nos últimos 7 dias.')}</div>
    </div>
  </div>`;
}

/* ── PENDÊNCIAS / NÃO FEITO (Ponto 5 + Ponto 9) — pivôs planejados nos
   últimos 7 dias que ainda não têm execução (Horímetro) nem parada
   registrada entram como "Pendente"; os que já foram explicitamente
   marcados como Não Feito (planejamentoMarcarNaoFeito, com motivo)
   aparecem separados, mostrando o motivo. Reaproveita
   planejamentoConsultar/horimetroAtivos/paradaAtivas — nenhum
   armazenamento novo. */
function renderPendencias(){
  const box=document.getElementById('opdash-pendencias'); if(!box) return;
  const {inicio,fim}=ultimosDias(7);
  const planejados=planejamentoConsultar({dataInicio:inicio,dataFim:fim});
  const executadosSet=new Set(horimetroAtivos().filter(r=>r.data>=inicio&&r.data<=fim).map(r=>r.pivoId+'_'+r.data));
  const paradaSet=new Set(paradaAtivas().filter(r=>r.data>=inicio&&r.data<=fim).map(r=>r.pivoId));
  const pivos=cadAll('pivos')||[];
  const pivoInfo=id=>pivos.find(x=>x.id===id);

  const naoFeitos=planejados.filter(p=>!executadosSet.has(p.pivoId+'_'+p.data)&&p.naoFeito);
  const pendentes=planejados.filter(p=>!executadosSet.has(p.pivoId+'_'+p.data)&&!p.naoFeito&&!paradaSet.has(p.pivoId));

  const linhaPendente=p=>{
    const pivo=pivoInfo(p.pivoId);
    return `<div class="exec2-list-row">
      <div class="exec2-list-icon i-warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${SB_ICON.pivot}</svg></div>
      <div class="exec2-list-main"><div class="exec2-list-title">P.${pivo?pivo.numero:'?'} · ${pivo?cadLookupLabel('fazendas',pivo.fazendaId):'—'}</div>
        <div class="exec2-list-sub">planejado ${p.percentual}%${p.cultura?' · '+p.cultura:''} · ${fmtD(p.data)}</div></div>
      <button class="btn btn-ghost btn-xs" onclick="opMarcarNaoFeito('${p.grupoId}')">Marcar Não Feito</button>
    </div>`;
  };
  const linhaNaoFeito=p=>{
    const pivo=pivoInfo(p.pivoId);
    return `<div class="exec2-list-row">
      <div class="exec2-list-icon i-danger"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${SB_ICON.pivot}</svg></div>
      <div class="exec2-list-main"><div class="exec2-list-title">P.${pivo?pivo.numero:'?'} · ${pivo?cadLookupLabel('fazendas',pivo.fazendaId):'—'}</div>
        <div class="exec2-list-sub">${fmtD(p.data)} — não feito: ${p.motivoNaoFeito||'—'}</div></div>
      <button class="btn btn-ghost btn-xs" onclick="opDesmarcarNaoFeito('${p.grupoId}')">Desfazer</button>
    </div>`;
  };

  box.innerHTML=`<div class="exec2-card">
    <div class="exec2-card-head"><span class="t"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">${SB_ICON.clockCirc}</svg>Aguardando Execução (7 dias)</span>
      <span class="badge ${pendentes.length?'b-warning':'b-success'}">${pendentes.length}</span></div>
    <div class="exec2-card-body">
      <div class="exec2-list">${pendentes.length?pendentes.map(linhaPendente).join(''):'<div class="exec2-empty">Nenhum pivô planejado está pendente — tudo executado, com parada ou marcado como não feito.</div>'}</div>
    </div>
  </div>
  <div class="exec2-card" style="margin-top:12px">
    <div class="exec2-card-head"><span class="t"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">${SB_ICON.alert}</svg>Não Feito (7 dias)</span>
      <span class="badge ${naoFeitos.length?'b-danger':'b-success'}">${naoFeitos.length}</span></div>
    <div class="exec2-card-body">
      <div class="exec2-list">${naoFeitos.length?naoFeitos.map(linhaNaoFeito).join(''):'<div class="exec2-empty">Nenhum planejamento marcado como não feito nos últimos 7 dias.</div>'}</div>
    </div>
  </div>`;
}

/* Handlers globais (chamados por onclick nas linhas acima) — pedem o
   motivo via prompt (mesma UX simples já usada em confirm() no resto do
   app) e delegam 100% ao service; nenhuma gravação acontece aqui. */
async function opMarcarNaoFeito(grupoId){
  const motivo=prompt('Motivo do não cumprimento (obrigatório):');
  if(motivo===null) return;
  const r=await planejamentoMarcarNaoFeito(grupoId,motivo);
  if(!r.ok){ toast((r.erros&&r.erros[0])||'Não foi possível marcar.','err'); return; }
  toast('Planejamento marcado como não feito.','ok');
  renderPendencias();
}
async function opDesmarcarNaoFeito(grupoId){
  const r=await planejamentoDesmarcarNaoFeito(grupoId);
  if(!r.ok){ toast((r.erros&&r.erros[0])||'Não foi possível desfazer.','err'); return; }
  toast('Marcação desfeita.','ok');
  renderPendencias();
}

/* ── OCORRÊNCIAS (Sprint 01.2) — últimos lançamentos, sempre do mais
   recente para o mais antigo (buildFeedRecente já ordena por criadoEm
   desc). "Pendências do Dia" (pivôs em manutenção) saiu daqui: virou
   confusão de nome com o novo bloco "Pendências" (seção 4) — a mesma
   informação (equipamento em manutenção) já aparece em "Status dos
   Pivôs", então nada foi perdido. */
function renderOcorrencias(){
  const box=document.getElementById('opdash-ocorrencias'); if(!box) return;
  const feed=buildFeedRecente(8);
  box.innerHTML=`<div class="exec2-card">
    <div class="exec2-card-head"><span class="t"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">${SB_ICON.chart}</svg>Últimos Lançamentos</span></div>
    <div class="exec2-card-body">
      <div class="exec2-list">${feed.length?feed.map(feedRowHtml).join(''):'<div class="exec2-empty">Nenhum lançamento ainda.</div>'}</div>
    </div>
  </div>`;
}

/* ── PLANEJAMENTO (Sprint 01.1/01.2) — destaca Planejado/Executado/
   Pendente da SEMANA (planejamentoResumo, mesma função que já cruza
   planejado×executado usada no Resumo Operacional para o dia) — visão
   complementar à de hoje, sem repetir o mesmo recorte de data. */
function renderOpdashPlanejamento(){
  const box=document.getElementById('opdash-planejamento'); if(!box) return;
  const {inicio,fim}=semanaAtual();
  const resumo=planejamentoResumo(inicio,fim);
  box.innerHTML=[
    execKpiCard({label:'Planejado',icon:'calendar',value:resumo.total,sub:'pivôs·dia previstos esta semana'}),
    execKpiCard({label:'Executado',icon:'droplet',value:resumo.feito,sub:`${fmt(resumo.assertividade,0)}% de assertividade`,color:'c-green'}),
    execKpiCard({label:'Pendente',icon:'alert',value:resumo.pendente,sub:'ainda não executado esta semana',color:resumo.pendente>0?'c-amber':'c-green'}),
  ].join('');
}

/* ── AÇÕES RÁPIDAS (Sprint 01.2) — mesmos 5 destinos de sempre
   (sbNavigate), agora como cartões (ícone + título + descrição curta)
   em vez de botões simples — só apresentação, nenhuma ação nova. */
const OPDASH_ACOES=[
  {icon:'droplet',titulo:'Horímetro',desc:'Lançar irrigação executada',key:'horimetros'},
  {icon:'pause',titulo:'Parada',desc:'Registrar parada operacional',key:'paradas'},
  {icon:'calendar',titulo:'Planejamento',desc:'Ver e importar planejamento',key:'planejamentoOp'},
  {icon:'dashboard',titulo:'Indicadores',desc:'Planejado × executado, eficiência',key:'dashboardExecutivo'},
  {icon:'fileText',titulo:'Relatórios',desc:'Exportações e histórico',key:'relat'},
];
function renderAcoesRapidas(){
  const box=document.getElementById('opdash-acoes-rapidas'); if(!box) return;
  box.innerHTML=OPDASH_ACOES.map(a=>`
    <button class="opdash-quick-card" onclick="sbNavigate('${a.key}')">
      <span class="opdash-quick-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${SB_ICON[a.icon]}</svg></span>
      <span class="opdash-quick-card-body"><span class="t">${a.titulo}</span><span class="s">${a.desc}</span></span>
    </button>`).join('');
}

/* ── BLOCO 4 — INDICADORES TÉCNICOS (reaproveita kpi()/gauge() como já
   existiam — só reorganiza visualmente, nenhum cálculo novo) ───────── */
function renderExecIndicadores(){
  const box=document.getElementById('exec2-indicadores'); if(!box) return;
  const hoje=today(), inicioMes=hoje.slice(0,7)+'-01';
  const disp=indicadorDisponibilidade(inicioMes,hoje);
  const util=indicadorUtilizacao(inicioMes,hoje);
  const efic=indicadorEficiencia(inicioMes,hoje);
  const pivos=cadAll('pivos')||[];
  const mtbfs=pivos.map(p=>indicadorMTBF(p.id)).filter(v=>v!==null);
  const mtbf=mtbfs.length?+(mtbfs.reduce((a,b)=>a+b,0)/mtbfs.length).toFixed(1):null;
  const mttr=indicadorMTTR();
  const horasMes=indicadorHorasMes();

  box.innerHTML=`
    <div class="card"><div class="card-body" style="display:flex;justify-content:center">${gauge(disp,disp>=85?'#16a34a':'#d97706','Disponibilidade',inicioMes.slice(0,7)+' até hoje')}</div></div>
    <div class="card"><div class="card-body">${kpi('Utilização',fmtP(util),'','meta: ≥ 70%',util,util>=70?'#16a34a':'#d97706','kpi-teal')}</div></div>
    <div class="card"><div class="card-body">${kpi('Eficiência',fmtP(efic),'','utilização × disponibilidade',efic,'#0284c7','kpi-sky')}</div></div>
    <div class="card"><div class="card-body">${kpi('MTBF Médio',mtbf!==null?fmt(mtbf,1):'—',mtbf!==null?'dias':'','tempo médio entre falhas',null,null,'kpi-purple')}</div></div>
    <div class="card"><div class="card-body">${kpi('MTTR',mttr!==null?fmt(mttr,1):'—',mttr!==null?'h':'','tempo médio de reparo',null,null,'kpi-amber')}</div></div>
    <div class="card"><div class="card-body">${kpi('Horas Trabalhadas',fmt(horasMes,0),'h','no mês corrente',null,null,'kpi-green')}</div></div>`;
}

/* ── BLOCO 5 — GESTÃO ───────────────────────────────────────────────── */
function renderExecGestao(){
  const box=document.getElementById('exec2-gestao'); if(!box) return;
  const auditoria=auditAll().slice(0,6);
  const iconPorOp={'INCLUSÃO':'i-ok','ALTERAÇÃO':'i-info','EXCLUSÃO':'i-danger'};
  const cardA=`<div class="exec2-card">
    <div class="exec2-card-head"><span class="t"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">${SB_ICON.shield}</svg>Auditoria & Últimas Alterações</span>
      <button class="btn btn-ghost btn-xs" onclick="sbNavigate('auditoria')">Ver tudo</button></div>
    <div class="exec2-card-body"><div class="exec2-list">${auditoria.length?auditoria.map(a=>
      execListRow(iconPorOp[a.operacao]||'i-neutral','shield',`${a.tela} · ${a.operacao}`,a.detalhe||'—',a.hora)
    ).join(''):'<div class="exec2-empty">Sem eventos registrados.</div>'}</div></div>
  </div>`;

  const importacoes=auditAll().filter(a=>a.tela==='Importação de Planejamento').slice(0,5);
  const cardB=`<div class="exec2-card">
    <div class="exec2-card-head"><span class="t"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">${SB_ICON.calendar}</svg>Importações Recentes</span></div>
    <div class="exec2-card-body"><div class="exec2-list">${importacoes.length?importacoes.map(a=>
      execListRow('i-info','calendar','Planejamento importado',a.detalhe||'—',a.data)
    ).join(''):'<div class="exec2-empty">Nenhuma importação registrada ainda.</div>'}</div></div>
  </div>`;

  const semCalib=calibracaoPivosSemCalibracao().length;
  const vencidas=calibracaoVencidas(180).length;
  const cardC=`<div class="exec2-card">
    <div class="exec2-card-head"><span class="t"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">${SB_ICON.gaugeCal}</svg>Registros Pendentes</span></div>
    <div class="exec2-card-body">
      <div class="exec2-stat-row"><span>Pivôs sem calibração</span><span class="exec2-stat-big" style="color:${semCalib?'var(--ds-warning)':'var(--ds-success)'}">${semCalib}</span></div>
      <div class="exec2-stat-row"><span>Calibrações vencidas (&gt;180d)</span><span class="exec2-stat-big" style="color:${vencidas?'var(--ds-danger)':'var(--ds-success)'}">${vencidas}</span></div>
      <button class="btn btn-secondary btn-xs" style="margin-top:8px;width:100%" onclick="sbNavigate('calibracao')">Abrir Calibração</button>
    </div>
  </div>`;

  box.innerHTML=cardA+cardB+cardC;
}

/* ── BLOCO 6 — RESERVADO PARA EVOLUÇÃO FUTURA ──────────────────────────
   Estrutura pronta para mapa/calendário/clima: cada slot só aparece
   quando `hasData()` retornar true. Hoje nenhum tem fonte de dado real,
   então o bloco inteiro fica oculto automaticamente. O COI é um sistema
   de gestão operacional alimentado manualmente pela equipe — por isso
   nenhum slot de telemetria/monitoramento automático é mantido aqui
   (Fase 13.1). ────────────────────────────────────────────────────── */
const EXEC_FUTURE_WIDGETS=[
  {key:'mapaFazendas',label:'Mapa das Fazendas',desc:'Geolocalização das fazendas cadastradas',icon:'farm',hasData:()=>false},
  {key:'mapaPivos',label:'Mapa dos Pivôs',desc:'Geolocalização e status dos pivôs',icon:'pivot',hasData:()=>false},
  {key:'calendario',label:'Calendário Operacional',desc:'Agenda de manutenções e calibrações',icon:'calendar',hasData:()=>false},
  {key:'linhaTempo',label:'Linha do Tempo',desc:'Histórico consolidado por pivô',icon:'clockCirc',hasData:()=>false},
  {key:'clima',label:'Integração Meteorológica',desc:'Previsão do tempo por fazenda',icon:'droplet',hasData:()=>false},
];
function renderExecFuturo(){
  const wrap=document.getElementById('exec2-futuro-wrap'), box=document.getElementById('exec2-futuro');
  if(!wrap||!box) return;
  const disponiveis=EXEC_FUTURE_WIDGETS.filter(w=>w.hasData());
  if(!disponiveis.length){ wrap.style.display='none'; return; }
  wrap.style.display='';
  box.innerHTML=disponiveis.map(w=>`<div class="exec2-future-slot">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${SB_ICON[w.icon]||''}</svg>
    <div class="t">${w.label}</div><div class="s">${w.desc}</div>
  </div>`).join('');
}

/* ── ANALÍTICO CONSOLIDADO ─────────────────────────────────────────
   Aberto por padrão (Fase 11.0): é onde vive a base ETL real e volumosa
   (dezenas de milhares de registros) — mantê-lo recolhido por padrão
   fazia o Dashboard Executivo abrir mostrando só os blocos "Indicadores
   Técnicos"/"Gestão" (lançamentos locais, zerados enquanto ninguém
   lançar nada pela tela nova), dando a falsa impressão de painel sem
   dados. A preferência do usuário (uma vez que ele mesmo recolhe/abre)
   continua respeitada normalmente. */
function toggleExecAnalitico(){
  const body=document.getElementById('exec2-analitico-body');
  const chev=document.getElementById('exec2-analitico-chevron');
  if(!body) return;
  const aberto=body.style.display==='none';
  body.style.display=aberto?'':'none';
  if(chev) chev.style.transform=aberto?'rotate(180deg)':'';
  localStorage.setItem('coi_exec_analitico_aberto',aberto?'1':'0');
}
function restoreExecAnaliticoState(){
  const body=document.getElementById('exec2-analitico-body');
  const chev=document.getElementById('exec2-analitico-chevron');
  if(!body) return;
  const pref=localStorage.getItem('coi_exec_analitico_aberto');
  const aberto=pref===null?true:pref==='1';
  body.style.display=aberto?'':'none';
  if(chev) chev.style.transform=aberto?'rotate(180deg)':'';
}

/* ── ORQUESTRADORES (Fase 10.0) ───────────────────────────────────────
   Dashboard Executivo (#page-exec) ficou só com gestão/indicadores
   técnicos — o que era operacional (KPIs do dia, status de pivôs,
   últimos lançamentos, espaço reservado) mudou para o novo Painel
   Operacional (#page-opdash, renderOpDash). A saudação/hero foi para a
   Home (#page-home, renderHome). Nenhuma das funções de Bloco mudou de
   comportamento — só quem as chama e onde elas montam o HTML. */
function renderExecLive(){
  renderExecIndicadores();
  renderExecGestao();
  restoreExecAnaliticoState();
}

/* "Indicadores do dia" (Fase 10.1, consolidado na Sprint 01) — antes
   dividido em dois blocos que repetiam "Paradas"/"Equipamentos Ativos"
   ("Indicadores do Dia" e "Visão Geral"); agora é um só bloco, sem
   cartão repetido. "Equipamentos Ativos" saiu daqui porque já é o
   próprio bloco "Status dos Pivôs" (renderStatusPivos), com
   mais detalhe (operação/manutenção/inativos). Todos os números vêm de
   funções que já existiam em services/indicador.js, parada.js etc. ou
   de computeKpisPrincipaisData — nenhum cálculo novo. */
/* Ponto 9 — "hoje" virou "últimos 7 dias" (janela rolante). */
function renderIndicadoresDoDia(){
  const box=document.getElementById('opdash-indicadores-dia'); if(!box) return;
  const {inicio,fim}=ultimosDias(7);
  const horas7d=calcAcumulado(horimetroAtivos().filter(r=>r.data>=inicio&&r.data<=fim));
  const falhas7d=indicadorAtivos().filter(r=>r.data>=inicio&&r.data<=fim).length;
  const d=computeKpisPrincipaisData();

  box.innerHTML=[
    execKpiCard({label:'Horas Trabalhadas',icon:'droplet',value:fmt(horas7d,1),unit:'h',sub:'últimos 7 dias, todos os pivôs'}),
    execKpiCard({label:'Paradas',icon:'pause',value:d.parSemAtual,sub:`${d.parSemAtual} nos últimos 7 dias`,trend:execTrend(d.parSemAtual,d.parSemAnt),color:d.parSemAtual>0?'c-amber':'c-green'}),
    execKpiCard({label:'Falhas',icon:'alert',value:falhas7d,sub:'ocorrências nos últimos 7 dias',color:falhas7d>0?'c-red':'c-green'}),
    execKpiCard({label:'Fertirrigações',icon:'droplet',value:d.fertiSemAtual,sub:`${d.fertiSemAtual} nos últimos 7 dias`,trend:execTrend(d.fertiSemAtual,d.fertiSemAnt)}),
    execKpiCard({label:'Calibrações Recentes',icon:'gaugeCal',value:d.cal30,sub:d.calUlt?`última em ${fmtD(d.calUlt.data)}`:'sem calibrações registradas'}),
  ].join('');
}

/* Ponto 9 — "apresentar pivôs em lista": 1 linha por pivô ATIVO do
   cadastro, com o que aconteceu nos últimos 7 dias — feito (tem
   Horímetro), não feito (marcado explicitamente, Ponto 5), horas
   trabalhadas, nº de paradas e duração total parada. "Situação" resume
   os 3 (Operando/Parado/Sem lançamento). Nenhum dado inventado: pivô
   sem nenhum registro no período mostra tudo zerado/"—", não é omitido
   nem preenchido com valor arbitrário. */
function renderPivosUltimos7Dias(){
  const box=document.getElementById('opdash-pivos-7d'); if(!box) return;
  const {inicio,fim}=ultimosDias(7);
  const pivos=(cadAll('pivos')||[]).filter(p=>p.status==='Ativo').sort((a,b)=>a.numero-b.numero);
  const hor7d=horimetroAtivos().filter(r=>r.data>=inicio&&r.data<=fim);
  const par7d=paradaAtivas().filter(r=>r.data>=inicio&&r.data<=fim);
  const plan7d=planejamentoConsultar({dataInicio:inicio,dataFim:fim});

  const linhas=pivos.map(p=>{
    const horP=hor7d.filter(r=>r.pivoId===p.id);
    const parP=par7d.filter(r=>r.pivoId===p.id);
    const planP=plan7d.filter(r=>r.pivoId===p.id);
    const horas=calcAcumulado(horP);
    const duracaoParada=calcAcumulado(parP,'tempoParadoHoras');
    const feito=horP.length>0;
    const naoFeito=!feito&&planP.some(pl=>pl.naoFeito);
    const situacao=feito?'Operando':(parP.length>0?'Parado':(naoFeito?'Não Feito':'Sem lançamento'));
    const corSituacao=feito?'b-success':(parP.length>0?'b-danger':(naoFeito?'b-warning':'b-neutral'));
    return `<tr>
      <td><span class="badge b-brand">P.${p.numero}</span></td>
      <td>${cadLookupLabel('fazendas',p.fazendaId)}</td>
      <td>${feito?'<span class="badge b-success">Feito</span>':(naoFeito?'<span class="badge b-warning">Não Feito</span>':'<span class="badge b-neutral">—</span>')}</td>
      <td>${fmt(horas,1)}h</td>
      <td>${parP.length}</td>
      <td>${fmt(duracaoParada,1)}h</td>
      <td><span class="badge ${corSituacao}">${situacao}</span></td>
    </tr>`;
  }).join('');

  box.innerHTML=`<div class="exec2-card">
    <div class="exec2-card-body" style="padding:0">
      <div class="table-wrap">${pivos.length?`<table class="table"><thead><tr><th>Pivô</th><th>Fazenda</th><th>Feito?</th><th>Horas (7d)</th><th>Paradas (7d)</th><th>Duração Parada (7d)</th><th>Situação</th></tr></thead><tbody>${linhas}</tbody></table>`:emEl('Nenhum pivô ativo cadastrado.')}</div>
    </div>
  </div>`;
}

function renderOpDash(){
  renderResumoOperacional();
  renderStatusPivos();
  renderIndicadoresDoDia();
  renderPivosUltimos7Dias();
  renderExecutadoHoje();
  renderPivosComProblemas();
  renderPendencias();
  renderOcorrencias();
  renderOpdashPlanejamento();
  renderAcoesRapidas();
  renderExecFuturo();
}

/* ── PORTAL COI — ENTRADA (Fase 12.0) ──────────────────────────────
   6 cartões grandes, um por módulo (Operação/Lançamentos/Indicadores/
   Relatórios/Cadastros/Administração) — mesma fonte de dado real de
   sempre (services já existentes ou EXPORT_DEFS/usuariosTodos), só
   reordenados/rotulados para casar com os 6 módulos da Fase 12.0.
   "Indicadores" agora manda para o antigo Dashboard Executivo
   (key:'dashboardExecutivo' → #page-exec), que passou a ser a landing
   desse módulo em vez de tela inicial (ver js/nav.js SB_MODULES). Cada
   cartão ganha uma classe `mod-*` só para a cor de destaque (CSS),
   sem nenhuma lógica nova. */
function renderHomeModuleCards(){
  const box=document.getElementById('home-module-cards'); if(!box) return;
  const pivos=cadAll('pivos')||[];
  const ativos=pivos.filter(p=>p.status==='Ativo').length;
  const lancTotal=horimetroAtivos().length+paradaAtivas().length+fertiAtivos().length+calibracaoAtivas().length;
  const lancUlt=buildFeedRecente(1)[0];
  const falhasTotal=indicadorAtivos().length;
  const cadTotal=Object.keys(CAD_ENTITIES).reduce((a,k)=>a+(cadAll(k)||[]).length,0);
  const relatModulos=typeof EXPORT_DEFS!=='undefined'?Object.keys(EXPORT_DEFS).length:0;
  const usuariosTotal=typeof usuariosTodos==='function'?usuariosTodos().length:0;

  const cards=[
    {key:'painelOperacional',mod:'operacao',label:'Centro de Operações',desc:'Painel operacional em tempo real, por pivô.',icon:'monitor',
      qty:`${ativos.toLocaleString('pt-BR')} de ${pivos.length} pivôs ativos`,status:ativos===pivos.length&&pivos.length>0?'Em dia':'Atenção',statusOk:ativos===pivos.length},
    {key:'horimetros',mod:'lancamentos',label:'Lançamentos',desc:'Irrigação executada, não executada, fertirrigação e calibração.',icon:'droplet',
      qty:`${lancTotal.toLocaleString('pt-BR')} lançamentos`,status:lancUlt?`último em ${fmtD(lancUlt.data)}`:'Nenhum ainda',statusOk:!!lancUlt},
    {key:'dashboardExecutivo',mod:'indicadores',label:'Indicadores',desc:'Planejado × executado, disponibilidade, MTBF/MTTR, tendências.',icon:'chart',
      qty:`${falhasTotal.toLocaleString('pt-BR')} ocorrências de falha`,status:'Ativo',statusOk:true},
    {key:'relat',mod:'relatorios',label:'Relatórios',desc:'Operacionais, gerenciais, exportações e histórico.',icon:'fileText',
      qty:`${relatModulos} módulos exportáveis`,status:'Disponível',statusOk:true},
    {key:'pivos',mod:'cadastros',label:'Cadastros',desc:'Pivôs, fazendas, equipamentos, produtos e mais.',icon:'pivot',
      qty:`${cadTotal.toLocaleString('pt-BR')} registros`,status:'Ativo',statusOk:true},
    {key:'usuarios',mod:'administracao',label:'Administração',desc:'Usuários, perfis, permissões e auditoria.',icon:'lock',
      qty:`${usuariosTotal.toLocaleString('pt-BR')} usuário(s) registrado(s)`,status:'Estrutura preparada',statusOk:null},
  ];
  box.innerHTML=cards.map(c=>`
    <div class="home-card mod-${c.mod}">
      <div class="home-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${SB_ICON[c.icon]||''}</svg></div>
      <div class="home-card-body">
        <div class="home-card-title">${c.label}</div>
        <div class="home-card-desc">${c.desc}</div>
        <div class="home-card-meta">
          <span class="home-card-qty">${c.qty}</span>
          <span class="home-card-status ${c.statusOk===true?'ok':c.statusOk===false?'warn':'neutral'}">${c.status}</span>
        </div>
      </div>
      <button class="btn btn-primary btn-xs home-card-btn" onclick="sbNavigate('${c.key}')">Acessar</button>
    </div>`).join('');
}

/* renderHomeQuickStats/renderHomeAtividades existiam até a Fase 11.x —
   removidas na Fase 12.0 (Portal COI): o mesmo recorte de KPIs do dia
   e o mesmo feed de atividades (buildFeedRecente) já vivem na landing
   do módulo Operação (Painel Operacional, renderIndicadoresDoDia/
   renderOcorrencias) — manter os dois em telas diferentes duplicava
   a mesma informação em vez de reforçá-la. */
function renderHome(){
  renderExecHero();
  renderHomeModuleCards();
}
