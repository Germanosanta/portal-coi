/* ── UTILS ──────────────────────────────────────────────────────── */
const fmt  = (v,d=0) => Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:d,minimumFractionDigits:d});
const fmtP = (v,d=1) => Number(v||0).toFixed(d)+'%';
const mes  = d => d&&d.length>=7 ? d.slice(0,7) : '';
const fmtD = d => { if(!d) return '—'; if(d.includes('-')){const[y,m,dy]=d.split('-');return`${dy}/${m}/${y}`} return d; };
const today= () => new Date().toISOString().split('T')[0];
const gId  = () => Math.random().toString(36).slice(2,7).toUpperCase();
const now  = () => { const d=new Date(); return d.toLocaleDateString('pt-BR')+', '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); };
const v    = id => (document.getElementById(id)||{}).value||'';
const inR  = (d,d1,d2) => { const m=mes(d); if(d1&&m<d1)return false; if(d2&&m>d2)return false; return true; };
const clrEl= (id,html='') => { const el=document.getElementById(id); if(el) el.innerHTML=html; };
/* Usado só para destacar visualmente linhas recém-criadas nas tabelas de
   lançamento/histórico (Fase 9.3) — não interfere em nenhuma consulta. */
const isRecent24h = criadoEm => !!criadoEm && (Date.now()-new Date(criadoEm).getTime())<86400000;
