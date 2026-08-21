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
  /* Fase 14/15 — Horímetro e Paradas passaram a ser gravados/lidos do
     Supabase (banco oficial); os caches em memória precisam ser
     sincronizados 1x aqui antes de qualquer tela renderizar, senão
     Dashboard/Consulta/Painel Operacional abririam vazios mesmo com
     histórico real no banco. */
  if(typeof horimetroSyncCache==='function') await horimetroSyncCache();
  if(typeof paradaSyncCache==='function') await paradaSyncCache();
  if(typeof calibracaoSyncCache==='function') await calibracaoSyncCache();
  if(typeof planejamentoSyncCache==='function') await planejamentoSyncCache();
  if(typeof energiaSyncCache==='function') await energiaSyncCache();
  /* Fase 16 — Usuários/Perfis/Permissões: permissoes ANTES de usuarios
     (usuarioRegistrarAcesso, chamado por login.js logo depois, precisa
     de _perfisCache já carregado pra resolver o perfil "Administrador"/
     "Operador/Lançador" do primeiro acesso). */
  if(typeof permissoesSyncCache==='function') await permissoesSyncCache();
  if(typeof usuariosSyncCache==='function') await usuariosSyncCache();
  iniciarSincronizacaoPeriodica();
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

/* Ponto 4 — "sincronização/atualização a cada 30 minutos": atualização
   real dos dados vindos do Supabase (não um botão decorativo). Enquanto
   o app estiver aberto, a cada 30min os caches de Horímetro/Paradas são
   relidos do banco e a página atual é redesenhada com o que houver de
   novo (inclusive lançado por outro usuário/dispositivo, já que agora o
   banco é central). `_syncIntervalId` evita empilhar vários intervalos
   se bootApp() rodar mais de uma vez na mesma aba (logout→login). */
let _syncIntervalId=null;
function iniciarSincronizacaoPeriodica(){
  if(_syncIntervalId) clearInterval(_syncIntervalId);
  _syncIntervalId=setInterval(async()=>{
    const okH=typeof horimetroSyncCache==='function'?await horimetroSyncCache():true;
    const okP=typeof paradaSyncCache==='function'?await paradaSyncCache():true;
    const okC=typeof calibracaoSyncCache==='function'?await calibracaoSyncCache():true;
    const okPl=typeof planejamentoSyncCache==='function'?await planejamentoSyncCache():true;
    if(typeof energiaSyncCache==='function') await energiaSyncCache();
    if(typeof permissoesSyncCache==='function') await permissoesSyncCache();
    if(typeof usuariosSyncCache==='function') await usuariosSyncCache();
    /* Não força goPage() em 'lanc'/'cad': são telas de formulário com
       abas e digitação em andamento — trocar de aba/perder o formulário
       a cada 30min seria pior que os dados ficarem 30min "velhos" até a
       próxima navegação/salvamento. Nas telas só de leitura, redesenha
       com o que acabou de ser sincronizado. */
    if(typeof goPage==='function'&&typeof curPage!=='undefined'&&curPage!=='lanc'&&curPage!=='cad'){
      goPage(curPage);
    }
    if(typeof pushNotif==='function'&&(!okH||!okP||!okC||!okPl)) pushNotif('Sincronização periódica falhou — exibindo os últimos dados carregados.','warn');
  },30*60*1000);
}

document.addEventListener('DOMContentLoaded',initApp);
