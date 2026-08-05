/* ── FILTER STATE ───────────────────────────────────────────────── */
const FS = { irrig:{faz:'',pv:'',mt:'',d1:'',d2:''}, ferti:{cl:'',mt:'',d1:'',d2:''}, itv:{tp:'',d1:'',d2:''}, hor:{faz:'',cl:'',orig:'',d1:'',d2:''} };

function applyF(mod){
  if(mod==='irrig'){ FS.irrig={faz:v('fi-faz'),pv:v('fi-pv'),mt:v('fi-mt'),d1:v('fi-d1'),d2:v('fi-d2')}; renderIrrig(); }
  if(mod==='ferti'){ FS.ferti={cl:v('ff-cl'),mt:v('ff-mt'),d1:v('ff-d1'),d2:v('ff-d2')}; renderFerti(); }
  if(mod==='itv'){ FS.itv={tp:v('fi2-tp'),d1:v('fi2-d1'),d2:v('fi2-d2')}; renderItv(); }
  if(mod==='hor'){ FS.hor={faz:v('fh-faz'),cl:v('fh-cl'),orig:v('fh-orig'),d1:v('fh-d1'),d2:v('fh-d2')}; renderHor(); }
}
function resetF(mod){
  const ids={irrig:['fi-faz','fi-pv','fi-mt','fi-d1','fi-d2'],ferti:['ff-cl','ff-mt','ff-d1','ff-d2'],itv:['fi2-tp','fi2-d1','fi2-d2'],hor:['fh-faz','fh-cl','fh-orig','fh-d1','fh-d2']};
  (ids[mod]||[]).forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
  applyF(mod);
}

/* ── FILTER FUNCTIONS ───────────────────────────────────────────── */
function fEXE(){
  const fs=FS.irrig;
  return EXE_D.filter(r=>{
    if(fs.faz && r[0]!==fs.faz) return false;
    if(fs.pv  && String(r[1])!==fs.pv) return false;
    if(fs.mt) { const cat=r[4]; if(!((fs.mt==='Feito'&&cat==='feito')||(fs.mt==='Operacional'&&cat==='oper')||(fs.mt==='Mecânico'&&cat==='mec')||(fs.mt==='Elétrico'&&cat==='ele'))) return false; }
    return inR(r[5],fs.d1,fs.d2);
  });
}
function fITV(){
  const fs=FS.itv;
  return ITV_D.filter(r=>{ if(fs.tp && r[3]!==fs.tp) return false; return inR(r[0],fs.d1,fs.d2); });
}
function fHOR(){
  const fs=FS.hor;
  return HOR_D.filter(r=>{ if(fs.faz&&r[1]!==fs.faz)return false; if(fs.cl&&r[3]!==fs.cl)return false; if(fs.orig&&r[5]!==fs.orig)return false; return inR(r[0],fs.d1,fs.d2); });
}
function fFERTI(){
  const fs=FS.ferti;
  return FERTI_D.filter(r=>{ if(fs.cl&&r.cultura!==fs.cl)return false; if(fs.mt&&r.motivo!==fs.mt)return false; return inR(r.data,fs.d1,fs.d2); });
}

