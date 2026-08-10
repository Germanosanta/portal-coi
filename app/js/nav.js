/* ── SIDEBAR: RECOLHER/EXPANDIR (DESKTOP) ────────────────────────── */
function toggleSB(){
  const wrap=document.getElementById('sb-wrap'), main=document.getElementById('main');
  const collapsed=wrap.classList.toggle('collapsed');
  main.classList.toggle('sb-collapsed',collapsed);
  localStorage.setItem('coi_sb_collapsed',collapsed?'1':'0');
}

/* ── SIDEBAR: DRAWER MOBILE ───────────────────────────────────────── */
function toggleMobileSB(){
  document.getElementById('sb-wrap').classList.toggle('mobile-open');
  document.getElementById('ov').classList.toggle('show');
}
function closeMobileSB(){
  document.getElementById('sb-wrap').classList.remove('mobile-open');
  document.getElementById('ov').classList.remove('show');
}

/* ── TEMA CLARO/ESCURO ────────────────────────────────────────────── */
function toggleTheme(){
  const next=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',next);
  localStorage.setItem('coi_theme',next);
  updateThemeIcon(next);
}
function updateThemeIcon(theme){
  const btn=document.getElementById('theme-btn');
  if(btn) btn.title=theme==='dark'?'Tema escuro (clique para claro)':'Tema claro (clique para escuro)';
  const cfgBtn=document.getElementById('cfg-theme-btn');
  if(cfgBtn) cfgBtn.textContent=theme==='dark'?'Escuro':'Claro';
}

/* ── ABAS GENÉRICAS (.tabs / .tab-btn / .tab-panel) ──────────────── */
function swTab(id,btn){
  const bar=btn.closest('.tabs,#lanc-tabs');
  if(bar) bar.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const scope=bar?bar.parentElement:document;
  scope.querySelectorAll(':scope > .tab-panel').forEach(p=>p.classList.remove('active'));
  const target=document.getElementById(id);
  if(target) target.classList.add('active');
  if(id.startsWith('cad-')&&typeof CAD_ENTITIES!=='undefined'){
    const entity=id.slice(4);
    if(CAD_ENTITIES[entity]) cadRenderList(entity);
  }
}

/* ── RESPONSIVO ───────────────────────────────────────────────────── */
function checkResponsive(){
  if(window.innerWidth>768){
    closeMobileSB();
    const saved=localStorage.getItem('coi_sb_collapsed')==='1';
    document.getElementById('sb-wrap').classList.toggle('collapsed',saved);
    document.getElementById('main').classList.toggle('sb-collapsed',saved);
  }
}

/* ── RELÓGIO DO TOPBAR ────────────────────────────────────────────── */
function updateClock(){
  const el=document.getElementById('tb-time');
  if(el) el.textContent=now();
  const heroEl=document.getElementById('exec2-hero-clock');
  if(heroEl) heroEl.textContent=(now().split(', ')[1]||'');
}

/* ── STATUS DA BASE (RODAPÉ DA SIDEBAR) ───────────────────────────── */
function atuSB(){
  const el=document.getElementById('sb-footer-info');
  if(!el) return;
  const total=(HOR_D.length||0)+(EXE_D.length||0)+(ITV_D.length||0)+(FERTI_D.length||0)+(FAL_D.length||0);
  const fonte=DATA_SOURCE==='remoto'?'Base consolidada (ETL)':'Modo simulado · sem conexão';
  el.innerHTML=`<strong>${total.toLocaleString('pt-BR')}</strong> registros carregados<br>${fonte}`;
}

