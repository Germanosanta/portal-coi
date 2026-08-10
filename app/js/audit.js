/* ── AUDITORIA ──────────────────────────────────────────────────────
   Registra automaticamente inclusão/alteração/exclusão de qualquer
   tela (data, hora, usuário, tela, operação, detalhe). ÚNICA trilha de
   auditoria para eventos de dado de negócio (Horímetro/Paradas/
   Planejamento/Calibração/Fertirrigação/Cadastros) — nenhum outro
   arquivo deve criar uma segunda trilha para os mesmos eventos.
   `services/auditoria.js` (coi_auditoria) continua existindo à parte,
   só para eventos de GOVERNANÇA (login/logout, usuários/permissões) que
   nenhum serviço de negócio conhece — ver o cabeçalho daquele arquivo.

   Fase 16 — ganhou 3 campos opcionais (`registro`/`valorAnterior`/
   `valorNovo`) para atender o Ponto 8 (auditoria com "valor anterior →
   valor novo" estruturado, não só texto livre em `detalhe`) sem quebrar
   nenhuma das dezenas de chamadas existentes que só passam
   (tela,operacao,detalhe) — os 3 campos novos são opcionais.

   Nesta fase o armazenamento é local (localStorage); o Módulo Firebase/
   Supabase substituirá `auditAll`/`auditLog` por leitura/escrita
   remota sem alterar quem os chama. ──────────────────────────────── */

const AUDIT_KEY='coi_audit';

function auditAll(){ return lsGet(AUDIT_KEY,[]); }

function auditLog(tela,operacao,detalhe,meta){
  const m=meta||{};
  const list=auditAll();
  list.unshift({
    data:today(),
    hora:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
    usuario:localStorage.getItem('coi_user')||'Operador Local',
    tela, operacao, detalhe:detalhe||'',
    registro:m.registro||'', valorAnterior:m.valorAnterior??'', valorNovo:m.valorNovo??'',
  });
  lsSet(AUDIT_KEY,list.slice(0,500));
  renderAudit();
}

/* Monta a tabela HTML da trilha de negócio — extraído para reuso
   (Ponto 8: a mesma trilha aparece na aba "Auditoria" de Lançamentos E
   no módulo independente de Administração, sem duplicar dado nem
   lógica de apresentação). */
function auditTabelaHtml(list){
  const opBadge={'INCLUSÃO':'b-success','ALTERAÇÃO':'b-warning','EXCLUSÃO':'b-danger'};
  return list.length?`<table class="table"><thead><tr><th>Data</th><th>Hora</th><th>Usuário</th><th>Tela</th><th>Operação</th><th>Detalhe</th></tr></thead><tbody>${list.slice(0,200).map(a=>{
    const detalheHtml=(a.valorAnterior||a.valorNovo)
      ?`<span style="color:var(--text-tertiary)">${a.valorAnterior||'—'}</span> → <strong>${a.valorNovo||'—'}</strong>${a.detalhe?` · ${a.detalhe}`:''}`
      :a.detalhe;
    return `<tr><td>${fmtD(a.data)}</td><td>${a.hora}</td><td>${a.usuario}</td><td>${a.tela}</td><td><span class="badge ${opBadge[a.operacao]||'b-neutral'}">${a.operacao}</span></td><td style="font-size:11px;color:var(--text-secondary)">${detalheHtml}</td></tr>`;
  }).join('')}</tbody></table>`:emEl('Nenhum evento registrado ainda.');
}

function renderAudit(){
  const list=auditAll();
  const cnt=document.getElementById('lhm-aud-cnt');
  if(cnt) cnt.textContent=list.length.toLocaleString('pt-BR')+' eventos';
  const tbl=document.getElementById('lhm-aud-tbl');
  if(tbl) tbl.innerHTML=auditTabelaHtml(list);
  /* Ponto 8 — módulo independente (Administração > Auditoria) mostra a
     MESMA trilha, sem segunda consulta/fonte. */
  if(typeof renderAdminAuditoriaNegocio==='function') renderAdminAuditoriaNegocio();
}
