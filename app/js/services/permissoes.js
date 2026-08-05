/* ── SERVICES / PERMISSÕES (Fase 10.1 · aplicado na Fase 10.2) ─────────
   Estrutura pronta para Firebase Auth + Firestore Rules (v4.0, ver
   ROADMAP.md) — hoje aplicada com armazenamento local (services/usuarios.js).
   Sem usuário reconhecido (usuarioAtual()===null), qualquer pergunta
   responde "sim": nunca tranca alguém fora do sistema por falta de
   cadastro, só restringe quem já tem um perfil real atribuído.

   4 perfis:
     Administrador — acesso total; gerencia usuários; edita/exclui
       cadastros; acessa auditoria.
     Gestor        — vê tudo; edita lançamentos; não exclui nada
       (cadastros são "estruturas críticas").
     Operador      — só o dia a dia operacional: lançamentos e o
       Painel Operacional; não exclui nada.
     Consulta      — só visualização, em qualquer módulo.
   ──────────────────────────────────────────────────────────────────── */

/* "administracao" (Usuários/Auditoria/Perfis/Permissões) fica de fora do
   "view:['*']" de Gestor/Consulta de propósito — o enunciado da Fase
   10.2 só concede "acessar auditoria"/"gerenciar usuários" ao
   Administrador; os demais perfis enxergam tudo que é operação/gestão,
   mas não a área administrativa. */
const PERFIL_PERMISSOES={
  'Administrador':{view:['*'],edit:['*'],delete:['*']},
  'Gestor'        :{view:['dashboard','indicadores','relatorios','irrig','lancamentos','cadastros','opdash'],edit:['lancamentos'],delete:[]},
  'Operador'      :{view:['lancamentos','opdash'],edit:['lancamentos'],delete:[]},
  'Consulta'      :{view:['dashboard','indicadores','relatorios','irrig','lancamentos','cadastros','opdash'],edit:[],delete:[]},
};

const MSG_SEM_PERMISSAO='Usuário sem permissão para executar esta ação.';

function hasPermission(perfil,acao,modulo){
  const def=PERFIL_PERMISSOES[perfil];
  if(!def) return true;
  const lista=def[acao]||[];
  return lista.includes('*')||lista.includes(modulo);
}
function canView(modulo){
  const u=typeof usuarioAtual==='function'?usuarioAtual():null;
  return !u||hasPermission(u.perfil,'view',modulo);
}
function canEdit(modulo){
  const u=typeof usuarioAtual==='function'?usuarioAtual():null;
  return !u||hasPermission(u.perfil,'edit',modulo);
}
function canDelete(modulo){
  const u=typeof usuarioAtual==='function'?usuarioAtual():null;
  return !u||hasPermission(u.perfil,'delete',modulo);
}

/* Guarda compartilhada usada pelas telas (js/lanc.js, js/cadastro.js,
   js/nav.js) — nunca dentro de um services/* existente. Retorna true
   quando a ação deve ser interrompida (e já mostra o toast padrão). */
function bloquearSemPermissao(modulo,acao){
  const permitido=acao==='delete'?canDelete(modulo):acao==='edit'?canEdit(modulo):canView(modulo);
  if(!permitido&&typeof toast==='function') toast(MSG_SEM_PERMISSAO,'err');
  return !permitido;
}
