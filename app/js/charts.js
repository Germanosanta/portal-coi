/* ── CHART PRIMITIVES ───────────────────────────────────────────── */
function barH(rows, lw=110, showPct=false) {
  if(!rows||!rows.length) return emEl();
  const max=Math.max(...rows.map(r=>r.v),1);
  return rows.map(r=>`<div class="bar-h">
    <div class="bar-h-label" style="width:${lw}px" title="${r.l}">${r.l}</div>
    <div class="bar-h-track"><div class="bar-h-fill" style="width:${(r.v/max*100).toFixed(1)}%;background:${r.c||'var(--brand-600)'}"></div></div>
    <div class="bar-h-val" style="color:${r.c||'var(--brand-600)'}">${fmt(r.v,r.dec||0)}${r.unit||''}</div>
  </div>`).join('');
}

function lineChart(series, H=130) {
  if(!series||!series.length||!series[0].pts||!series[0].pts.length) return emEl();
  const W=520, PAD={t:22,r:14,b:32,l:46};
  const cW=W-PAD.l-PAD.r, cH=H-PAD.t-PAD.b;
  const allY=series.flatMap(s=>s.pts.map(p=>p.y));
  const maxY=Math.max(...allY,1);
  const xs=series[0].pts;
  const xStep=xs.length>1?cW/(xs.length-1):cW;
  const px=i=>PAD.l+i*xStep, py=val=>PAD.t+cH-(val/maxY)*cH;
  let svg=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block">`;
  // Grid
  [0,.25,.5,.75,1].forEach(f=>{
    const val=maxY*f, y=py(val);
    svg+=`<line x1="${PAD.l}" y1="${y}" x2="${W-PAD.r}" y2="${y}" stroke="var(--border)" stroke-width="1"/>`;
    svg+=`<text x="${PAD.l-5}" y="${y+4}" text-anchor="end" font-size="9" fill="var(--text-tertiary)">${val>=1000?(val/1000).toFixed(1)+'k':Math.round(val)}</text>`;
  });
  // X labels
  const step=Math.max(1,Math.ceil(xs.length/9));
  xs.forEach((p,i)=>{ if(i%step===0||i===xs.length-1) svg+=`<text x="${px(i)}" y="${H-PAD.b+14}" text-anchor="middle" font-size="8.5" fill="var(--text-tertiary)">${p.x}</text>`; });
  // Series
  series.forEach(s=>{
    if(!s.pts.length) return;
    const pts=s.pts.map((p,i)=>`${px(i)},${py(p.y)}`).join(' ');
    svg+=`<polygon points="${PAD.l},${PAD.t+cH} ${pts} ${px(s.pts.length-1)},${PAD.t+cH}" fill="${s.c}" opacity="0.08"/>`;
    svg+=`<polyline points="${pts}" fill="none" stroke="${s.c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    if(s.pts.length<=28) s.pts.forEach((p,i)=>svg+=`<circle cx="${px(i)}" cy="${py(p.y)}" r="2.5" fill="${s.c}" stroke="var(--bg-surface)" stroke-width="1.5"/>`);
  });
  // Legend
  if(series.length>1){ let lx=PAD.l; series.forEach(s=>{ svg+=`<rect x="${lx}" y="4" width="10" height="10" rx="2.5" fill="${s.c}"/>`; svg+=`<text x="${lx+13}" y="13" font-size="9.5" fill="var(--text-secondary)" font-weight="600">${s.lbl}</text>`; lx+=s.lbl.length*5.5+22; }); }
  svg+='</svg>'; return svg;
}

function donut(segs, cv, cl, sz=108) {
  const tot=segs.reduce((a,s)=>a+s.v,0)||1;
  const R=38, C=2*Math.PI*R;
  let off=0, arcs='';
  segs.forEach(s=>{ const d=C*s.v/tot; arcs+=`<circle cx="50" cy="50" r="${R}" fill="none" stroke="${s.c}" stroke-width="14" stroke-dasharray="${d} ${C-d}" stroke-dashoffset="${-off}" transform="rotate(-90 50 50)"/>`; off+=d; });
  return `<div class="donut-wrap">
    <div class="donut-rel" style="width:${sz}px;height:${sz}px">
      <svg width="${sz}" height="${sz}" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--bg-surface3)" stroke-width="14"/>${arcs}
      </svg>
      <div class="donut-center"><div class="donut-center-val">${cv}</div><div class="donut-center-lbl">${cl}</div></div>
    </div>
    <div class="donut-legend">${segs.filter(s=>s.v>0).map(s=>`<div class="donut-leg-row"><div class="donut-leg-left"><div class="donut-dot" style="background:${s.c}"></div><span class="donut-leg-label">${s.l}</span></div><span class="donut-leg-val">${fmtP(s.v/tot*100)}</span></div>`).join('')}</div>
  </div>`;
}

function gauge(val, color, title, sub='') {
  const pct=Math.min(Math.max((val||0)/100,0),1);
  const R=50, cx=80, cy=80;
  const fgX=cx-R*Math.cos(Math.PI*(1-pct)), fgY=cy-R*Math.sin(Math.PI*pct);
  const lf=pct>.5?1:0;
  const nx=cx+R*0.72*Math.cos(Math.PI*(1+pct)), ny=cy-R*0.72*Math.sin(Math.PI*pct);
  return `<div class="gauge-wrap">
    <svg width="160" height="92" viewBox="0 0 160 92">
      <defs><linearGradient id="g-${title.replace(/\s/g,'')}" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="${color}" stop-opacity=".6"/><stop offset="100%" stop-color="${color}"/></linearGradient></defs>
      <path d="M${cx-R},${cy} A${R},${R} 0 0,1 ${cx+R},${cy}" fill="none" stroke="var(--bg-surface3)" stroke-width="13" stroke-linecap="round"/>
      ${pct>0?`<path d="M${cx-R},${cy} A${R},${R} 0 ${lf},1 ${fgX},${fgY}" fill="none" stroke="url(#g-${title.replace(/\s/g,'')})" stroke-width="13" stroke-linecap="round"/>`:''}
      <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="5" fill="${color}"/>
      <text x="${cx}" y="${cy-14}" text-anchor="middle" font-size="18" font-weight="800" fill="${color}">${fmtP(val)}</text>
      <text x="${cx-R+2}" y="${cy+14}" font-size="8" fill="var(--text-tertiary)">0%</text>
      <text x="${cx+R-2}" y="${cy+14}" font-size="8" fill="var(--text-tertiary)" text-anchor="end">100%</text>
    </svg>
    <div class="gauge-title">${title}</div>
    ${sub?`<div class="gauge-sub">${sub}</div>`:''}
  </div>`;
}

function kpi(label,val,unit,sub,bar,bclr,cls,ico='') {
  return `<div class="kpi ${cls}">
    <div class="kpi-accent"></div>
    ${ico?`<div class="kpi-icon-wrap">${ico}</div>`:''}
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${val}${unit?`<span class="kpi-unit">${unit}</span>`:''}</div>
    ${sub?`<div class="kpi-sub"><div class="kpi-sub-dot"></div>${sub}</div>`:''}
    ${bar!==null&&bar!==undefined?`<div class="kpi-bar"><div class="kpi-bar-fill" style="width:${Math.min(bar,100).toFixed(0)}%;background:${bclr||'currentColor'}"></div></div>`:''}
  </div>`;
}

function emEl(msg='Sem dados'){return`<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><div class="empty-state-title">Sem dados</div><div class="empty-state-sub">${msg}</div></div>`;}
function badge(txt,cls){return`<span class="badge ${cls}">${txt}</span>`;}