/* ── PREENCHIMENTO DE SELECTS DE FILTRO ───────────────────────────── */
function fillSelect(id,optionsHtml,allLabel){
  const el=document.getElementById(id);
  if(!el) return;
  el.innerHTML=`<option value="">${allLabel}</option>`+optionsHtml;
}
function buildSelects(){
  const pivos=(D.pivos_cad||[]).slice().sort((a,b)=>a[0]-b[0]);
  fillSelect('fi-pv',pivos.map(p=>`<option value="${p[0]}" data-faz="${p[1]||''}">P.${p[0]} (${p[1]||'—'})</option>`).join(''),'Todos');
  // Fonte única de verdade para culturas: o cadastro (js/cadastro.js), não o
  // JSON estático (esse só alimenta a semente inicial do cadastro).
  const cultNomes=(typeof cadAll==='function'?cadAll('culturas'):[]).map(c=>c.nome).sort();
  const cultOpts=cultNomes.map(c=>`<option>${c}</option>`).join('');
  fillSelect('ff-cl',cultOpts,'Todas');
  fillSelect('fh-cl',cultOpts,'Todas');

  const areaSel=document.getElementById('lhm-area');
  if(areaSel&&(AREAS_ALL||[]).length){
    areaSel.innerHTML=AREAS_ALL.map(a=>`<option value="${a}">${a}</option>`).join('');
  }

  const fazendas=typeof cadAll==='function'?cadAll('fazendas'):[];
  const fazOptsPlain=fazendas.map(f=>`<option>${f.nome}</option>`).join('');
  const lhmFaz=document.getElementById('lhm-faz');
  if(lhmFaz) lhmFaz.innerHTML='<option value="">Selecione...</option>'+fazOptsPlain;
  fillSelect('lhm-hist-faz',fazOptsPlain,'Fazenda');

  const pivosCad=(typeof cadAll==='function'?cadAll('pivos'):[]).slice().sort((a,b)=>a.numero-b.numero);
  const pivoOptsCad=pivosCad.map(p=>`<option value="${p.id}">P.${p.numero}</option>`).join('');
  const lhfPivo=document.getElementById('lhf-pivo');
  if(lhfPivo) lhfPivo.innerHTML='<option value="">Selecione...</option>'+pivoOptsCad;
  fillSelect('lhf-filtro-pivo',pivoOptsCad,'Pivô');

  const categorias=[...new Set((typeof cadAll==='function'?cadAll('falhas'):[]).map(f=>f.categoria))].sort();
  const lhfCat=document.getElementById('lhf-cat');
  if(lhfCat) lhfCat.innerHTML='<option value="">Selecione...</option>'+categorias.map(c=>`<option>${c}</option>`).join('');

  fillSelect('lhf-filtro-faz',fazendas.map(f=>`<option value="${f.id}">${f.nome}</option>`).join(''),'Fazenda');
  const casas=(typeof cadAll==='function'?cadAll('casasBomba'):[]);
  fillSelect('lhf-filtro-cb',casas.map(c=>`<option value="${c.id}">${c.nome}</option>`).join(''),'Casa de Bomba');

  const lpFaz=document.getElementById('lp-faz');
  if(lpFaz) lpFaz.innerHTML='<option value="">Selecione...</option>'+fazOptsPlain;
  fillSelect('lp-filtro-faz',fazendas.map(f=>`<option value="${f.id}">${f.nome}</option>`).join(''),'Fazenda');
  fillSelect('lp-filtro-cb',casas.map(c=>`<option value="${c.id}">${c.nome}</option>`).join(''),'Casa de Bomba');
  fillSelect('lp-filtro-pivo',pivoOptsCad,'Pivô');
  const tecnicos=(typeof cadAll==='function'?cadAll('tecnicos'):[]);
  const lpTecnico=document.getElementById('lp-tecnico');
  if(lpTecnico) lpTecnico.innerHTML='<option value="">Não informado</option>'+tecnicos.map(t=>`<option value="${t.id}">${t.nome}</option>`).join('');

  const lftFaz=document.getElementById('lft-faz');
  if(lftFaz) lftFaz.innerHTML='<option value="">Selecione...</option>'+fazOptsPlain;
  fillSelect('lft-filtro-faz',fazendas.map(f=>`<option value="${f.id}">${f.nome}</option>`).join(''),'Fazenda');
  fillSelect('lft-filtro-cb',casas.map(c=>`<option value="${c.id}">${c.nome}</option>`).join(''),'Casa de Bomba');
  fillSelect('lft-filtro-pivo',pivoOptsCad,'Pivô');
  const lftCultura=document.getElementById('lft-cultura');
  if(lftCultura) lftCultura.innerHTML='<option value="">Selecione...</option>'+cultNomes.map(c=>`<option>${c}</option>`).join('');
  const produtos=(typeof cadAll==='function'?cadAll('produtos'):[]).filter(p=>p.status==='Ativo');
  const lftProduto=document.getElementById('lft-produto');
  if(lftProduto) lftProduto.innerHTML='<option value="">Selecione...</option>'+produtos.map(p=>`<option value="${p.id}">${p.nome}</option>`).join('');

  const lcFaz=document.getElementById('lc-faz');
  if(lcFaz) lcFaz.innerHTML='<option value="">Selecione...</option>'+fazOptsPlain;
  fillSelect('lc-filtro-faz',fazendas.map(f=>`<option value="${f.id}">${f.nome}</option>`).join(''),'Fazenda');
  fillSelect('lc-filtro-pivo',pivoOptsCad,'Pivô');
  const lcResponsavel=document.getElementById('lc-responsavel');
  if(lcResponsavel) lcResponsavel.innerHTML='<option value="">Não informado</option>'+tecnicos.map(t=>`<option value="${t.id}">${t.nome}</option>`).join('');
  const lcMetodo=document.getElementById('lc-metodo');
  if(lcMetodo) lcMetodo.innerHTML=(typeof METODOS_CALIBRACAO!=='undefined'?METODOS_CALIBRACAO:[]).map(m=>`<option>${m}</option>`).join('');

  /* Consulta Operacional unificada (Sprint 01.3) — mesmos cadastros já
     usados acima (fazendas/casas/pivoOptsCad/cultNomes), só reaproveitados
     para os novos filtros. Responsável/Tipo/Status são preenchidos pelo
     próprio js/consulta.js (dependem dos lançamentos, não do cadastro). */
  fillSelect('dq-faz',fazendas.map(f=>`<option value="${f.id}">${f.nome}</option>`).join(''),'Todas');
  fillSelect('dq-cb',casas.map(c=>`<option value="${c.id}">${c.nome}</option>`).join(''),'Todas');
  fillSelect('dq-pivo',pivoOptsCad,'Todos');
  fillSelect('dq-cultura',cultNomes.map(c=>`<option>${c}</option>`).join(''),'Todas');
}
function filterPivoByFazenda(){
  const faz=v('fi-faz'), sel=document.getElementById('fi-pv');
  if(!sel) return;
  [...sel.options].forEach(o=>{ if(!o.value) return; o.hidden=!!faz&&o.dataset.faz!==faz; });
  sel.value='';
}

/* ── PESQUISA RÁPIDA (TOPBAR) ─────────────────────────────────────── */
/* Pesquisa global (Fase 10.0) — cobre menus, pivôs e os principais
   cadastros de referência (fazendas/culturas/produtos/operadores).
   Navega sempre pelas mesmas rotas já existentes (sbNavigate/goPage);
   para os cadastros, leva até a aba certa — não filtra o registro
   exato dentro dela (isso já tem busca própria em cada tela). */
function gsInput(e){
  const q=(e&&e.target?e.target.value:v('gs-input')).trim().toLowerCase();
  const box=document.getElementById('gs-results');
  if(!box) return;
  if(!q){ closeGS(); return; }

  const cad=key=>(typeof cadAll==='function'?cadAll(key):[])||[];
  const moduloMatches=SB_MODULES.filter(m=>m.label.toLowerCase().includes(q)).slice(0,6);
  const pivoMatches=(D.pivos_cad||[]).filter(p=>String(p[0]).includes(q)).slice(0,5);
  const fazendaMatches=cad('fazendas').filter(f=>f.nome.toLowerCase().includes(q)).slice(0,4);
  const culturaMatches=cad('culturas').filter(c=>c.nome.toLowerCase().includes(q)).slice(0,4);
  const produtoMatches=cad('produtos').filter(p=>p.nome.toLowerCase().includes(q)).slice(0,4);
  const operadorMatches=cad('operadores').filter(o=>o.nome.toLowerCase().includes(q)).slice(0,4);

  let html='';
  if(moduloMatches.length) html+='<div class="gs-group">Menus</div>'+moduloMatches.map(m=>
    `<div class="gs-item" onclick="sbNavigate('${m.key}');closeGS()">${m.label} <span style="color:var(--text-tertiary);font-size:10px">— ${m.group}</span></div>`).join('');
  if(pivoMatches.length) html+='<div class="gs-group">Pivôs</div>'+pivoMatches.map(p=>`<div class="gs-item" onclick="gsGoPivo('${p[0]}')">Pivô ${p[0]} · ${p[1]||'—'}</div>`).join('');
  if(fazendaMatches.length) html+='<div class="gs-group">Fazendas</div>'+fazendaMatches.map(f=>`<div class="gs-item" onclick="sbNavigate('fazendas');closeGS()">${f.nome}</div>`).join('');
  if(culturaMatches.length) html+='<div class="gs-group">Culturas</div>'+culturaMatches.map(c=>`<div class="gs-item" onclick="sbNavigate('culturas');closeGS()">${c.nome}</div>`).join('');
  if(produtoMatches.length) html+='<div class="gs-group">Produtos</div>'+produtoMatches.map(p=>`<div class="gs-item" onclick="sbNavigate('produtos');closeGS()">${p.nome}</div>`).join('');
  if(operadorMatches.length) html+='<div class="gs-group">Operadores</div>'+operadorMatches.map(o=>`<div class="gs-item" onclick="sbNavigate('operadores');closeGS()">${o.nome}</div>`).join('');

  box.innerHTML=html||'<div class="gs-empty">Nenhum resultado</div>';
  box.classList.add('show');
}
function gsGoPivo(pivo){
  goPage('irrig');
  setTimeout(()=>{ const sel=document.getElementById('fi-pv'); if(sel){ sel.value=pivo; applyF('irrig'); } },0);
  closeGS();
}
function closeGS(){
  const box=document.getElementById('gs-results'); if(box){ box.classList.remove('show'); box.innerHTML=''; }
  const inp=document.getElementById('gs-input'); if(inp) inp.value='';
}
document.addEventListener('click',e=>{ if(!e.target.closest('#gs-wrap')) closeGS(); });

