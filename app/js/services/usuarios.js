/* ── SERVICES / USUÁRIOS ───────────────────────────────────────────────
   Fase 16 — banco oficial passou a ser o Supabase (tabela `usuarios`,
   ver supabase/migrations/009_usuarios_perfis_permissoes.sql), no lugar
   do localStorage (`coi_usuarios`). Mesmo padrão cache-aside já usado
   em services/horimetro.js: cache em memória (`_usuariosCache`)
   sincronizado do Supabase em `usuariosSyncCache()` (chamado 1x no
   boot, em main.js) — os READS continuam síncronos com a mesma
   assinatura de sempre; só as GRAVAÇÕES viram `async`.

   Não há autenticação real ainda (js/login.js só pede um nome, sem
   senha validada contra nada) — por isso não existe "senha" aqui; cada
   login bem-sucedido cria/atualiza um registro real (nome, login,
   cargo, fazenda, perfil, status, último acesso). Nenhum usuário
   fictício é pré-cadastrado. ────────────────────────────────────────── */

let _usuariosCache=[];
let _usuariosSyncOk=false;

async function usuariosSyncCache(){
  if(typeof window.coiDB==='undefined'){ console.warn('[usuarios] Supabase não configurado — cache vazio.'); return false; }
  try{
    const {data,error}=await window.coiDB.schema('coi').from('usuarios').select('*').order('created_at',{ascending:true});
    if(error) throw error;
    _usuariosCache=(data||[]).map(_rowToLocalUsuario);
    _usuariosSyncOk=true;
    return true;
  }catch(err){
    console.error('[usuarios] Falha ao sincronizar com o Supabase:',err);
    _usuariosSyncOk=false;
    return false;
  }
}

/* `ativo` é a coluna real (boolean, já existia na tabela antes desta
   fase — ver migration 009); o resto do app (telas/serviços) trabalha
   com `status:'Ativo'|'Bloqueado'` (texto), então a tradução acontece
   só aqui, nas duas pontas (leitura e gravação), sem espalhar `ativo`
   boolean pelo resto do código. */
function _rowToLocalUsuario(row){
  return {
    id:row.id, nome:row.nome, login:row.login||'', cargo:row.cargo||'',
    fazendaId:row.fazenda_id||'', perfilId:row.perfil_id||null,
    perfil:_perfilNomePorId(row.perfil_id), status:row.ativo?'Ativo':'Bloqueado',
    criadoEm:row.created_at, ultimoAcesso:row.ultimo_acesso,
  };
}

const usuariosTodos = () => _usuariosCache;
function usuarioPorLogin(login){ return usuariosTodos().find(u=>u.login===login)||null; }
function usuarioPorId(id){ return usuariosTodos().find(u=>u.id===id)||null; }

/* Chamado por js/login.js a cada entrada bem-sucedida. Cria o registro
   na primeira vez (perfil Administrador se for o primeiro usuário já
   cadastrado no banco, Operador/Lançador nas demais) ou só atualiza
   último acesso/fazenda se já existir. */
async function usuarioRegistrarAcesso(nome,login){
  const fazendaId=localStorage.getItem('coi_fazenda_ativa')||null;
  const existente=usuarioPorLogin(login);
  if(existente){
    const {error}=await window.coiDB.schema('coi').from('usuarios').update({
      nome, fazenda_id:fazendaId||null, ultimo_acesso:new Date().toISOString(),
    }).eq('id',existente.id);
    if(error){ console.error('[usuarios] falha ao atualizar acesso:',error); return; }
  }else{
    const perfilNome=usuariosTodos().length===0?'Administrador':'Operador/Lançador';
    const perfil=_perfisCache.find(p=>p.nome===perfilNome);
    const {error}=await window.coiDB.schema('coi').from('usuarios').insert({
      nome, login, cargo:localStorage.getItem('coi_user_cargo')||'Operador de Campo',
      fazenda_id:fazendaId||null, perfil_id:perfil?perfil.id:null,
      ativo:true, ultimo_acesso:new Date().toISOString(),
    });
    if(error){ console.error('[usuarios] falha ao registrar acesso:',error); return; }
  }
  await usuariosSyncCache();
}

async function usuarioAtualizar(id,dados){
  const atual=usuarioPorId(id);
  if(!atual) return {ok:false,erros:['Usuário não encontrado.']};
  const row={};
  if(dados.nome!==undefined) row.nome=dados.nome;
  if(dados.cargo!==undefined) row.cargo=dados.cargo;
  if(dados.status!==undefined) row.ativo=dados.status==='Ativo';
  if(dados.perfilId!==undefined) row.perfil_id=dados.perfilId;
  const {error}=await window.coiDB.schema('coi').from('usuarios').update(row).eq('id',id);
  if(error) return {ok:false,erros:['Falha ao gravar no banco: '+error.message]};
  await usuariosSyncCache();
  return {ok:true,registro:usuarioPorId(id)};
}

async function usuarioAlternarStatus(id){
  const u=usuarioPorId(id);
  if(!u) return {ok:false,erros:['Usuário não encontrado.']};
  return usuarioAtualizar(id,{status:u.status==='Ativo'?'Bloqueado':'Ativo'});
}

/* Usuário da sessão atual (mesma chave coi_user do topbar/login) —
   usado por services/permissoes.js para resolver o perfil/permissões. */
function usuarioAtual(){
  const login=localStorage.getItem('coi_user')||'';
  return usuarioPorLogin(login);
}
