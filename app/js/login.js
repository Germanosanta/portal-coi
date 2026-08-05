/* ── LOGIN CORPORATIVO (Fases 10.0 / 10.1) ─────────────────────────────
   Portão de entrada local: exige um nome de usuário antes de mostrar o
   app e lembra a preferência em localStorage — não é autenticação real
   (não há backend de credenciais, a senha não é validada contra nada).
   Reaproveita as mesmas chaves de "perfil local" já usadas pelo topbar
   desde a Fase 9.2 (coi_user/coi_user_cargo) e, a partir da Fase 10.1,
   registra cada entrada em services/usuarios.js (usuarioRegistrarAcesso)
   — histórico real de quem já usou este navegador, nada fictício.
   Trocar por Firebase Authentication (v4.0, ver ROADMAP.md) deve alterar
   só doLogin/doLogout/checkLoginState, sem tocar em mais nada do app. */

function checkLoginState(){
  const lembrado=localStorage.getItem('coi_lembrar_usuario');
  if(lembrado){
    document.getElementById('login-usuario').value=lembrado;
    document.getElementById('login-lembrar').checked=true;
  }
  if(localStorage.getItem('coi_logged_in')==='1'){
    showApp();
    bootApp();
  }
}

function showApp(){
  document.getElementById('page-login').style.display='none';
  document.getElementById('app').style.display='';
}

/* Mostrar/ocultar senha — só alterna o type do input, nada é validado. */
function toggleSenhaVisivel(){
  const inp=document.getElementById('login-senha');
  const btn=document.getElementById('login-senha-toggle');
  const oculta=inp.type==='password';
  inp.type=oculta?'text':'password';
  btn.setAttribute('aria-label',oculta?'Ocultar senha':'Mostrar senha');
  btn.innerHTML=oculta
    ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a18.7 18.7 0 0 1 4.22-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 10 8 10 8a18.7 18.7 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="2" y1="2" x2="22" y2="22"/></svg>'
    :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z"/><circle cx="12" cy="12" r="3"/></svg>';
}

function loginMostrarErro(msg){
  const el=document.getElementById('login-err');
  if(!msg){ el.style.display='none'; el.innerHTML=''; return; }
  el.style.display='flex';
  el.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>${msg}</span>`;
}

function doLogin(ev){
  if(ev) ev.preventDefault();
  const usuario=v('login-usuario').trim();
  if(!usuario){ loginMostrarErro('Informe seu usuário para continuar.'); return false; }
  loginMostrarErro('');

  const lembrar=document.getElementById('login-lembrar').checked;
  localStorage.setItem('coi_logged_in','1');
  localStorage.setItem('coi_user',usuario);
  if(lembrar) localStorage.setItem('coi_lembrar_usuario',usuario);
  else localStorage.removeItem('coi_lembrar_usuario');

  const btn=document.getElementById('login-submit-btn'), lbl=document.getElementById('login-submit-lbl');
  btn.disabled=true; lbl.textContent='Entrando...';
  document.getElementById('login-loading').classList.add('show');

  bootApp().then(()=>{
    if(typeof usuarioRegistrarAcesso==='function') usuarioRegistrarAcesso(usuario,usuario);
    if(typeof auditoriaRegistrar==='function') auditoriaRegistrar('LOGIN','Acesso',usuario,'Login realizado no portal.');
    showApp();
  }).finally(()=>{
    btn.disabled=false; lbl.textContent='Entrar';
    document.getElementById('login-loading').classList.remove('show');
  });
  return false;
}

/* Sprint 01 — limpa só a sessão atual (coi_logged_in/coi_user); as
   preferências permanentes do usuário (tema, densidade, sidebar
   recolhida, "lembrar usuário") continuam intactas — não são tocadas
   aqui de propósito. */
function doLogout(){
  const usuario=localStorage.getItem('coi_user');
  if(typeof auditoriaRegistrar==='function') auditoriaRegistrar('LOGOUT','Acesso',usuario||'','Logout realizado no portal.');
  localStorage.removeItem('coi_logged_in');
  localStorage.removeItem('coi_user');
  location.reload();
}

document.addEventListener('DOMContentLoaded',checkLoginState);
