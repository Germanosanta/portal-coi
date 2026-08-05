/* ── BOOTSTRAP DA APLICAÇÃO ────────────────────────────────────────
   Restaura preferências de UI (tema/sidebar), inicia relógio e
   responsividade, carrega os dados e renderiza o dashboard inicial.
   ──────────────────────────────────────────────────────────────── */

function restoreUIPrefs(){
  const theme=localStorage.getItem('coi_theme')||'light';
  document.documentElement.setAttribute('data-theme',theme);
  updateThemeIcon(theme);
  const collapsed=localStorage.getItem('coi_sb_collapsed')==='1';
  if(collapsed&&window.innerWidth>768){
    document.getElementById('sb-wrap').classList.add('collapsed');
    document.getElementById('main').classList.add('sb-collapsed');
  }
  applyDensidade(localStorage.getItem('coi_densidade')||'padrao');
  refreshUserTopbar();
}

/* initApp roda sempre (mesmo antes do login) — só o que a própria tela
   de login já precisa (relógio, responsividade, tema). bootApp só roda
   depois que doLogin()/checkLoginState() libera o app (js/login.js). */
function initApp(){
  restoreUIPrefs();
  updateClock();
  setInterval(updateClock,30000);
  checkResponsive();
  window.addEventListener('resize',checkResponsive);
}

let DATA_LOADED_AT=null;
async function bootApp(){
  await loadAllData();
  DATA_LOADED_AT=new Date();
  cadSeedIfEmpty();
  buildSelects();
  atuSB();
  renderSidebarNav();
  fillFazendaAtivaSelect();
  renderNotifs();
  renderAudit();
  lhf.limpar();
  lp.limpar();
  lft.limpar();
  lc.limpar();
  imp.init();
  pushNotif(
    DATA_SOURCE==='remoto' ? 'Base de dados carregada com sucesso.' : 'Não foi possível carregar a base — exibindo dados simulados.',
    DATA_SOURCE==='remoto' ? 'ok' : 'warn'
  );

  goPage('home');
}

document.addEventListener('DOMContentLoaded',initApp);
