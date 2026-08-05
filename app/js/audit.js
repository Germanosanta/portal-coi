/* ── AUDITORIA ──────────────────────────────────────────────────────
   Registra automaticamente inclusão/alteração/exclusão de qualquer
   tela (data, hora, usuário, tela, operação, detalhe). Nesta fase o
   armazenamento é local (localStorage); o Módulo Firebase substituirá
   `auditAll`/`auditLog` por leitura/escrita no Firestore sem alterar
   quem os chama.
   ──────────────────────────────────────────────────────────────── */

const AUDIT_KEY='coi_audit';

function auditAll(){ return lsGet(AUDIT_KEY,[]); }

function auditLog(tela,operacao,detalhe){
  const list=auditAll();
  list.unshift({
    data:today(),
    hora:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
    usuario:localStorage.getItem('coi_user')||'Operador Local',
    tela, operacao, detalhe:detalhe||'',
  });
  lsSet(AUDIT_KEY,list.slice(0,500));
  renderAudit();
}

function renderAudit(){
  const list=auditAll();
  const cnt=document.getElementById('lhm-aud-cnt');
  if(cnt) cnt.textContent=list.length.toLocaleString('pt-BR')+' eventos';
  const tbl=document.getElementById('lhm-aud-tbl');
  if(!tbl) return;
  const opBadge={'INCLUSÃO':'b-success','ALTERAÇÃO':'b-warning','EXCLUSÃO':'b-danger'};
  tbl.innerHTML=list.length?`<table class="table"><thead><tr><th>Data</th><th>Hora</th><th>Usuário</th><th>Tela</th><th>Operação</th><th>Detalhe</th></tr></thead><tbody>${list.slice(0,200).map(a=>`<tr><td>${fmtD(a.data)}</td><td>${a.hora}</td><td>${a.usuario}</td><td>${a.tela}</td><td><span class="badge ${opBadge[a.operacao]||'b-neutral'}">${a.operacao}</span></td><td style="font-size:11px;color:var(--text-secondary)">${a.detalhe}</td></tr>`).join('')}</tbody></table>`:emEl('Nenhum evento registrado ainda.');
}