/* ── NOTIFICAÇÕES ─────────────────────────────────────────────────── */
let NOTIFS=[];
function pushNotif(msg,type='info'){
  NOTIFS.unshift({msg,type,time:now()});
  NOTIFS=NOTIFS.slice(0,20);
  renderNotifs();
  toast(msg,type);
}
function clearNotifs(){ NOTIFS=[]; renderNotifs(); }
function renderNotifs(){
  const badge=document.getElementById('notif-badge');
  if(badge){ badge.textContent=NOTIFS.length>9?'9+':NOTIFS.length; badge.style.display=NOTIFS.length?'flex':'none'; }
  const list=document.getElementById('notif-list');
  if(!list) return;
  list.innerHTML=NOTIFS.length?NOTIFS.map(n=>`<div class="notif-item notif-${n.type}"><div class="notif-dot"></div><div><div class="notif-msg">${n.msg}</div><div class="notif-time">${n.time}</div></div></div>`).join(''):'<div class="notif-empty">Sem notificações</div>';
}
function toggleNotifPanel(){ document.getElementById('notif-panel').classList.toggle('show'); }
function closeNotifPanel(){ const p=document.getElementById('notif-panel'); if(p) p.classList.remove('show'); }
document.addEventListener('click',e=>{ if(!e.target.closest('#notif-wrap')) closeNotifPanel(); });

/* ── SIDEBAR — MÓDULOS (Fase 9.2, reorganizado na Fase 10.0) ───────────
   Fonte única dos itens da sidebar: cada módulo aponta para uma página
   já existente (goPage) e, quando o destino é uma aba dentro de uma
   página (Lançamentos/Cadastros/Banco de Dados), executa exatamente a
   mesma função de troca de aba que os botões dessas abas já usam
   (lhm.tabNav / clique programático no botão real de swTab) — nenhuma
   lógica de navegação nova é criada, só reaproveitada. ─────────────── */
const SB_ICON={
  dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  droplet:'<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
  alert:'<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>',
  pause:'<circle cx="12" cy="12" r="9"/><line x1="9" y1="9" x2="9" y2="15"/><line x1="15" y1="9" x2="15" y2="15"/>',
  calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/>',
  gaugeCal:'<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/><path d="M12 8v4l2 2"/>',
  pivot:'<circle cx="12" cy="12" r="2.2"/><path d="M12 12 4 6M12 12l9-2M12 12l-3 8M12 12l6 6"/><circle cx="12" cy="12" r="9"/>',
  farm:'<path d="M3 21V10l9-6 9 6v11"/><path d="M9 21v-6h6v6"/>',
  house:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>',
  pulse:'<path d="M3 12h4l3 8 4-16 3 8h4"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  box:'<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
  user:'<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  wrench:'<path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 1 5.4-5.4z"/>',
  leaf:'<path d="M5 21c2-9 6-15 16-17 0 13-7 17-16 17Z"/>',
  chart:'<path d="M4 20V10M12 20V4M20 20v-7"/><path d="M2.5 20h19"/>',
  database:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  trending:'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  clockCirc:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 3.5"/>',
  fileText:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>',
  star:'<path d="M12 2.5l3 6.2 6.5.9-4.8 4.6 1.2 6.6L12 17.8 5.9 20.8l1.2-6.6L2.3 9.6l6.5-.9z"/>',
  chevronDown:'<path d="m6 9 6 6 6-6"/>',
  monitor:'<rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  panel:'<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="7" x2="8" y2="7.01"/><line x1="8" y1="12" x2="8" y2="12.01"/><line x1="8" y1="17" x2="8" y2="17.01"/>',
  sensor:'<path d="M12 20h.01"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 13a10 10 0 0 1 14 0"/>',
  tag:'<path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.2L3 3v6.59a2 2 0 0 0 .59 1.41l9.59 9.59a2 2 0 0 0 2.82 0l4.59-4.59a2 2 0 0 0 0-2.82Z"/><circle cx="7.5" cy="7.5" r="1"/>',
  archive:'<path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>',
  sync:'<path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-9-9 9 9 0 0 1 9-9c2.52 0 4.85.99 6.4 2.6"/><path d="M21 3v6h-6"/>',
  users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  idcard:'<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 17c0-2 2-3 4-3s4 1 4 3"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  link:'<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  check:'<polyline points="20 6 9 17 4 12"/>',
};

function sbClickTab(pageId,match){
  const btn=document.querySelector(`#page-${pageId} .tab-btn[onclick*="${match}"]`);
  if(btn) btn.click();
}

