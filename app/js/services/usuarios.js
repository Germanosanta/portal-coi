/* ── SERVICES / USUÁRIOS (Fase 10.1) ───────────────────────────────────
   Novo serviço — não altera nenhum existente. Única camada que lê/grava
   `coi_usuarios`. Estrutura pensada para ser trocada por coleção do
   Firestore + Firebase Authentication na v4.0 sem mudar quem chama
   estas funções (mesmo padrão de todo serviço do projeto).

   Não há autenticação real ainda (js/login.js só pede um nome). Por
   isso não existe "senha" aqui — cada login bem-sucedido grava/atualiza
   um registro real (nome, login, cargo, fazenda, perfil, status,
   último acesso). Nenhum usuário fictício é pré-cadastrado; a lista
   reflete só quem de fato já entrou neste navegador. ─────────────── */

const USUARIOS_KEY='coi_usuarios';

const usuariosTodos = () => lsGet(USUARIOS_KEY,[]);
const usuariosSalvarTudo = arr => lsSet(USUARIOS_KEY,arr);

/* Perfis disponíveis (ver services/permissoes.js) — Administrador é o
   perfil padrão só para o primeiro usuário que já usou este navegador
   (bootstrap comum em sistemas novos: alguém precisa ter acesso total
   para configurar os demais). Os seguintes entram como Operador. */
const PERFIS_DISPONIVEIS=['Administrador','Gestor','Operador','Consulta'];

function usuarioPorLogin(login){
  return usuariosTodos().find(u=>u.login===login)||null;
}

/* Chamado por js/login.js a cada entrada bem-sucedida. Cria o registro
   na primeira vez (perfil Administrador se for o primeiro do navegador,
   Operador nas demais) ou só atualiza último acesso/fazenda se já existir. */
function usuarioRegistrarAcesso(nome,login){
  const lista=usuariosTodos();
  const idx=lista.findIndex(u=>u.login===login);
  const agora=new Date().toISOString();
  const fazendaId=localStorage.getItem('coi_fazenda_ativa')||'';
  if(idx>=0){
    lista[idx].nome=nome;
    lista[idx].ultimoAcesso=agora;
    lista[idx].fazendaId=fazendaId;
  }else{
    lista.push({
      id:gId(), nome, login,
      cargo:localStorage.getItem('coi_user_cargo')||'Operador de Campo',
      fazendaId,
      perfil:lista.length===0?'Administrador':'Operador',
      status:'Ativo',
      criadoEm:agora,
      ultimoAcesso:agora,
    });
  }
  usuariosSalvarTudo(lista);
}

function usuarioAtualizar(id,dados){
  const lista=usuariosTodos();
  const idx=lista.findIndex(u=>u.id===id);
  if(idx<0) return {ok:false,erros:['Usuário não encontrado.']};
  lista[idx]={...lista[idx],...dados};
  usuariosSalvarTudo(lista);
  return {ok:true,registro:lista[idx]};
}

function usuarioAlternarStatus(id){
  const u=usuariosTodos().find(x=>x.id===id);
  if(!u) return;
  usuarioAtualizar(id,{status:u.status==='Ativo'?'Inativo':'Ativo'});
}

/* Usuário da sessão atual (mesma chave coi_user do topbar/perfil local,
   Fase 9.2) — usado por services/permissoes.js. */
function usuarioAtual(){
  const login=localStorage.getItem('coi_user')||'';
  return usuarioPorLogin(login);
}
