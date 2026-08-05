/* ── SERVICES / AUDITORIA (Fase 10.2) ──────────────────────────────────
   Novo serviço — não altera js/audit.js (que continua exatamente como
   estava, registrando inclusão/alteração/exclusão de cada lançamento
   dentro do próprio serviço de negócio, em coi_audit). Este aqui é um
   log complementar de GOVERNANÇA: login, exportação e alteração de
   usuários/permissões — eventos que nenhum services/* de negócio
   conhece, então precisavam de um dono próprio.

   Mesmo padrão lsGet/lsSet de todo serviço do projeto — pronto para
   virar coleção do Firestore na v4.0 (ver ROADMAP.md) sem mudar quem
   chama auditoriaRegistrar/auditoriaTodos. ─────────────────────────── */

const AUDITORIA_KEY='coi_auditoria';

const auditoriaTodos = () => lsGet(AUDITORIA_KEY,[]);
const auditoriaSalvarTudo = arr => lsSet(AUDITORIA_KEY,arr);

/* usuario vem sempre de coi_user (mesma sessão local do topbar/login,
   Fase 9.2/10.0) — nunca outro conceito de usuário em paralelo. */
function auditoriaRegistrar(acao,modulo,registro,descricao){
  const lista=auditoriaTodos();
  lista.unshift({
    id:gId(),
    dataHora:new Date().toISOString(),
    usuario:localStorage.getItem('coi_user')||'Operador Local',
    acao,
    modulo,
    registro:registro||'',
    descricao:descricao||'',
  });
  auditoriaSalvarTudo(lista.slice(0,1000));
}

/* Consulta única para a tela de Administração > Auditoria — filtros
   opcionais por usuário/módulo/período/texto livre, mesmo espírito do
   xConsultar já usado pelos serviços de lançamento. */
function auditoriaConsultar(filtros){
  const f=filtros||{};
  return auditoriaTodos().filter(r=>{
    if(f.usuario&&r.usuario!==f.usuario) return false;
    if(f.modulo&&r.modulo!==f.modulo) return false;
    if(f.dataInicio&&r.dataHora.slice(0,10)<f.dataInicio) return false;
    if(f.dataFim&&r.dataHora.slice(0,10)>f.dataFim) return false;
    if(f.texto){
      const alvo=(r.usuario+' '+r.acao+' '+r.modulo+' '+r.registro+' '+r.descricao).toLowerCase();
      if(!alvo.includes(f.texto.toLowerCase())) return false;
    }
    return true;
  });
}