const SB_MODULES=[
  // Centro de Operações (Fase 12.1, era "Operação") — landing operacional
  // do dia a dia (Lançamentos virou módulo próprio, ver abaixo).
  {key:'painelOperacional',label:'Painel Operacional',desc:'Operação em tempo real',group:'Centro de Operações',icon:'monitor',page:'opdash',dataPage:'opdash'},
  {key:'planejamentoOp',label:'Planejamento',desc:'Importar planejamento de irrigação',group:'Centro de Operações',icon:'calendar',page:'dados',after:()=>sbClickTab('dados','dt-import')},

  // Lançamentos — módulo próprio (Fase 12.0). Lista simples (Fase 13.1):
  // os nomes (Horímetro/Paradas/Falhas/Fertirrigação/Calibração/Histórico/
  // Auditoria) já representam o processo operacional sem precisar de
  // rótulos de grupo adicionais.
  {key:'horimetros',label:'Horímetro',desc:'Registrar leituras de horímetro',group:'Lançamentos',icon:'droplet',page:'lanc',after:()=>lhm.tabNav('lanc')},
  {key:'paradas',label:'Paradas',desc:'Registrar parada e motivo',group:'Lançamentos',icon:'pause',page:'lanc',after:()=>lhm.tabNav('parada')},
  {key:'indicadoresOp',label:'Falhas',desc:'Registrar falha/indicador',group:'Lançamentos',icon:'alert',page:'lanc',after:()=>lhm.tabNav('falha')},
  {key:'fertirrigacao',label:'Fertirrigação',desc:'Registrar aplicações de fertirrigação',group:'Lançamentos',icon:'droplet',page:'lanc',after:()=>lhm.tabNav('ferti')},
  {key:'calibracao',label:'Calibração',desc:'Calibrar lâmina por pivô',group:'Lançamentos',icon:'gaugeCal',page:'lanc',after:()=>lhm.tabNav('calibracao')},
  {key:'historico',label:'Histórico',desc:'Histórico de lançamentos de horímetro',group:'Lançamentos',icon:'clockCirc',page:'lanc',after:()=>lhm.tabNav('historico')},
  {key:'auditoria',label:'Auditoria',desc:'Histórico de alterações do sistema',group:'Lançamentos',icon:'shield',page:'lanc',after:()=>lhm.tabNav('auditoria')},

  // Indicadores (Fase 12.1) — toda a parte analítica, o que antes vivia
  // só no "Dashboard Executivo" é a landing deste módulo ("Visão Geral").
  // Rótulos alinhados à separação pedida (Visão Geral/Planejado×Executado/
  // Eficiência/Paradas/Consumo/Equipamentos/Histórico) — "Histórico" não
  // ganhou item próprio porque já existe dentro de "Visão Geral", na
  // seção "Analítico Consolidado" (evolução mensal/top pivôs/causas).
  {key:'dashboardExecutivo',label:'Visão Geral',desc:'Indicadores técnicos, gestão e analítico consolidado (ETL)',group:'Indicadores',icon:'dashboard',page:'exec',dataPage:'exec'},
  {key:'irrig',label:'Planejado x Executado',desc:'Planejado × Executado (ETL)',group:'Indicadores',icon:'trending',page:'irrig',dataPage:'irrig'},
  {key:'indicadores',label:'Eficiência',desc:'Disponibilidade, utilização, eficiência, MTBF/MTTR',group:'Indicadores',icon:'chart',page:'fal',dataPage:'fal'},
  {key:'itv',label:'Paradas',desc:'Análise de tempos de parada (ETL)',group:'Indicadores',icon:'clockCirc',page:'itv',dataPage:'itv'},
  {key:'fertiAnalitico',label:'Consumo',desc:'Consumo de produtos de fertirrigação (Analítico)',group:'Indicadores',icon:'droplet',page:'ferti',dataPage:'ferti'},
  {key:'horEtl',label:'Equipamentos',desc:'Base consolidada de horímetro por equipamento',group:'Indicadores',icon:'gaugeCal',page:'hor',dataPage:'hor'},
  {key:'energia',label:'Consumo de Energia',desc:'kWh estimados a partir da irrigação executada',group:'Indicadores',icon:'trending',page:'energia',dataPage:'energia'},

  // Cadastros — 6 mais usados + "Outros" (as 9 entidades restantes seguem
  // acessíveis pelo menu vertical da própria tela de Cadastros)
  {key:'pivos',label:'Pivôs',desc:'Cadastro de pivôs centrais',group:'Cadastros',icon:'pivot',page:'cad',after:()=>sbClickTab('cad','cad-pivos')},
  {key:'fazendas',label:'Fazendas',desc:'Cadastro de fazendas',group:'Cadastros',icon:'farm',page:'cad',after:()=>sbClickTab('cad','cad-fazendas')},
  {key:'culturas',label:'Culturas',desc:'Cadastro de culturas',group:'Cadastros',icon:'leaf',page:'cad',after:()=>sbClickTab('cad','cad-culturas')},
  {key:'produtos',label:'Produtos',desc:'Cadastro de produtos de fertirrigação',group:'Cadastros',icon:'box',page:'cad',after:()=>sbClickTab('cad','cad-produtos')},
  {key:'operadores',label:'Operadores',desc:'Cadastro de operadores',group:'Cadastros',icon:'user',page:'cad',after:()=>sbClickTab('cad','cad-operadores')},
  {key:'falhas',label:'Falhas',desc:'Categorias e motivos de falha',group:'Cadastros',icon:'alert',page:'cad',after:()=>sbClickTab('cad','cad-falhas')},
  {key:'outros',label:'Outros',desc:'Casas de bomba, bombas, motores, painéis, sensores, técnicos, categorias',group:'Cadastros',icon:'panel',page:'cad',dataPage:'cad'},

  // Relatórios (Fase 12.0, era "Gestão"/"Banco de Dados") — operacionais
  // (consulta linha-a-linha), gerenciais (gráficos), exportações e
  // histórico de exportação/importação, tudo centralizado aqui.
  {key:'relat',label:'Gerencial e Exportações',desc:'Gráficos gerenciais e exportação de módulos',group:'Relatórios',icon:'fileText',page:'relat',dataPage:'relat'},
  {key:'bancoDados',label:'Consulta Operacional',desc:'Consultar a base ETL linha a linha',group:'Relatórios',icon:'database',page:'dados',dataPage:'dados'},
  {key:'planejamento',label:'Importação',desc:'Importar planejamento de irrigação',group:'Relatórios',icon:'calendar',page:'dados',after:()=>sbClickTab('dados','dt-import')},

  // Administração — Usuários já funciona (local, preparado para Firebase);
  // Perfis/Permissões documentam a estrutura; Configurações já é real;
  // Backup/Sincronização (Fase 12.0, eram "Banco de Dados") são infra
  // administrativa, mesmo sendo estrutura preparada para o Firebase.
  {key:'usuarios',label:'Usuários',desc:'Usuários que já acessaram este navegador',group:'Administração',icon:'users',page:'admin',after:()=>sbAdminFoco('usuarios')},
  {key:'perfis',label:'Perfis',desc:'Administrador, Gestor, Operador, Consulta',group:'Administração',icon:'idcard',page:'admin',after:()=>sbAdminFoco('perfis')},
  {key:'permissoes',label:'Permissões',desc:'Estrutura preparada (Firestore Rules)',group:'Administração',icon:'lock',page:'admin',after:()=>sbAdminFoco('permissoes')},
  {key:'auditoriaAdmin',label:'Auditoria',desc:'Login, exportações e alterações de usuários/permissões',group:'Administração',icon:'shield',page:'admin',after:()=>sbAdminFoco('auditoriaAdmin')},
  {key:'backup',label:'Backup',desc:'Estrutura preparada (Firebase)',group:'Administração',icon:'archive',page:'admin',after:()=>sbAdminFoco('backup')},
  {key:'sincronizacao',label:'Sincronização',desc:'Estrutura preparada (Firebase)',group:'Administração',icon:'sync',page:'admin',after:()=>sbAdminFoco('sincronizacao')},
  {key:'configuracoes',label:'Configurações',desc:'Preferências e manutenção do sistema',group:'Administração',icon:'gear',page:'cfg',dataPage:'cfg'},
];
const SB_GROUP_ORDER=['Centro de Operações','Lançamentos','Indicadores','Relatórios','Cadastros','Administração'];

