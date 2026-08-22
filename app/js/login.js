/* ── LOGIN — SUPABASE AUTH REAL (Fase 17) ──────────────────────────────
   Substitui o portão local (nome digitado + localStorage, Fase 10.0/10.1)
   por autenticação de verdade via Supabase Auth (e-mail + senha), usando
   a MESMA conexão já configurada em js/config/supabase.js (window.coiDB)
   — nenhum projeto/instância paralela.

   Fluxo real:
     coiDB.auth.signInWithPassword({email,senha})
       → sessão real do Supabase (JWT), persistida pelo próprio SDK
         (localStorage interno do supabase-js, chave própria dele —
         não é o coi_logged_in/coi_user antigo, que só guardava um nome
         sem validar nada)
       → onAuthStateChange mantém `_authUserId` (id do usuário logado,
         igual a auth.users.id) atualizado em memória, síncrono, pra
         services/usuarios.js e services/permissoes.js continuarem
         lendo sem precisar virar tudo async
       → coi.usuarios.id é o MESMO uuid de auth.users.id (FK já existe
         no banco, ver migration 009) — resolve/cria o registro de
         perfil/permissões a partir daí.

   IMPORTANTE (documentado, não contornado): novo cadastro exige
   confirmação de e-mail (mailer_autoconfirm=false no projeto) — sem
   clicar no link enviado pelo Supabase, o login desse e-mail falha com
   "Email not confirmed". Isso é comportamento correto de segurança,
   não um bug — só quem controla a caixa de entrada consegue confirmar. */

let _authUserId = null;
let _authReady = false;

function checkLoginState(){
  const lembrado=localStorage.getItem('coi_lembrar_email');
  if(lembrado){
    document.getElementById('login-usuario').value=lembrado;
    document.getElementById('login-lembrar').checked=true;
  }

  /* onAuthStateChange dispara IMEDIATAMENTE com o estado atual ao
     registrar o listener (INITIAL_SESSION), então isso substitui tanto
     a checagem de sessão restaurada quanto a atualização contínua
     (token refresh, logout em outra aba, expiração). */
  window.coiDB.auth.onAuthStateChange(async (event, session)=>{
    _authUserId = session?.user?.id || null;
    _authReady = true;

    if(event==='SIGNED_OUT' || !session){
      if(document.getElementById('app').style.display!=='none'){
        // sessão caiu com o app já aberto (expirou/foi revogada) — volta pro login
        location.reload();
      }
      return;
    }

    if(document.getElementById('page-login').style.display==='none') return; // já processado
    showApp();
    await bootApp();
    /* Fase 17 — resolve/cria o registro em coi.usuarios (mesmo id do
       auth.users) DEPOIS do bootApp (que já sincronizou _perfisCache),
       e re-sincroniza o cache de usuários/permissões pra refletir o
       perfil recém-atribuído sem precisar recarregar a página. */
    const uReg=typeof usuarioSincronizarSessao==='function'?await usuarioSincronizarSessao(session.user):null;
    if(uReg&&uReg.status==='Bloqueado'){
      loginMostrarErro('Usuário bloqueado. Procure o administrador do sistema.');
      await window.coiDB.auth.signOut();
      return;
    }
    if(typeof renderSidebarNav==='function') renderSidebarNav();
    if(typeof refreshUserTopbar==='function') refreshUserTopbar();
    if(typeof auditoriaRegistrar==='function') auditoriaRegistrar('LOGIN','Acesso',session.user.email,'Sessão Supabase Auth restaurada/iniciada.');
  });
}

function showApp(){
  document.getElementById('page-login').style.display='none';
  document.getElementById('app').style.display='';
}

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

/* Traduz os erros mais comuns do Supabase Auth — nunca inventa "deu
   certo" quando não deu; o usuário precisa entender o que fazer. */
function _traduzErroAuth(err){
  const msg=(err&&err.message)||'';
  if(/Invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if(/Email not confirmed/i.test(msg)) return 'E-mail ainda não confirmado. Verifique sua caixa de entrada e clique no link de confirmação enviado pelo Supabase.';
  if(/rate limit/i.test(msg)) return 'Muitas tentativas. Aguarde alguns instantes e tente novamente.';
  return msg||'Não foi possível entrar. Tente novamente.';
}

async function doLogin(ev){
  if(ev) ev.preventDefault();
  const email=v('login-usuario').trim();
  const senha=v('login-senha');
  if(!email){ loginMostrarErro('Informe seu e-mail para continuar.'); return false; }
  if(!senha){ loginMostrarErro('Informe sua senha.'); return false; }
  loginMostrarErro('');

  const lembrar=document.getElementById('login-lembrar').checked;
  if(lembrar) localStorage.setItem('coi_lembrar_email',email);
  else localStorage.removeItem('coi_lembrar_email');

  const btn=document.getElementById('login-submit-btn'), lbl=document.getElementById('login-submit-lbl');
  btn.disabled=true; lbl.textContent='Entrando...';
  document.getElementById('login-loading').classList.add('show');

  try{
    const {data,error}=await window.coiDB.auth.signInWithPassword({email,password:senha});
    if(error){ loginMostrarErro(_traduzErroAuth(error)); return false; }
    // onAuthStateChange (registrado em checkLoginState) cuida do resto:
    // showApp() + bootApp() disparam a partir do evento SIGNED_IN.
  }catch(e){
    loginMostrarErro('Falha de conexão com o servidor de autenticação.');
  }finally{
    btn.disabled=false; lbl.textContent='Entrar';
    document.getElementById('login-loading').classList.remove('show');
  }
  return false;
}

async function doLogout(){
  const email=(await window.coiDB.auth.getSession()).data?.session?.user?.email||'';
  if(typeof auditoriaRegistrar==='function') auditoriaRegistrar('LOGOUT','Acesso',email,'Logout realizado no portal.');
  await window.coiDB.auth.signOut();
  location.reload();
}

/* "Esqueci minha senha" — envio real do e-mail de recuperação pelo
   Supabase Auth (nenhum backend próprio). Precisa de um e-mail válido
   já cadastrado; se não houver, o Supabase ainda responde 200 (não
   revela se o e-mail existe, por segurança) — a mensagem ao usuário é
   sempre a mesma, de propósito. */
async function solicitarRecuperacaoSenha(){
  const email=v('login-usuario').trim();
  if(!email){ loginMostrarErro('Informe seu e-mail no campo acima e clique em "Esqueci minha senha" de novo.'); return; }
  try{
    await window.coiDB.auth.resetPasswordForEmail(email);
    toast('Se este e-mail estiver cadastrado, um link de redefinição foi enviado.','info');
  }catch(e){
    toast('Não foi possível solicitar a redefinição agora. Tente novamente mais tarde.','err');
  }
}

document.addEventListener('DOMContentLoaded',checkLoginState);