/* ── DATA TABLES ────────────────────────────────────────────────── */
let pE=0,pI=0,pH=0,pFe=0;
const PER=50;
function fDTE(){const q=(v('dte-q')||'').toLowerCase(),mt=v('dte-mt'),ms=v('dte-ms');return EXE_D.filter(r=>{if(q&&!String(r[1]).includes(q)&&!(r[2]||'').toLowerCase().includes(q))return false;if(mt&&r[4]!==mt)return false;if(ms&&mes(r[5])!==ms)return false;return true;});}
function rDTE(){pE=0;const d=fDTE();document.getElementById('dte-cnt').textContent=d.length.toLocaleString('pt-BR')+' registros';rDTEP(d);}
function rDTEP(d){const s=d.slice(pE*PER,(pE+1)*PER);const sc={feito:'b-success',oper:'b-warning',mec:'b-info',ele:'b-danger',prog:'b-purple'};document.getElementById('dte-tbl').innerHTML=s.length?`<table class="table"><thead><tr><th>Fazenda</th><th>Pivô</th><th>Cultura</th><th>Indicador</th><th>Status</th><th>Data</th></tr></thead><tbody>${s.map(r=>`<tr><td><span class="badge b-neutral">${r[0]}</span></td><td><span class="badge b-brand">P.${r[1]}</span></td><td style="font-size:11px">${r[2]}</td><td>${r[3]}</td><td><span class="badge ${sc[r[4]]||'b-neutral'}">${r[4]}</span></td><td style="font-size:11px;color:var(--text-tertiary)">${fmtD(r[5])}</td></tr>`).join('')}</tbody></table>`:emEl();pag('dte-pg',d.length,pE,p=>{pE=p;rDTEP(fDTE());});}
function fDTI(){const q=(v('dti-q')||'').toLowerCase(),tp=v('dti-tp'),ms=v('dti-ms');return ITV_D.filter(r=>{if(q&&!(r[2]||'').toLowerCase().includes(q))return false;if(tp&&r[3]!==tp)return false;if(ms&&mes(r[0])!==ms)return false;return true;});}
function rDTI(){pI=0;const d=fDTI();document.getElementById('dti-cnt').textContent=d.length.toLocaleString('pt-BR')+' registros';rDTIP(d);}
function rDTIP(d){const s=d.slice(pI*PER,(pI+1)*PER);const mc4={Mecânico:'b-info',Elétrico:'b-danger',Operacional:'b-warning'};document.getElementById('dti-tbl').innerHTML=s.length?`<table class="table"><thead><tr><th>Data</th><th>Pivô</th><th>Causa</th><th>Tipo</th><th style="text-align:right">Horas</th></tr></thead><tbody>${s.map(r=>`<tr><td style="white-space:nowrap">${fmtD(r[0])}</td><td><span class="badge b-brand">P.${r[1]}</span></td><td style="font-size:11px">${r[2]||'—'}</td><td><span class="badge ${mc4[r[3]]||'b-neutral'}">${r[3]||'—'}</span></td><td style="text-align:right;font-weight:700;color:#dc2626">${fmt(r[4],2)}</td></tr>`).join('')}</tbody></table>`:emEl();pag('dti-pg',d.length,pI,p=>{pI=p;rDTIP(fDTI());});}
function fDTH(){const q=(v('dth-q')||'').toLowerCase(),faz=v('dth-faz'),ms=v('dth-ms');return HOR_D.filter(r=>{if(q&&!String(r[2]).includes(q)&&!(r[3]||'').toLowerCase().includes(q))return false;if(faz&&r[1]!==faz)return false;if(ms&&mes(r[0])!==ms)return false;return true;});}
function rDTH(){pH=0;const d=fDTH();document.getElementById('dth-cnt').textContent=d.length.toLocaleString('pt-BR')+' registros';rDTHP(d);}
function rDTHP(d){const s=d.slice(pH*PER,(pH+1)*PER);const oc={KARITEL:'b-brand',RDM:'b-info',CSV:'b-purple'};document.getElementById('dth-tbl').innerHTML=s.length?`<table class="table"><thead><tr><th>Data</th><th>Fazenda</th><th>Pivô</th><th>Cultura</th><th style="text-align:right">Horas</th><th>Origem</th></tr></thead><tbody>${s.map(r=>`<tr><td>${fmtD(r[0])}</td><td><span class="badge b-neutral">${r[1]}</span></td><td><span class="badge b-brand">P.${r[2]}</span></td><td><span class="badge b-success">${r[3]||'—'}</span></td><td style="text-align:right;font-weight:700;color:var(--brand-600)">${fmt(r[4],2)}h</td><td><span class="badge ${oc[r[5]]||'b-neutral'}">${r[5]}</span></td></tr>`).join('')}</tbody></table>`:emEl();pag('dth-pg',d.length,pH,p=>{pH=p;rDTHP(fDTH());});}
function fDTF(){const q=(v('dtf-q')||'').toLowerCase(),tp=v('dtf-tp');return FAL_D.filter(r=>{if(q&&!String(r[1]).includes(q)&&!(r[2]||'').toLowerCase().includes(q))return false;if(tp&&r[2]!==tp)return false;return true;});}
function rDTF(){const d=fDTF();document.getElementById('dtf-cnt').textContent=d.length.toLocaleString('pt-BR')+' registros';const s=d.slice(0,100);const mc5={Mecânico:'b-info',Elétrico:'b-danger',Operacional:'b-warning',Programação:'b-purple'};document.getElementById('dtf-tbl').innerHTML=s.length?`<table class="table"><thead><tr><th>Fazenda</th><th>Pivô</th><th>Categoria</th><th>Causa</th><th>Data</th></tr></thead><tbody>${s.map(r=>`<tr><td><span class="badge b-neutral">${r[0]}</span></td><td><span class="badge b-brand">P.${r[1]}</span></td><td><span class="badge ${mc5[r[2]]||'b-neutral'}">${r[2]}</span></td><td style="font-size:11px">${r[3]}</td><td style="font-size:11px;color:var(--text-tertiary)">${fmtD(r[4])}</td></tr>`).join('')}</tbody></table>`:emEl();}
function fDTFe(){const q=(v('dtfe-q')||'').toLowerCase(),mt=v('dtfe-mt'),ms=v('dtfe-ms');return FERTI_D.filter(r=>{if(q&&!String(r.pivo||'').includes(q)&&!(r.cultura||'').toLowerCase().includes(q))return false;if(mt&&r.motivo!==mt)return false;if(ms&&mes(r.data)!==ms)return false;return true;});}
function rDTFe(){pFe=0;const d=fDTFe();document.getElementById('dtfe-cnt').textContent=d.length.toLocaleString('pt-BR')+' registros';rDTFeP(d);}
function rDTFeP(d){const s=d.slice(pFe*PER,(pFe+1)*PER);const mc6={Realizado:'b-success',Operacional:'b-warning',Logística:'b-purple',Mecânico:'b-info',Elétrico:'b-danger',Cancelado:'b-neutral'};document.getElementById('dtfe-tbl').innerHTML=s.length?`<table class="table"><thead><tr><th>Data</th><th>Pivô</th><th>Cultura</th><th>Aplicação</th><th>Motivo</th></tr></thead><tbody>${s.map(r=>`<tr><td style="white-space:nowrap">${fmtD(r.data)}</td><td><span class="badge b-brand">P.${r.pivo}</span></td><td><span class="badge b-success">${r.cultura}</span></td><td style="font-size:11px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.aplicacao||'—'}</td><td><span class="badge ${mc6[r.motivo]||'b-neutral'}">${r.motivo||'—'}</span></td></tr>`).join('')}</tbody></table>`:emEl();pag('dtfe-pg',d.length,pFe,p=>{pFe=p;rDTFeP(fDTFe());});}

/* ── PAGINATION ─────────────────────────────────────────────────── */
function pag(id,tot,cur,cb){
  const el=document.getElementById(id);if(!el)return;
  if(tot<=PER){el.style.display='none';return;}el.style.display='flex';
  const pages=Math.ceil(tot/PER),fr=cur*PER+1,to=Math.min((cur+1)*PER,tot);
  let btns='';const s=Math.max(0,cur-3),e2=Math.min(pages-1,s+6);for(let i=s;i<=e2;i++)btns+=`<button class="pag-btn${i===cur?' active':''}" onclick="(${cb.toString()})(${i})">${i+1}</button>`;
  el.innerHTML=`<span>Mostrando ${fr.toLocaleString('pt-BR')}–${to.toLocaleString('pt-BR')} de ${tot.toLocaleString('pt-BR')}</span><div class="pag-btns"><button class="pag-btn" onclick="(${cb.toString()})(${cur-1})" ${cur===0?'disabled':''}>‹</button>${btns}<button class="pag-btn" onclick="(${cb.toString()})(${cur+1})" ${cur===pages-1?'disabled':''}>›</button></div>`;
}