function sbFavoritos(){ try{ return JSON.parse(localStorage.getItem('coi_ui_favoritos')||'[]'); }catch{ return []; } }
function sbIsFavorito(key){ return sbFavoritos().includes(key); }
function sbToggleFavorito(key,ev){
  if(ev){ ev.stopPropagation(); ev.preventDefault(); }
  let favs=sbFavoritos();
  favs=favs.includes(key)?favs.filter(k=>k!==key):[...favs,key];
  localStorage.setItem('coi_ui_favoritos',JSON.stringify(favs));
  renderSidebarNav();
}

function sbItemHtml(m,compact){
  /* <div role="button"> em vez de <button> aninhado: a estrela de favorito
     também é interativa, e HTML não permite botão dentro de botão. */
  return `<div class="nav-item" role="button" tabindex="0" data-mod-key="${m.key}"
      onclick="sbNavigate('${m.key}',this)" onkeydown="if(event.key==='Enter')sbNavigate('${m.key}',this)" title="${m.desc}">
    <span class="nav-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85">${SB_ICON[m.icon]||SB_ICON.dashboard}</svg></span>
    <span style="flex:1;min-width:0;overflow:hidden">
      <span class="nav-item-text">${m.label}</span>
      ${compact?'':`<span class="nav-item-desc">${m.desc}</span>`}
    </span>
    <span class="nav-fav-btn${sbIsFavorito(m.key)?' is-fav':''}" role="button" tabindex="0" onclick="sbToggleFavorito('${m.key}',event)" title="Favoritar">
      <svg viewBox="0 0 24 24" fill="${sbIsFavorito(m.key)?'currentColor':'none'}" stroke="currentColor" stroke-width="1.8">${SB_ICON.star}</svg>
    </span>
  </div>`;
}

/* ── SIDEBAR POR MÓDULO (Fase 13.1, era acordeão de 6 grupos da Fase 10.0)
   O Portal COI não tem sidebar (ver body.coi-portal no CSS); ao entrar
   num módulo, a sidebar mostra só os itens daquele módulo — nada de
   acordeão/grupos escondidos, já que só um grupo por vez é relevante.
   O grupo exibido é sempre derivado da página/aba atual (resolveActiveKey),
   nunca guardado em paralelo, para nunca desincronizar do que a tela
   realmente mostra. */
let SB_ADMIN_FOCO=null;

function renderSidebarNav(){
  const nav=document.getElementById('sb-nav');
  if(!nav) return;
  const activeKey=resolveActiveKey();
  const activeMod=activeKey&&SB_MODULES.find(m=>m.key===activeKey);
  const group=(activeMod&&activeMod.group)||SB_GROUP_ORDER[0];
  const mods=SB_MODULES.filter(m=>m.group===group);

  let html=`<div class="nav-section-label">${group}</div>`;
  html+=mods.map(m=>sbItemHtml(m,false)).join('');

  const favs=sbFavoritos().map(k=>SB_MODULES.find(m=>m.key===k)).filter(Boolean).filter(m=>m.group!==group);
  if(favs.length){
    html+=`<div class="nav-sep"></div><div class="nav-section-label">★ Favoritos</div>`;
    html+=favs.map(m=>sbItemHtml(m,true)).join('');
  }
  nav.innerHTML=html;
  syncSidebarActiveFromDOM();
}

function sbNavigate(key,btn){
  const m=SB_MODULES.find(x=>x.key===key);
  if(!m) return;
  if(m.page==='admin') SB_ADMIN_FOCO=key;
  goPage(m.page,btn||undefined);
  if(m.after) m.after();
  syncSidebarActiveFromDOM();
}

/* Atalho usado pelos cartões "estrutura preparada" de Administração —
   mesma navegação de sbNavigate, só chamada fora da sidebar. */
function sbAdminFoco(key){ SB_ADMIN_FOCO=key; if(typeof renderAdmin==='function') renderAdmin(); }

/* Cartões de "estrutura preparada" — cada um documenta onde a peça do
   Firebase vai entrar, sem implementar nada (ver ROADMAP.md v4.0). */
function renderAdmin(){
  const bloqueado=document.getElementById('admin-bloqueado');
  const conteudo=document.getElementById('admin-conteudo');
  if(!canView('administracao')){
    if(bloqueado) bloqueado.style.display='';
    if(conteudo) conteudo.style.display='none';
    return;
  }
  if(bloqueado) bloqueado.style.display='none';
  if(conteudo) conteudo.style.display='';

  renderAdminUsuariosTabela();
  renderAdminAuditoria();
  renderAdminAuditoriaNegocio();

  const box=document.getElementById('admin-cards');
  if(!box) return;
  const items=SB_MODULES.filter(m=>m.group==='Administração'&&m.key!=='usuarios'&&m.key!=='auditoriaAdmin');
  /* Integrações não é mais item de sidebar (Fase 10.1 simplificou o
     submenu de Administração para 4 itens) — mas o cartão continua
     documentado aqui, já que a funcionalidade nunca existiu de fato
     (não há "remoção" de algo que funcionava). */
  items.push({key:'integracoes',label:'Integrações',desc:'Estrutura preparada (Firebase)',icon:'link'});
  box.innerHTML=items.map(m=>{
    const implementado=m.key==='configuracoes';
    const clicavel=!!m.after||!!m.dataPage;
    return `<div class="home-card${m.key===SB_ADMIN_FOCO?' foco':''}">
      <div class="home-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${SB_ICON[m.icon]||''}</svg></div>
      <div class="home-card-body">
        <div class="home-card-title">${m.label}</div>
        <div class="home-card-desc">${m.desc}</div>
        <div class="home-card-meta">
          <span class="home-card-status ${implementado?'ok':'neutral'}">${implementado?'Disponível':'Estrutura preparada'}</span>
        </div>
      </div>
      ${clicavel?`<button class="btn ${implementado?'btn-primary':'btn-secondary'} btn-xs home-card-btn" onclick="sbNavigate('${m.key}')">${implementado?'Acessar':'Ver detalhes'}</button>`
        :`<button class="btn btn-secondary btn-xs home-card-btn" disabled>Sem ação ainda</button>`}
    </div>`;
  }).join('');
}

