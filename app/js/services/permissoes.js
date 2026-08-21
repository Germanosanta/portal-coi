/* ── SERVICES / PERMISSÕES (Fase 16 — Usuários, Perfis e Permissões) ───
   Banco oficial: Supabase, schema `coi` (perfis, permissoes_catalogo,
   perfil_permissoes — ver supabase/migrations/009_usuarios_perfis_
   permissoes.sql). Mesmo padrão cache-aside do resto do app: 3 caches
   em memória sincronizados 1x no boot (`permissoesSyncCache`), leitura
   sempre síncrona.

   5 perfis-base oficiais (seed da migration 009): Administrador,
   Coordenador, Supervisor, Operador/Lançador, Consulta. PERFIL e
   PERMISSÃO são independentes — o admin liga/desliga qualquer chave
   para qualquer perfil pela tela de Perfis (js/nav.js) sem precisar
   criar perfil novo (ex.: liberar lancamentos.excluir só pro Supervisor).

   API nova (usar em código novo):
     temPermissao('lancamentos.criar')
     podeVisualizar('lancamentos') / podeCriar / podeEditar / podeExcluir / podeExportar
     exigirPermissao('lancamentos.editar')  — bloqueia + mostra toast

   API antiga preservada (nenhuma tela existente precisou mudar):
     canView(modulo) / canEdit(modulo) / canDelete(modulo)
     bloquearSemPermissao(modulo,'edit'|'delete'|'view')
   'edit'/'delete'/'view' mapeiam para as chaves 'modulo.editar'/
   'modulo.excluir'/'modulo.visualizar' do catálogo novo.

   Sem usuário reconhecido (usuarioAtual()===null) OU sem cache
   sincronizado ainda, qualquer pergunta responde "sim" — mesmo
   comportamento de segurança que já existia (nunca tranca alguém fora
   do sistema por falta de cadastro/latência de rede; só restringe quem
   já tem perfil real atribuído E permissão carregada). ───────────────── */

let _perfisCache=[];
let _catalogoCache=[];
let _perfilPermissoesCache=[];
let _permissoesSyncOk=false;

async function permissoesSyncCache(){
  if(typeof window.coiDB==='undefined'){ console.warn('[permissoes] Supabase não configurado — cache vazio.'); return false; }
  try{
    const [perfisR,catalogoR,matrizR]=await Promise.all([
      window.coiDB.schema('coi').from('perfis').select('*').order('created_at',{ascending:true}),
      window.coiDB.schema('coi').from('permissoes_catalogo').select('*').order('ordem',{ascending:true}),
      window.coiDB.schema('coi').from('perfil_permissoes').select('*'),
    ]);
    if(perfisR.error) throw perfisR.error;
    if(catalogoR.error) throw catalogoR.error;
    if(matrizR.error) throw matrizR.error;
    _perfisCache=perfisR.data||[];
    _catalogoCache=catalogoR.data||[];
    _perfilPermissoesCache=matrizR.data||[];
    _permissoesSyncOk=true;
    return true;
  }catch(err){
    console.error('[permissoes] Falha ao sincronizar com o Supabase:',err);
    _permissoesSyncOk=false;
    return false;
  }
}

function _perfilNomePorId(perfilId){
  const p=_perfisCache.find(x=>x.id===perfilId);
  return p?p.nome:null;
}
function perfilPorNome(nome){ return _perfisCache.find(p=>p.nome===nome)||null; }
function perfisTodos(){ return _perfisCache; }
function catalogoPermissoes(){ return _catalogoCache; }

/* Chaves permitidas (permitido=true) de um perfil — usado pela tela de
   Perfis para marcar os checkboxes e por temPermissao() para checar. */
function permissoesDoPerfil(perfilId){
  return new Set(_perfilPermissoesCache.filter(pp=>pp.perfil_id===perfilId&&pp.permitido).map(pp=>pp.permissao_chave));
}

/* Núcleo: true/false para uma chave "modulo.acao" e o usuário logado. */
function temPermissao(chave){
  if(!_permissoesSyncOk) return true; // cache ainda não sincronizado — não tranca ninguém por latência
  const u=typeof usuarioAtual==='function'?usuarioAtual():null;
  if(!u||!u.perfilId) return true; // sem usuário/perfil reconhecido — mesmo comportamento de sempre
  return permissoesDoPerfil(u.perfilId).has(chave);
}

const podeVisualizar = modulo => temPermissao(`${modulo}.visualizar`);
const podeCriar      = modulo => temPermissao(`${modulo}.criar`);
const podeEditar     = modulo => temPermissao(`${modulo}.editar`);
const podeExcluir    = modulo => temPermissao(`${modulo}.excluir`);
const podeExportar   = modulo => temPermissao(`${modulo}.exportar`);

const MSG_SEM_PERMISSAO='Usuário sem permissão para executar esta ação.';

/* Camada 3 (ação) para código novo — bloqueia e já mostra o toast
   padrão, igual bloquearSemPermissao(), mas recebendo a chave direto
   ("lancamentos.excluir") em vez de (modulo,acao). */
function exigirPermissao(chave){
  const permitido=temPermissao(chave);
  if(!permitido&&typeof toast==='function') toast(MSG_SEM_PERMISSAO,'err');
  return permitido;
}

/* ── COMPATIBILIDADE — API antiga, usada por lanc.js/cadastro.js/nav.js.
   Mantida com a MESMA assinatura para não exigir alterar nenhuma das
   ~20 chamadas já existentes nessas telas. */
function canView(modulo){ return podeVisualizar(modulo); }
function canEdit(modulo){ return podeEditar(modulo); }
function canDelete(modulo){ return podeExcluir(modulo); }
function bloquearSemPermissao(modulo,acao){
  const permitido=acao==='delete'?canDelete(modulo):acao==='edit'?canEdit(modulo):canView(modulo);
  if(!permitido&&typeof toast==='function') toast(MSG_SEM_PERMISSAO,'err');
  return !permitido;
}

/* ── GRAVAÇÃO DA MATRIZ (tela de Perfis, js/nav.js) ───────────────────
   Liga/desliga UMA chave para UM perfil. Upsert simples (perfil_id +
   permissao_chave é a PK da tabela) — nunca cria linha duplicada. */
async function permissaoDefinir(perfilId,chave,permitido){
  const {error}=await window.coiDB.schema('coi').from('perfil_permissoes')
    .upsert({perfil_id:perfilId,permissao_chave:chave,permitido},{onConflict:'perfil_id,permissao_chave'});
  if(error) return {ok:false,erros:['Falha ao gravar permissão: '+error.message]};
  await permissoesSyncCache();
  return {ok:true};
}