/* ── ADMINISTRAÇÃO / AUDITORIA (Fase 10.2) ─────────────────────────────
   Lê só services/auditoria.js (log de governança: login, exportação,
   alteração de usuários/permissões/cadastros/lançamentos) — não mexe
   em js/audit.js (coi_audit), que continua registrando por conta
   própria dentro de cada services/*.js como sempre registrou. */
const ADMIN_AUD_FILTROS={usuario:'',modulo:'',dataInicio:'',dataFim:'',texto:''};

function renderAdminAuditoria(){
  const tbl=document.getElementById('admin-auditoria-tbl');
  if(!tbl) return;

  const selUsuario=document.getElementById('admin-aud-usuario');
  if(selUsuario&&!selUsuario.options.length){
    const usuarios=[...new Set(auditoriaTodos().map(r=>r.usuario))].sort();
    selUsuario.innerHTML='<option value="">Todos os usuários</option>'+usuarios.map(u=>`<option>${u}</option>`).join('');
  }
  const selModulo=document.getElementById('admin-aud-modulo');
  if(selModulo&&!selModulo.options.length){
    const modulos=[...new Set(auditoriaTodos().map(r=>r.modulo))].sort();
    selModulo.innerHTML='<option value="">Todos os módulos</option>'+modulos.map(m=>`<option>${m}</option>`).join('');
  }

  const eventos=auditoriaConsultar(ADMIN_AUD_FILTROS);
  const cnt=document.getElementById('admin-auditoria-cnt');
  if(cnt) cnt.textContent=eventos.length.toLocaleString('pt-BR')+' evento(s)';
  const badgePorAcao={'LOGIN':'b-info','INCLUSÃO':'b-success','ALTERAÇÃO':'b-warning','EXCLUSÃO':'b-danger','EXPORTAÇÃO':'b-neutral'};
  tbl.innerHTML=eventos.length?`<table class="table"><thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Módulo</th><th>Registro</th><th>Descrição</th></tr></thead><tbody>${eventos.slice(0,300).map(r=>`
    <tr>
      <td style="font-size:11px;white-space:nowrap">${new Date(r.dataHora).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</td>
      <td>${r.usuario}</td>
      <td><span class="badge ${badgePorAcao[r.acao]||'b-neutral'}">${r.acao}</span></td>
      <td>${r.modulo}</td>
      <td style="font-size:11px">${r.registro||'—'}</td>
      <td style="font-size:11px;color:var(--text-secondary)">${r.descricao||'—'}</td>
    </tr>`).join('')}</tbody></table>`:emEl('Nenhum evento de auditoria encontrado com esses filtros.');
}
/* Ponto 8 — Auditoria de eventos de NEGÓCIO (Horímetro/Paradas/
   Planejamento/Calibração/Cadastros) dentro do módulo independente de
   Administração — mesma trilha única (js/audit.js, `coi_audit`) que já
   alimenta a aba "Auditoria" de Lançamentos, sem segunda fonte. */
function renderAdminAuditoriaNegocio(){
  const tbl=document.getElementById('admin-audit-negocio-tbl'); if(!tbl) return;
  const cnt=document.getElementById('admin-audit-negocio-cnt');
  const list=auditAll();
  if(cnt) cnt.textContent=list.length.toLocaleString('pt-BR')+' evento(s)';
  tbl.innerHTML=auditTabelaHtml(list);
}

function adminAuditoriaFiltrar(){
  ADMIN_AUD_FILTROS.usuario=document.getElementById('admin-aud-usuario')?.value||'';
  ADMIN_AUD_FILTROS.modulo=document.getElementById('admin-aud-modulo')?.value||'';
  ADMIN_AUD_FILTROS.dataInicio=document.getElementById('admin-aud-inicio')?.value||'';
  ADMIN_AUD_FILTROS.dataFim=document.getElementById('admin-aud-fim')?.value||'';
  ADMIN_AUD_FILTROS.texto=document.getElementById('admin-aud-busca')?.value||'';
  renderAdminAuditoria();
}
function adminAuditoriaLimpar(){
  ['admin-aud-usuario','admin-aud-modulo','admin-aud-inicio','admin-aud-fim','admin-aud-busca'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  Object.keys(ADMIN_AUD_FILTROS).forEach(k=>ADMIN_AUD_FILTROS[k]='');
  renderAdminAuditoria();
}

/* ── ADMINISTRAÇÃO / USUÁRIOS (Fase 10.1) ─────────────────────────────
   Única tela que lê services/usuarios.js — nenhuma outra tela acessa
   coi_usuarios diretamente, mesmo padrão de todo serviço do projeto. */
function renderAdminUsuariosTabela(){
  const tbl=document.getElementById('admin-usuarios-tbl');
  if(!tbl) return;
  const lista=usuariosTodos().slice().sort((a,b)=>(b.ultimoAcesso||'').localeCompare(a.ultimoAcesso||''));
  const cnt=document.getElementById('admin-usuarios-cnt');
  if(cnt) cnt.textContent=lista.length.toLocaleString('pt-BR')+' usuário(s)';
  if(!lista.length){ tbl.innerHTML=emEl('Nenhum usuário entrou neste navegador ainda.'); return; }
  const podeGerenciar=canEdit('usuarios');
  tbl.innerHTML=`<table class="table"><thead><tr><th>Usuário</th><th>Perfil</th><th>Fazenda</th><th>Status</th><th>Último acesso</th><th style="text-align:right">Ações</th></tr></thead><tbody>${lista.map(u=>{
    const faz=u.fazendaId?cadLookupLabel('fazendas',u.fazendaId):'—';
    const ultimo=u.ultimoAcesso?new Date(u.ultimoAcesso).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—';
    return `<tr>
      <td><div style="font-weight:600">${u.nome}</div><div style="font-size:10.5px;color:var(--text-tertiary)">${u.login} · ${u.cargo||'—'}</div></td>
      <td><span class="badge b-brand">${u.perfil}</span></td>
      <td>${faz}</td>
      <td><span class="badge ${u.status==='Ativo'?'b-success':'b-neutral'}">${u.status}</span></td>
      <td style="font-size:11px">${ultimo}</td>
      <td style="text-align:right;white-space:nowrap">${!podeGerenciar?'<span style="font-size:10px;color:var(--text-tertiary)">Somente leitura</span>':`
        <button class="btn btn-ghost btn-xs" onclick="adminEditarUsuario('${u.id}')">Editar</button>
        <button class="btn btn-ghost btn-xs" onclick="adminEditarPerfilUsuario('${u.id}')">Perfil</button>
        <button class="btn btn-ghost btn-xs" onclick="adminAlternarStatusUsuario('${u.id}')">${u.status==='Ativo'?'Inativar':'Ativar'}</button>`}
      </td>
    </tr>`;
  }).join('')}</tbody></table>`;
}
/* As 3 ações de gestão de usuário exigem canEdit('usuarios') — hoje só
   o perfil Administrador tem essa permissão ('*'). Mesma mensagem
   padrão de bloqueio (bloquearSemPermissao) usada em Lançamentos e
   Cadastros. Cada ação bem-sucedida também vira um evento em
   services/auditoria.js ("alteração de usuários/permissões"). */
function adminEditarUsuario(id){
  if(bloquearSemPermissao('usuarios','edit')) return;
  const u=usuariosTodos().find(x=>x.id===id);
  if(!u) return;
  const nome=prompt('Nome:',u.nome);
  if(nome===null) return;
  const cargo=prompt('Cargo:',u.cargo||'');
  if(cargo===null) return;
  usuarioAtualizar(id,{nome:nome.trim()||u.nome,cargo:cargo.trim()});
  auditoriaRegistrar('ALTERAÇÃO','Usuários',u.login,`Dados atualizados (nome/cargo).`);
  toast('Usuário atualizado.','ok');
  renderAdminUsuariosTabela();
}
function adminEditarPerfilUsuario(id){
  if(bloquearSemPermissao('usuarios','edit')) return;
  const u=usuariosTodos().find(x=>x.id===id);
  if(!u) return;
  const novo=prompt(`Perfil de ${u.nome} (${PERFIS_DISPONIVEIS.join(' / ')}):`,u.perfil);
  if(novo===null) return;
  if(!PERFIS_DISPONIVEIS.includes(novo)){ toast('Perfil inválido. Use: '+PERFIS_DISPONIVEIS.join(', '),'err'); return; }
  usuarioAtualizar(id,{perfil:novo});
  auditoriaRegistrar('ALTERAÇÃO','Permissões',u.login,`Perfil alterado para ${novo}.`);
  toast('Perfil atualizado.','ok');
  renderAdminUsuariosTabela();
}
function adminAlternarStatusUsuario(id){
  if(bloquearSemPermissao('usuarios','edit')) return;
  const u=usuariosTodos().find(x=>x.id===id);
  if(!u) return;
  usuarioAlternarStatus(id);
  const novoStatus=u.status==='Ativo'?'Inativo':'Ativo';
  auditoriaRegistrar('ALTERAÇÃO','Usuários',u.login,`Status alterado para ${novoStatus}.`);
  renderAdminUsuariosTabela();
}

/* Deriva qual item da sidebar corresponde à página/aba atual — não altera
   nenhuma dessas telas, só observa o resultado (qual aba ficou visível). */
function resolveActiveKey(){
  let key=null;
  if(curPage==='lanc'){
    const map={lanc:'horimetros',falha:'indicadoresOp',parada:'paradas',ferti:'fertirrigacao',calibracao:'calibracao',auditoria:'auditoria'};
    const activeTab=['lanc','falha','parada','ferti','calibracao','historico','auditoria'].find(k=>{
      const b=document.getElementById('lhm-tab-'+k); return b&&b.classList.contains('active');
    });
    key=map[activeTab]||null;
  } else if(curPage==='cad'){
    const activeBtn=document.querySelector('#page-cad .tab-btn.active');
    const m=activeBtn&&activeBtn.getAttribute('onclick').match(/swTab\('cad-([a-zA-Z]+)'/);
    const entity=m?m[1]:null;
    const found=SB_MODULES.find(x=>x.group==='Cadastros'&&x.after&&x.after.toString().includes(`cad-${entity}`));
    key=found?found.key:'outros'; /* entidade sem atalho próprio (Fase 10.1: Setores/CasasBomba/Bombas/
      Motores/Painéis/Sensores/Técnicos/UnidadesMedida) — cai no item "Outros" */
  } else if(curPage==='dados'){
    const activeBtn=document.querySelector('#page-dados .tab-btn.active');
    key=(activeBtn&&/dt-import/.test(activeBtn.getAttribute('onclick')))?'planejamento':'bancoDados';
  } else if(curPage==='admin'){
    key=SB_ADMIN_FOCO||'usuarios';
  } else {
    const found=SB_MODULES.find(x=>x.dataPage===curPage);
    key=found?found.key:null;
  }
  return key;
}
function syncSidebarActiveFromDOM(){
  const key=resolveActiveKey();
  document.querySelectorAll('.nav-item[data-mod-key]').forEach(el=>el.classList.remove('active'));
  if(key) document.querySelectorAll(`.nav-item[data-mod-key="${key}"]`).forEach(el=>el.classList.add('active'));
}
document.addEventListener('click',e=>{ if(e.target.closest('.tab-btn,.breadcrumb-item,.gs-item')) setTimeout(syncSidebarActiveFromDOM,0); });

/* ── BUSCA DENTRO DO MENU ─────────────────────────────────────────── */
/* ── FAZENDA ATIVA (preferência de exibição — não filtra dados ainda) ── */
function fillFazendaAtivaSelect(){
  const sel=document.getElementById('tb-farm-select');
  if(!sel) return;
  const fazendas=(typeof cadAll==='function'?cadAll('fazendas'):[])||[];
  const atual=localStorage.getItem('coi_fazenda_ativa')||'';
  sel.innerHTML='<option value="">Todas as Fazendas</option>'+fazendas.map(f=>`<option value="${f.id}">${f.nome}</option>`).join('');
  sel.value=atual;
}
function setFazendaAtiva(fazendaId){
  localStorage.setItem('coi_fazenda_ativa',fazendaId||'');
  if(typeof renderExecHero==='function') renderExecHero();
}

/* ── DENSIDADE DA INTERFACE (Compacto/Padrão/Confortável) ─────────────
   Só troca um atributo em <html> — as regras de espaçamento vivem em
   css/design-system/applied.css ([data-density]), nada aqui calcula
   layout nem mexe em nenhuma regra de negócio. */
const SB_DENSIDADES=['padrao','compacto','confortavel'];
const SB_DENSIDADE_LABEL={padrao:'Padrão',compacto:'Compacto',confortavel:'Confortável'};
function applyDensidade(mode){
  if(!SB_DENSIDADES.includes(mode)) mode='padrao';
  if(mode==='padrao') document.documentElement.removeAttribute('data-density');
  else document.documentElement.setAttribute('data-density',mode);
  localStorage.setItem('coi_densidade',mode);
  const btn=document.getElementById('density-btn'), dot=document.getElementById('density-dot');
  if(btn) btn.title='Densidade: '+SB_DENSIDADE_LABEL[mode];
  if(dot) dot.style.display=mode==='padrao'?'none':'block';
  const cfgBtn=document.getElementById('cfg-densidade-btn');
  if(cfgBtn) cfgBtn.textContent=SB_DENSIDADE_LABEL[mode];
}
function cycleDensidade(){
  const cur=localStorage.getItem('coi_densidade')||'padrao';
  const next=SB_DENSIDADES[(SB_DENSIDADES.indexOf(cur)+1)%SB_DENSIDADES.length];
  applyDensidade(next);
}

/* ── PERFIL LOCAL (nome/cargo exibidos no topbar — sem autenticação) ── */
function refreshUserTopbar(){
  const nome=localStorage.getItem('coi_user')||'Operador Local';
  const cargo=localStorage.getItem('coi_user_cargo')||'Operador de Campo';
  const nomeEl=document.getElementById('tb-user-name'); if(nomeEl) nomeEl.textContent=nome;
  const cargoEl=document.getElementById('tb-user-role'); if(cargoEl) cargoEl.textContent=cargo;
  const avEl=document.getElementById('tb-avatar');
  if(avEl) avEl.textContent=nome.trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase()||'OL';
}
function editUserField(field){
  const key=field==='nome'?'coi_user':'coi_user_cargo';
  const atual=localStorage.getItem(key)||(field==='nome'?'Operador Local':'Operador de Campo');
  const novo=prompt(field==='nome'?'Nome de exibição:':'Cargo / função:',atual);
  if(novo!==null&&novo.trim()){ localStorage.setItem(key,novo.trim()); refreshUserTopbar(); if(typeof renderExecHero==='function') renderExecHero(); }
  toggleUserMenu();
}
function toggleUserMenu(ev){
  if(ev) ev.stopPropagation();
  document.getElementById('tb-user-menu').classList.toggle('show');
}
document.addEventListener('click',e=>{ if(!e.target.closest('#tb-user-wrap')) document.getElementById('tb-user-menu')?.classList.remove('show'); });

/* ── AJUDA (painel simples, sem dependência externa) ─────────────────── */
function toggleHelpPanel(){
  let p=document.getElementById('help-panel');
  if(p){ p.remove(); return; }
  p=document.createElement('div');
  p.id='help-panel';
  p.className='notif-panel show';
  p.style.cssText='position:fixed;top:52px;right:16px;width:280px;z-index:9999';
  p.innerHTML=`<div class="notif-panel-header"><span>Ajuda rápida</span><button class="notif-clear" onclick="document.getElementById('help-panel').remove()">Fechar</button></div>
    <div style="padding:.8rem .9rem;font-size:11.5px;color:var(--text-secondary);line-height:1.6">
      <b>Sidebar:</b> use a busca para filtrar módulos e a estrela para favoritar os mais usados.<br>
      <b>Densidade:</b> o ícone de linhas no topo alterna entre Compacto/Padrão/Confortável.<br>
      <b>Tema:</b> o ícone de sol/lua alterna entre claro e escuro.<br>
      COI v3.0 · Santa Colomba Agropecuária
    </div>`;
  document.body.appendChild(p);
}

/* ── MICROINTERAÇÕES COMPARTILHADAS (editar/excluir) ───────────────────
   Puramente visuais — quem decide se a exclusão é permitida continua
   sendo o próprio serviço (xxxExcluir), chamado de dentro do callback. */
function opPulseCard(panelSelector,cls){
  const card=document.querySelector(panelSelector+' .card');
  if(!card) return;
  card.classList.remove(cls); void card.offsetWidth; card.classList.add(cls);
}
function opFadeRowThen(btn,callback){
  const tr=btn&&btn.closest&&btn.closest('tr');
  if(!tr){ callback(); return; }
  tr.classList.add('op-row-exit');
  setTimeout(callback,180);
}

/* ── MODAL DE HISTÓRICO DE VERSÕES (compartilhado) ─────────────────────
   Usado por lhm/lhf/lp/lft/lc.verVersoes — recebe os itens já formatados
   pelo controller de cada tela (mesma consulta de sempre, xxxHistoricoVersoes,
   só muda a apresentação: modal em vez de alert()). ───────────────────── */
function showVersoesModal(titulo,itens){
  const title=document.getElementById('versoes-modal-title');
  const body=document.getElementById('versoes-modal-body');
  if(!title||!body) return;
  title.textContent=titulo;
  body.innerHTML=itens.length?`<div class="ver-timeline">${itens.map(it=>{
    const excluido=it.status==='excluido';
    const tagPrincipal=excluido?'<span class="badge b-danger">Excluída</span>'
      :it.atual?'<span class="badge b-success">Versão vigente</span>'
      :'<span class="badge b-info">Editada depois</span>';
    return `
    <div class="ver-row${it.atual?' atual':''}${excluido?' excluida':''}">
      <div class="ver-badge">${it.versao===1?'Criação':'v'+it.versao}</div>
      <div class="ver-main">
        <div class="ver-linha">${it.linha}</div>
        <div class="ver-tags">${tagPrincipal}</div>
      </div>
    </div>`;
  }).join('')}</div>`:'<div class="empty-state-sub">Sem histórico de versões.</div>';
  document.getElementById('versoes-modal-overlay').classList.add('open');
}

/* Mesmo modal genérico acima, para conteúdo HTML livre (ex.: memória de
   cálculo do Consumo de Energia) — evita criar um segundo componente de
   modal só para isso. */
function showInfoModal(titulo,html){
  const title=document.getElementById('versoes-modal-title');
  const body=document.getElementById('versoes-modal-body');
  if(!title||!body) return;
  title.textContent=titulo;
  body.innerHTML=html;
  document.getElementById('versoes-modal-overlay').classList.add('open');
}
function closeVersoesModal(){
  const el=document.getElementById('versoes-modal-overlay');
  if(el) el.classList.remove('open');
}

/* ── TOAST ────────────────────────────────────────────────────────── */
function toast(msg,type='info',ms=3500){
  const cls={ok:'toast-ok',err:'toast-err',warn:'toast-warn',info:'toast-info'}[type]||'toast-info';
  const el=document.createElement('div');
  el.className=`toast ${cls}`;
  el.innerHTML=`<span>${msg}</span><button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
  const cont=document.getElementById('toast-container');
  if(!cont) return;
  cont.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('show'));
  setTimeout(()=>{ el.classList.remove('show'); setTimeout(()=>el.remove(),250); },ms);
}
