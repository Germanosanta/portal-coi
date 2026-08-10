/* ── PAGE ROUTING ───────────────────────────────────────────────── */
const BC = {home:'Portal COI',opdash:'Painel Operacional',exec:'Visão Geral',irrig:'Planejado x Executado',ferti:'Consumo',itv:'Paradas',hor:'Equipamentos',fal:'Eficiência',lanc:'Lançamentos',relat:'Gerencial e Exportações',dados:'Consulta Operacional',cad:'Cadastros',cfg:'Configurações',admin:'Administração'};
let curPage='home';

function goPage(id, btn) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const el=document.getElementById('page-'+id); if(el) el.classList.add('active');
  if(btn) btn.classList.add('active'); else { const nb=document.querySelector(`[data-page="${id}"]`); if(nb) nb.classList.add('active'); }
  curPage=id; closeMobileSB();
  /* Fase 13.1 — Portal COI não tem sidebar/topbar (só a tela de entrada);
     cada módulo passa a ter a própria navegação, então o rótulo do
     cabeçalho vira o nome do módulo (grupo do SB_MODULES), não mais um
     breadcrumb de 3 níveis. */
  document.body.classList.toggle('coi-portal',id==='home');
  const bcEl=document.getElementById('bc-current');
  if(bcEl){
    const mod=typeof SB_MODULES!=='undefined'&&typeof resolveActiveKey==='function'
      ?SB_MODULES.find(m=>m.key===resolveActiveKey()):null;
    bcEl.textContent=(mod&&mod.group)||BC[id]||id;
  }
  if(typeof renderSidebarNav==='function') renderSidebarNav();
  if(id==='home')    { if(typeof renderHome==='function') renderHome(); }
  if(id==='opdash')  { if(typeof renderOpDash==='function') renderOpDash(); }
  if(id==='exec')    { renderExec(); if(typeof renderExecLive==='function') renderExecLive(); }
  if(id==='irrig')   renderIrrig();
  if(id==='ferti')   renderFerti();
  if(id==='itv')     renderItv();
  if(id==='hor')     renderHor();
  if(id==='fal')     renderFal();
  if(id==='energia') { if(typeof renderEnergia==='function') renderEnergia(); }
  if(id==='lanc')    { lhm.tabNav('lanc'); if(typeof renderLancHist==='function') renderLancHist(); }
  if(id==='relat')   renderRelat();
  if(id==='dados')   { rDTE();rDTI();rDTH();rDTF();rDTFe(); if(typeof dq!=='undefined'){ dq.init(); restoreDqLegadoState(); } }
  if(id==='cad')     renderCad();
  if(id==='cfg')     renderCfg();
  if(id==='admin')   { if(typeof renderAdmin==='function') renderAdmin(); }
}

/* ═══════════════════ PAGE RENDERS ══════════════════════════════════ */

/* ── EXEC ───────────────────────────────────────────────────────── */
function renderExec(){
  const T=D.irrig_totals, FS2=D.ferti_stats, IS=D.itv_stats, HS=D.hor_stats, FL=D.fal_stats;
  const assI=T.ass, assF=FS2.ass;
  document.getElementById('exec-kpis').innerHTML=
    kpi('Planejado × Executado',fmt(T.plan),'',`${fmtP(assI)} assertividade`,assI,'#16a34a','kpi-teal')+
    kpi('Feito (Irrigação)',fmt(T.feito),'','execuções confirmadas',assI,'#16a34a','kpi-green')+
    kpi('Assertividade',fmtP(assI),'','meta: ≥ 85%',assI,'#16a34a',assI>=85?'kpi-green':assI>=65?'kpi-amber':'kpi-red')+
    kpi('Ferti Realizado',fmt(FS2.realizado),'',`${fmtP(assF)} de ${fmt(FS2.total)}`,assF,'#7c3aed','kpi-purple')+
    kpi('Horas Paradas',fmt(IS.horas_total,0),'h',`${fmt(IS.total)} paradas registradas`,null,null,'kpi-amber')+
    kpi('Horas Irrigadas',fmt(HS.total_horas,0),'h','Fato_Horimetro consolidado',null,null,'kpi-teal')+
    kpi('Falhas Registradas',fmt(FL.total),'',`Mec:${FL.mec} Ele:${FL.ele} Oper:${FL.oper}`,null,null,'kpi-red')+
    kpi('Pivôs Ativos',HS.pivos_ativos,'',`de ${(cadAll('pivos')||[]).length} cadastrados`,null,null,'kpi-sky');

  // Gauges
  const disp=Math.min(HS.total_horas/(HS.total_horas+(IS.horas_total||1))*100,100);
  const impPar=(T.oper+T.mec+T.ele)/Math.max(T.feito+T.oper+T.mec+T.ele,1)*100;
  document.getElementById('exec-gauges').innerHTML=`
    <div class="card"><div class="card-body" style="display:flex;justify-content:center">${gauge(assI,assI>=85?'#16a34a':assI>=65?'#d97706':'#dc2626','Assertividade Irrigação',T.feito.toLocaleString('pt-BR')+' realizados')}</div></div>
    <div class="card"><div class="card-body" style="display:flex;justify-content:center">${gauge(assF,'#7c3aed','Assertividade Ferti',FS2.realizado.toLocaleString('pt-BR')+' realizados')}</div></div>
    <div class="card"><div class="card-body" style="display:flex;justify-content:center">${gauge(disp,'#0284c7','Disponibilidade Horas',fmt(HS.total_horas,0)+'h irrigadas')}</div></div>`;

  // Evolução irrigação
  const tl=D.irrig_timeline.slice(-18);
  document.getElementById('exec-ev-irrig').innerHTML=lineChart([
    {lbl:'Realizado',pts:tl.map(r=>({x:r[0].slice(2),y:r[1]})),c:'#16a34a'},
    {lbl:'Paradas',pts:tl.map(r=>({x:r[0].slice(2),y:r[2]+r[3]+r[4]})),c:'#ef4444'}
  ],130);

  // Evolução ITV
  const itvm=D.itv_meses.slice(-18);
  document.getElementById('exec-ev-itv').innerHTML=lineChart([
    {lbl:'Operacional',pts:itvm.map(r=>({x:r[0].slice(2),y:r[3]})),c:'#d97706'},
    {lbl:'Mecânico',pts:itvm.map(r=>({x:r[0].slice(2),y:r[4]})),c:'#2563eb'},
    {lbl:'Elétrico',pts:itvm.map(r=>({x:r[0].slice(2),y:r[5]})),c:'#dc2626'}
  ],130);

  // Top 10 pivôs paradas
  document.getElementById('exec-top-piv').innerHTML=barH(D.irrig_pivos_paradas.slice(0,10).map(p=>({l:'P.'+p.pivo,v:p.horas,c:'#d97706',dec:1})),45);

  // Top causas
  document.getElementById('exec-top-caus').innerHTML=barH(D.irrig_causas.slice(0,10).map(c=>({l:c.c,v:c.h,c:c.t==='Mecânico'?'#2563eb':c.t==='Elétrico'?'#dc2626':'#d97706',dec:1})),155);

  // Ferti donut
  const M=FS2.motivos||{};
  const par=(M.Operacional||0)+(M.Mecânico||0)+(M.Elétrico||0)+(M.Logística||0)+(M.Cancelado||0);
  document.getElementById('exec-ferti-donut').innerHTML=donut([
    {l:'Realizado',v:M.Realizado||0,c:'#16a34a'},
    {l:'Operacional',v:M.Operacional||0,c:'#d97706'},
    {l:'Logística',v:M.Logística||0,c:'#7c3aed'},
    {l:'Mecânico',v:M.Mecânico||0,c:'#2563eb'},
    {l:'Elétrico',v:M.Elétrico||0,c:'#dc2626'},
  ].filter(s=>s.v>0), fmtP(assF), 'assert.', 108);
}

/* Planejado × Executado real — só chama js/services/planejamento.js
   (que já cruza com Horímetro sozinho), nunca recalcula aqui. */
function renderPlanejamentoLocal(){
  const hoje=today(), inicioMes=hoje.slice(0,7)+'-01';
  const resumo=planejamentoResumo(inicioMes,hoje);
  document.getElementById('plan-kpis').innerHTML=
    kpi('Planejado (mês)',resumo.total,'','',null,null,'kpi-teal')+
    kpi('Executado',resumo.feito,'',fmtP(resumo.assertividade),resumo.assertividade,'#16a34a','kpi-green')+
    kpi('Pendente',resumo.pendente,'','ainda não executado',null,null,'kpi-amber')+
    kpi('Assertividade',fmtP(resumo.assertividade),'','meta: ≥ 85%',resumo.assertividade,resumo.assertividade>=85?'#16a34a':'#d97706',resumo.assertividade>=85?'kpi-green':'kpi-amber');
  if(typeof planUI!=='undefined') planUI.render();
}

/* ── IRRIG ──────────────────────────────────────────────────────── */
function renderIrrig(){
  renderPlanejamentoLocal();
  const data=fEXE();
  const feito=data.filter(r=>r[4]==='feito').length;
  const oper=data.filter(r=>r[4]==='oper').length;
  const mec=data.filter(r=>r[4]==='mec').length;
  const ele=data.filter(r=>r[4]==='ele').length;
  const tot=data.length, ass=tot>0?feito/tot*100:0;

  document.getElementById('irrig-kpis').innerHTML=
    kpi('Total',fmt(tot),'','no período',null,null,'kpi-teal')+
    kpi('Realizado',fmt(feito),'',fmtP(ass),ass,'#16a34a',ass>=80?'kpi-green':ass>=60?'kpi-amber':'kpi-red')+
    kpi('Assertividade',fmtP(ass),'','',ass,'#16a34a',ass>=80?'kpi-green':ass>=60?'kpi-amber':'kpi-red')+
    kpi('Operacional',fmt(oper),'',fmtP(tot?oper/tot*100:0),tot?oper/tot*100:0,'#d97706','kpi-amber')+
    kpi('Mecânico',fmt(mec),'',fmtP(tot?mec/tot*100:0),tot?mec/tot*100:0,'#2563eb','kpi-blue')+
    kpi('Elétrico',fmt(ele),'',fmtP(tot?ele/tot*100:0),tot?ele/tot*100:0,'#dc2626','kpi-red')+
    kpi('Horas Irrigadas (total)',fmt(D.hor_stats.total_horas,0),'h','Fato_Horimetro',null,null,'kpi-sky')+
    kpi('Horas Paradas (total)',fmt(D.itv_stats.horas_total,0),'h','intervalo de tempo',null,null,'kpi-gray');

  document.getElementById('irrig-pxe').innerHTML=barH([
    {l:'Realizado',v:feito,c:'#16a34a'},{l:'Operacional',v:oper,c:'#d97706'},
    {l:'Mecânico',v:mec,c:'#2563eb'},{l:'Elétrico',v:ele,c:'#dc2626'}].filter(r=>r.v>0),90);

  document.getElementById('irrig-donut').innerHTML=donut([
    {l:'Realizado',v:feito,c:'#16a34a'},{l:'Operacional',v:oper,c:'#d97706'},
    {l:'Mecânico',v:mec,c:'#2563eb'},{l:'Elétrico',v:ele,c:'#dc2626'}].filter(s=>s.v>0),fmtP(ass),'Assert.',100);

  const tl=D.irrig_timeline.slice(-18);
  document.getElementById('irrig-ev').innerHTML=lineChart([
    {lbl:'Realizado',pts:tl.map(r=>({x:r[0].slice(2),y:r[1]})),c:'#16a34a'},
    {lbl:'Paradas',pts:tl.map(r=>({x:r[0].slice(2),y:r[2]+r[3]+r[4]})),c:'#ef4444'}],130);

  document.getElementById('irrig-caus').innerHTML=barH(D.irrig_causas.slice(0,10).map(c=>({l:c.c,v:c.h,c:c.t==='Mecânico'?'#2563eb':c.t==='Elétrico'?'#dc2626':'#d97706',dec:1})),155);

  const hm=D.hor_meses||[]; document.getElementById('irrig-hor-mes').innerHTML=lineChart([{lbl:'Horas',pts:hm.slice(-15).map(r=>({x:r[0].slice(2),y:r[1]})),c:'var(--brand-600)'}],120);

  document.getElementById('irrig-piv-par').innerHTML=barH(D.irrig_pivos_paradas.slice(0,10).map(p=>({l:'P.'+p.pivo,v:p.horas,c:'#d97706',dec:1})),45);

  const pvs=D.irrig_pivos.slice(0,20);
  document.getElementById('irrig-rk-cnt').textContent=D.irrig_pivos.length+' pivôs';
  document.getElementById('irrig-rk').innerHTML=pvs.length?`<table class="table"><thead><tr><th>Pivô</th><th>Fazenda</th><th style="text-align:right">Total</th><th style="text-align:right">Feito</th><th style="text-align:right">Oper.</th><th style="text-align:right">Mec.</th><th style="text-align:right">Elét.</th><th style="text-align:right">Assertividade</th><th>Status</th></tr></thead><tbody>${pvs.map(p=>`<tr><td><span class="badge b-brand">P.${p.pivo}</span></td><td><span class="badge b-neutral">${p.fazenda}</span></td><td style="text-align:right;font-weight:600">${fmt(p.feito+p.oper+p.mec+p.ele)}</td><td style="text-align:right;color:#16a34a;font-weight:700">${fmt(p.feito)}</td><td style="text-align:right;color:#d97706">${fmt(p.oper)}</td><td style="text-align:right;color:#2563eb">${fmt(p.mec)}</td><td style="text-align:right;color:#dc2626">${fmt(p.ele)}</td><td style="text-align:right"><strong style="color:${p.ass>=80?'#16a34a':p.ass>=60?'#d97706':'#dc2626'}">${fmtP(p.ass)}</strong></td><td><span class="badge ${p.ass>=80?'b-success':p.ass>=60?'b-warning':'b-danger'}">${p.ass>=80?'OK':p.ass>=60?'Atenção':'Crítico'}</span></td></tr>`).join('')}</tbody></table>`:emEl();
}

/* Fertirrigação operacional — só chama js/services/fertirrigacao.js. */
function renderFertiOperacional(){
  const ativos=fertiAtivos();
  const hoje=today();
  document.getElementById('fto-kpis').innerHTML=
    kpi('Aplicações Hoje',fertiConsultar({dataInicio:hoje,dataFim:hoje}).length,'','',null,null,'kpi-purple')+
    kpi('Aplicações na Semana',(()=>{const {inicio,fim}=semanaAtual();return fertiConsultar({dataInicio:inicio,dataFim:fim}).length;})(),'','',null,null,'kpi-teal')+
    kpi('Aplicações no Mês',fertiConsultar({dataInicio:hoje.slice(0,7)+'-01',dataFim:hoje}).length,'','',null,null,'kpi-teal')+
    kpi('Quantidade Aplicada (mês)',fmt(calcAcumulado(fertiConsultar({dataInicio:hoje.slice(0,7)+'-01',dataFim:hoje}),'quantidadeAplicada'),1),'','',null,null,'kpi-sky')+
    kpi('Média por Aplicação',ativos.length?fmt(calcAcumulado(ativos,'quantidadeAplicada')/ativos.length,2):'—','','',null,null,'kpi-gray');

  document.getElementById('fto-produtos').innerHTML=barH(fertiProdutosMaisUtilizados(ativos).slice(0,8).map(r=>({l:r.produto,v:r.quantidade,c:'#7c3aed',dec:1})),110);
  document.getElementById('fto-pivo').innerHTML=barH(fertiPorPivoResumo(ativos).slice(0,10).map(r=>({l:r.pivo,v:r.quantidade,c:'var(--brand-600)',dec:1})),50);
  document.getElementById('fto-fazenda').innerHTML=barH(fertiPorFazendaResumo(ativos).map(r=>({l:r.fazenda,v:r.quantidade,c:'#2563eb',dec:1})),90);
  document.getElementById('fto-cultura').innerHTML=barH(fertiPorCultura(ativos).slice(0,10).map(r=>({l:r.cultura,v:r.quantidade,c:'#16a34a',dec:1})),100);
  document.getElementById('fto-safra').innerHTML=barH(fertiPorSafraResumo(ativos).map(r=>({l:r.safra,v:r.quantidade,c:'#d97706',dec:1})),110);
  document.getElementById('fto-operador').innerHTML=barH(fertiPorOperador(ativos).slice(0,8).map(r=>({l:r.operador,v:r.quantidade,c:'#0284c7',dec:1})),95);

  const porMes=agruparPorMes(ativos,'quantidadeAplicada').slice(-12);
  document.getElementById('fto-evolucao').innerHTML=lineChart([{lbl:'Quantidade Aplicada',pts:porMes.map(m=>({x:m.mes.slice(2),y:m.horas})),c:'#7c3aed'}],130);
}

/* ── FERTI ──────────────────────────────────────────────────────── */
let fertiPage=0;
function renderFerti(){
  renderFertiOperacional();
  const fd=fFERTI();
  const real=fd.filter(r=>r.motivo==='Realizado').length;
  const tot=fd.length, ass=tot>0?real/tot*100:0;
  const M2={Realizado:0,Operacional:0,Logística:0,Mecânico:0,Elétrico:0,Cancelado:0};
  fd.forEach(r=>{if(M2[r.motivo]!==undefined)M2[r.motivo]++;});

  document.getElementById('ferti-kpis').innerHTML=
    kpi('Total',fmt(tot),'','registros',null,null,'kpi-teal')+
    kpi('Realizado',fmt(real),'',fmtP(ass),ass,'#16a34a','kpi-green')+
    kpi('Assertividade',fmtP(ass),'','',ass,'#16a34a',ass>=80?'kpi-green':ass>=60?'kpi-amber':'kpi-red')+
    kpi('Operacional',M2.Operacional,'',fmtP(tot?M2.Operacional/tot*100:0),null,null,'kpi-amber')+
    kpi('Logística',M2.Logística,'',fmtP(tot?M2.Logística/tot*100:0),null,null,'kpi-purple')+
    kpi('Mecânico',M2.Mecânico,'','',null,null,'kpi-blue')+
    kpi('Elétrico',M2.Elétrico,'','',null,null,'kpi-red')+
    kpi('Cancelado',M2.Cancelado,'','',null,null,'kpi-gray');

  const fm=D.ferti_meses||[];
  document.getElementById('ferti-ev').innerHTML=lineChart([
    {lbl:'Realizado',pts:fm.slice(-15).map(r=>({x:r[0].slice(2),y:r[1]})),c:'#16a34a'},
    {lbl:'Paradas',pts:fm.slice(-15).map(r=>({x:r[0].slice(2),y:r[2]+r[3]+r[4]+r[5]+r[6]})),c:'#ef4444'}],130);

  document.getElementById('ferti-donut').innerHTML=donut([
    {l:'Realizado',v:M2.Realizado,c:'#16a34a'},{l:'Operacional',v:M2.Operacional,c:'#d97706'},
    {l:'Logística',v:M2.Logística,c:'#7c3aed'},{l:'Mecânico',v:M2.Mecânico,c:'#2563eb'},
    {l:'Elétrico',v:M2.Elétrico,c:'#dc2626'},{l:'Cancelado',v:M2.Cancelado,c:'#94a3b8'}
  ].filter(s=>s.v>0),fmtP(ass),'Assert.',108);

  const TC={}; fd.filter(r=>r.motivo!=='Realizado').forEach(r=>{const k=r.status||'N/A';TC[k]=(TC[k]||0)+1;});
  document.getElementById('ferti-caus').innerHTML=barH(Object.entries(TC).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([l,v2])=>({l,v:v2,c:'#dc2626'})),155);

  const CC={}; fd.filter(r=>r.motivo==='Realizado').forEach(r=>{CC[r.cultura]=(CC[r.cultura]||0)+1;});
  document.getElementById('ferti-cult').innerHTML=barH(Object.entries(CC).sort((a,b)=>b[1]-a[1]).map(([l,v2])=>({l,v:v2,c:'#7c3aed'})),100);

  document.getElementById('ferti-tbl-cnt').textContent=fd.length.toLocaleString('pt-BR')+' registros';
  fertiPage=0; rFertiTbl();
}
function rFertiTbl(){
  const q=(v('ferti-q')||'').toLowerCase();
  const fd=fFERTI().filter(r=>!q||(String(r.pivo||'').includes(q)||(r.cultura||'').toLowerCase().includes(q)||(r.aplicacao||'').toLowerCase().includes(q)||(r.status||'').toLowerCase().includes(q)));
  document.getElementById('ferti-tbl-cnt').textContent=fd.length.toLocaleString('pt-BR')+' registros';
  const s=fd.slice(fertiPage*50,(fertiPage+1)*50);
  const MC={Realizado:'b-success',Operacional:'b-warning',Logística:'b-purple',Mecânico:'b-info',Elétrico:'b-danger',Cancelado:'b-neutral'};
  document.getElementById('ferti-tbl').innerHTML=s.length?`<table class="table"><thead><tr><th>Data</th><th>Pivô</th><th>Cultura</th><th>Aplicação</th><th>Motivo</th><th>Status</th></tr></thead><tbody>${s.map(r=>`<tr><td style="white-space:nowrap">${fmtD(r.data)}</td><td><span class="badge b-brand">P.${r.pivo}</span></td><td><span class="badge b-success">${r.cultura}</span></td><td style="font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.aplicacao||'—'}</td><td><span class="badge ${MC[r.motivo]||'b-neutral'}">${r.motivo||'—'}</span></td><td style="font-size:11px;color:var(--text-tertiary)">${r.status||'—'}</td></tr>`).join('')}</tbody></table>`:emEl();
  pag('ferti-pg',fd.length,fertiPage,p=>{fertiPage=p;rFertiTbl();});
}

/* ── ITV ────────────────────────────────────────────────────────── */
function renderItv(){
  const itv=fITV();
  const tot=itv.length, totH=itv.reduce((a,r)=>a+(r[4]||0),0);
  const operN=itv.filter(r=>r[3]==='Operacional').length, mecN=itv.filter(r=>r[3]==='Mecânico').length, eleN=itv.filter(r=>r[3]==='Elétrico').length;
  const operH=itv.filter(r=>r[3]==='Operacional').reduce((a,r)=>a+(r[4]||0),0);
  const mecH=itv.filter(r=>r[3]==='Mecânico').reduce((a,r)=>a+(r[4]||0),0);
  const eleH=itv.filter(r=>r[3]==='Elétrico').reduce((a,r)=>a+(r[4]||0),0);

  document.getElementById('itv-kpis').innerHTML=
    kpi('Total Paradas',fmt(tot),'','ocorrências',null,null,'kpi-red')+
    kpi('Total Horas',fmt(totH,1),'h','',null,null,'kpi-amber')+
    kpi('Média h/Parada',fmt(tot>0?totH/tot:0,2),'h','MTTR',null,null,'kpi-blue')+
    kpi('Operacional',fmt(operN),'',fmtP(tot?operN/tot*100:0),tot?operN/tot*100:0,'#d97706','kpi-amber')+
    kpi('Mecânico',fmt(mecN),'',fmtP(tot?mecN/tot*100:0),tot?mecN/tot*100:0,'#2563eb','kpi-blue')+
    kpi('Elétrico',fmt(eleN),'',fmtP(tot?eleN/tot*100:0),tot?eleN/tot*100:0,'#dc2626','kpi-red');

  document.getElementById('itv-tipo').innerHTML=barH([{l:'Operacional',v:operH,c:'#d97706',dec:1},{l:'Mecânico',v:mecH,c:'#2563eb',dec:1},{l:'Elétrico',v:eleH,c:'#dc2626',dec:1}].filter(r=>r.v>0),90);

  // Pareto
  const cH2={};itv.forEach(r=>{const c=(r[2]||'N/A').split('/')[0].trim();cH2[c]=(cH2[c]||0)+(r[4]||0);});
  const sorted=Object.entries(cH2).sort((a,b)=>b[1]-a[1]).slice(0,12);
  let cum=0;const ptot=sorted.reduce((a,[,h])=>a+h,0);
  document.getElementById('itv-pareto').innerHTML=sorted.map(([l,h])=>{cum+=h;return`<div class="bar-h"><div class="bar-h-label" style="width:155px;font-size:10.5px" title="${l}">${l}</div><div class="bar-h-track"><div class="bar-h-fill" style="width:${(h/Math.max(sorted[0][1],1)*100).toFixed(0)}%;background:var(--brand-600)"></div></div><div class="bar-h-val" style="color:var(--brand-600)">${fmt(h,1)}</div><div style="font-size:9.5px;color:#dc2626;font-weight:700;width:36px;text-align:right">${fmtP(cum/ptot*100,0)}</div></div>`;}).join('')||emEl();

  // Por pivô
  const pvH2={};itv.forEach(r=>{pvH2[r[1]]=(pvH2[r[1]]||0)+(r[4]||0);});
  document.getElementById('itv-pivo').innerHTML=barH(Object.entries(pvH2).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([p,h])=>({l:'P.'+p,v:h,c:'#d97706',dec:1})),45);

  // Evolução mensal
  const mP2={};itv.forEach(r=>{const m=mes(r[0]);if(m){if(!mP2[m])mP2[m]={oper:0,mec:0,ele:0};if(r[3]==='Operacional')mP2[m].oper++;else if(r[3]==='Mecânico')mP2[m].mec++;else if(r[3]==='Elétrico')mP2[m].ele++;}});
  const mArr2=Object.entries(mP2).sort().slice(-15);
  document.getElementById('itv-ev').innerHTML=lineChart([
    {lbl:'Oper.',pts:mArr2.map(([m,v2])=>({x:m.slice(2),y:v2.oper})),c:'#d97706'},
    {lbl:'Mec.',pts:mArr2.map(([m,v2])=>({x:m.slice(2),y:v2.mec})),c:'#2563eb'},
    {lbl:'Ele.',pts:mArr2.map(([m,v2])=>({x:m.slice(2),y:v2.ele})),c:'#dc2626'}],120);

  // Heatmap
  const hmPvs=D.irrig_heatmap_pivos.slice(0,12);
  const hmMes=D.irrig_heatmap_meses.slice(-12);
  const hmMap={};D.irrig_heatmap.forEach(r=>{hmPvs.forEach(p=>{hmMap[`${r.m}_${p}`]=r[String(p)]||0;});});
  const hmMax=Math.max(...Object.values(hmMap),1);
  const hmC=v2=>{if(!v2)return'var(--bg-surface3)';const i=v2/hmMax;if(i<.2)return'#bbf7d0';if(i<.4)return'#4ade80';if(i<.6)return'#fde047';if(i<.8)return'#fb923c';return'#ef4444';};
  let hh=`<div class="hm-wrap"><table class="hm-table"><thead><tr><th class="hm-th">Pivô</th>${hmMes.map(m=>`<th class="hm-th">${m.slice(2)}</th>`).join('')}</tr></thead><tbody>`;
  hmPvs.forEach(p=>{hh+=`<tr><td class="hm-th" style="text-align:right">P.${p}</td>${hmMes.map(m=>{const v2=hmMap[`${m}_${p}`]||0;return`<td class="hm-cell" style="background:${hmC(v2)};color:${v2?'#0f172a':'transparent'}">${v2||''}</td>`;}).join('')}</tr>`;});
  hh+='</tbody></table></div>';
  document.getElementById('itv-heatmap').innerHTML=hh;
}

/* ── HOR ────────────────────────────────────────────────────────── */
/* Widget "Lançamentos Locais": única ponte entre o serviço de Horímetro
   (js/services/horimetro.js, dados novos em localStorage) e este dashboard
   (que por padrão mostra a base ETL consolidada em D/HOR_D). Não recalcula
   nada — só chama o serviço. */
function renderHorLocal(){
  const el=document.getElementById('hor-local-body');
  if(!el) return;
  const ativos=typeof horimetroAtivos==='function'?horimetroAtivos():[];
  if(!ativos.length){ el.innerHTML=emEl('Nenhum lançamento local ainda — use a tela de Lançamentos.'); return; }
  const acumulado=calcAcumulado(ativos);
  const pivosDistintos=new Set(ativos.map(r=>r.pivoId)).size;
  const ultimo=ativos.slice().sort((a,b)=>a.data.localeCompare(b.data)).pop();
  el.innerHTML=
    kpi('Lançamentos',fmt(ativos.length),'','registros locais',null,null,'kpi-teal')+
    kpi('Horas Lançadas',fmt(acumulado,1),'h','ainda fora do ETL',null,null,'kpi-sky')+
    kpi('Pivôs com Lançamento',pivosDistintos,'','',null,null,'kpi-green')+
    kpi('Último Lançamento',ultimo?fmtD(ultimo.data):'—','','',null,null,'kpi-gray');
}

/* Calibração de Lâmina — só chama js/services/calibracao.js. */
function renderCalibracaoLocal(){
  const ultimas=calibracaoUltimas(5);
  const semCalibracao=calibracaoPivosSemCalibracao();
  const vencidas=calibracaoVencidas();

  document.getElementById('hor-calib-kpis').innerHTML=
    kpi('Total de Calibrações',calibracaoAtivas().length,'','',null,null,'kpi-teal')+
    kpi('Pivôs sem Calibração',semCalibracao.length,'','nunca calibrados neste módulo',null,null,'kpi-amber')+
    kpi('Calibrações Vencidas',vencidas.length,'','estrutura preparada · 180 dias',null,null,'kpi-red');

  document.getElementById('hor-calib-tbl').innerHTML=ultimas.length?`<table class="table"><thead><tr><th>Data</th><th>Pivô</th><th style="text-align:right">Lâmina a 100%</th><th style="text-align:right">Variação</th><th>Método</th></tr></thead><tbody>${ultimas.map(r=>{
    const pivo=horimetroPivoInfo(r.pivoId);
    return `<tr><td>${fmtD(r.data)}</td><td><span class="badge b-brand">P.${pivo?pivo.numero:'?'}</span></td><td style="text-align:right;font-weight:700;color:var(--brand-600)">${fmt(r.laminaCalculada100,2)}</td><td style="text-align:right">${r.percentualVariacao!=null?`${r.percentualVariacao>0?'+':''}${r.percentualVariacao}%`:'—'}</td><td style="font-size:11px">${r.metodoCalibracao}</td></tr>`;
  }).join('')}</tbody></table>`:emEl('Nenhuma calibração registrada ainda.');
}

function renderHor(){
  renderHorLocal();
  renderCalibracaoLocal();
  const hor=fHOR();
  const hs=D.hor_stats;
  const totH=hor.reduce((a,r)=>a+(r[4]||0),0);
  const kH=hor.filter(r=>r[1]==='KARITEL').reduce((a,r)=>a+(r[4]||0),0);
  const rH=hor.filter(r=>r[1]==='RDM').reduce((a,r)=>a+(r[4]||0),0);
  const pAtivos=new Set(hor.map(r=>r[2])).size;

  // ETL Card
  const kN=hs.karitel_n, rN=hs.rdm_n, cN=hs.csv_n||0, totN=hs.total_registros;
  document.getElementById('hor-etl-card').innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.8rem">
      <div style="display:flex;align-items:center;gap:.5rem">
        <div style="width:8px;height:8px;border-radius:50%;background:#34d399;box-shadow:0 0 0 3px rgba(52,211,153,.2)"></div>
        <span style="font-size:12px;font-weight:700;color:rgba(255,255,255,.85)">Fato_Horimetro — Base Consolidada · ETL Online</span>
      </div>
      <span style="font-size:10px;color:rgba(255,255,255,.35)">${totN.toLocaleString('pt-BR')} registros · ${fmt(hs.total_horas,0)}h totais</span>
    </div>
    <div style="display:flex;border-radius:6px;overflow:hidden;height:8px;gap:1px">
      <div style="height:100%;background:#1b9e6e;width:${kN/totN*100}%;min-width:3px" title="KARITEL ${kN.toLocaleString('pt-BR')} reg."></div>
      <div style="height:100%;background:#2563eb;width:${rN/totN*100}%;min-width:3px" title="RDM ${rN.toLocaleString('pt-BR')} reg."></div>
      <div style="height:100%;background:#7c3aed;width:${cN/totN*100}%;min-width:3px" title="CSV ${cN.toLocaleString('pt-BR')} reg."></div>
    </div>
    <div style="display:flex;gap:1.2rem;margin-top:.5rem;font-size:9.5px;color:rgba(255,255,255,.4)">
      <span><span style="color:#34d399">■</span> KARITEL: ${kN.toLocaleString('pt-BR')}</span>
      <span><span style="color:#60a5fa">■</span> RDM: ${rN.toLocaleString('pt-BR')}</span>
      <span><span style="color:#a78bfa">■</span> CSV: ${cN.toLocaleString('pt-BR')}</span>
      ${hs.inconsistentes>0?`<span style="color:#fbbf24">⚠ ${hs.inconsistentes} inconsistências</span>`:'<span style="color:#34d399">✓ Sem inconsistências críticas</span>'}
    </div>`;

  document.getElementById('hor-kpis').innerHTML=
    kpi('Total Horas',fmt(totH,0),'h',hor.length.toLocaleString('pt-BR')+' lançamentos',null,null,'kpi-teal')+
    kpi('KARITEL',fmt(kH,0),'h',fmtP(totH?kH/totH*100:0),totH?kH/totH*100:0,'#1b9e6e','kpi-green')+
    kpi('RDM',fmt(rH,0),'h',fmtP(totH?rH/totH*100:0),totH?rH/totH*100:0,'#2563eb','kpi-blue')+
    kpi('Pivôs Ativos',pAtivos,'','no período',null,null,'kpi-sky')+
    kpi('Culturas',new Set(hor.map(r=>r[3]).filter(Boolean)).size,'','',null,null,'kpi-purple')+
    kpi('Média/Lançamento',fmt(hor.length?totH/hor.length:0,1),'h','',null,null,'kpi-gray');

  const hm2=D.hor_meses||[];
  document.getElementById('hor-ev').innerHTML=lineChart([{lbl:'Horas Irrigadas',pts:hm2.slice(-18).map(r=>({x:r[0].slice(2),y:r[1]})),c:'var(--brand-600)'}],140);
  document.getElementById('hor-donut').innerHTML=donut([{l:'KARITEL',v:kH,c:'#1b9e6e'},{l:'RDM',v:rH,c:'#2563eb'}],fmt(totH,0)+'h','total',108);
  document.getElementById('hor-piv').innerHTML=barH(D.hor_pivos.slice(0,15).map(p=>({l:'P.'+p[0],v:p[2],c:p[1]==='KARITEL'?'var(--brand-600)':'#2563eb',dec:1})),45);
  document.getElementById('hor-cult').innerHTML=barH(D.hor_culturas.map(c=>({l:c[0],v:c[1],c:'#16a34a',dec:1})),100);
  document.getElementById('hor-comp').innerHTML=lineChart([{lbl:'KARITEL',pts:hm2.slice(-15).map(r=>({x:r[0].slice(2),y:r[3]})),c:'var(--brand-600)'},{lbl:'RDM',pts:hm2.slice(-15).map(r=>({x:r[0].slice(2),y:r[4]})),c:'#2563eb'}],130);
  document.getElementById('hor-oper').innerHTML=barH(D.hor_opers.slice(0,10).map(o=>({l:o[0].split(' ')[0],v:o[2],c:'#7c3aed',dec:1})),95);
}

/* Indicadores operacionais/disponibilidade/manutenção calculados a partir
   de dados reais (js/services/indicador.js), não simulados — só chama o
   serviço, nunca recalcula nada aqui. */
function renderFalLocal(){
  const hoje=today();
  const inicioMes=hoje.slice(0,7)+'-01';
  const mtbfGeral=(()=>{ const pivosComFalha=[...new Set(indicadorAtivos().map(r=>r.pivoId))]; const vals=pivosComFalha.map(indicadorMTBF).filter(v=>v!=null); return vals.length?+(vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(1):null; })();
  const mttrGeral=indicadorMTTR();
  const anoAtual=new Date().getFullYear(), safraAtual=`${anoAtual}/${anoAtual+1}`;

  document.getElementById('fal-op-kpis').innerHTML=
    kpi('Horas Hoje',fmt(indicadorHorasHoje(),1),'h','',null,null,'kpi-teal')+
    kpi('Horas na Semana',fmt(indicadorHorasSemana(),1),'h','',null,null,'kpi-sky')+
    kpi('Horas no Mês',fmt(indicadorHorasMes(),1),'h','',null,null,'kpi-green')+
    kpi('Horas na Safra',fmt(indicadorHorasSafra(safraAtual),0),'h',safraAtual,null,null,'kpi-teal')+
    kpi('Disponibilidade',fmtP(indicadorDisponibilidade(inicioMes,hoje)),'','mês atual',indicadorDisponibilidade(inicioMes,hoje),'#16a34a','kpi-green')+
    kpi('Utilização',fmtP(indicadorUtilizacao(inicioMes,hoje)),'','mês atual',indicadorUtilizacao(inicioMes,hoje),'#0284c7','kpi-sky')+
    kpi('Eficiência Operacional',fmtP(indicadorEficiencia(inicioMes,hoje)),'','mês atual',indicadorEficiencia(inicioMes,hoje),'#7c3aed','kpi-purple')+
    kpi('MTBF',mtbfGeral!=null?fmt(mtbfGeral,1):'—',mtbfGeral!=null?'dias':'','entre falhas',null,null,'kpi-amber')+
    kpi('MTTR',mttrGeral!=null?fmt(mttrGeral,1):'—',mttrGeral!=null?'h':'','tempo de reparo',null,null,'kpi-red')+
    kpi('Falhas Registradas',indicadorQuantidadeFalhas(),'','',null,null,'kpi-gray');

  document.getElementById('fal-op-pivo').innerHTML=barH(indicadorHorasPorPivo().slice(0,10).map(r=>({l:r.pivo,v:r.horas,c:'var(--brand-600)',dec:1})),50);
  document.getElementById('fal-op-fazenda').innerHTML=barH(indicadorHorasPorFazenda().map(r=>({l:r.fazenda,v:r.horas,c:'#2563eb',dec:1})),80);
  document.getElementById('fal-op-casabomba').innerHTML=barH(indicadorHorasPorCasaBomba().map(r=>({l:r.casaBomba,v:r.horas,c:'#0284c7',dec:1})),90);

  const evol=indicadorEvolucaoMensal(6);
  document.getElementById('fal-op-evolucao').innerHTML=lineChart([
    {lbl:'Disponibilidade',pts:evol.map(m=>({x:m.mes.slice(2),y:m.disponibilidade})),c:'#16a34a'},
    {lbl:'Utilização',pts:evol.map(m=>({x:m.mes.slice(2),y:m.utilizacao})),c:'#0284c7'},
  ],130);

  const cores={'Elétrico':'#dc2626','Mecânico':'#2563eb','Operacional':'#d97706','Programação/Manejo':'#7c3aed','Chuva':'#0284c7','Energia/Coelba':'#f59e0b'};
  const dist=indicadorDistribuicaoCategoria();
  document.getElementById('fal-op-donut').innerHTML=dist.length
    ?donut(dist.map(d=>({l:d.chave,v:d.valor,c:cores[d.chave]||'#94a3b8'})),indicadorQuantidadeFalhas(),'falhas',108)
    :emEl('Nenhuma falha registrada ainda.');

  document.getElementById('fal-op-operador').innerHTML=barH(indicadorHorasPorOperador().slice(0,10).map(r=>({l:r.operador,v:r.horas,c:'#7c3aed',dec:1})),95);
}

/* Indicadores de Paradas — só chama js/services/parada.js, nunca recalcula. */
function renderParadasLocal(){
  const paradas=paradaAtivas();
  document.getElementById('par-kpis').innerHTML=
    kpi('Paradas Hoje',paradasHoje().length,'','',null,null,'kpi-red')+
    kpi('Paradas na Semana',paradasSemana().length,'','',null,null,'kpi-amber')+
    kpi('Paradas no Mês',paradasMes().length,'','',null,null,'kpi-amber')+
    kpi('Tempo Parado (mês)',fmt(calcAcumulado(paradasMes(),'tempoParadoHoras'),1),'h','',null,null,'kpi-red')+
    kpi('Tempo Médio por Parada',fmt(paradaTempoMedio(paradas),2),'h','',null,null,'kpi-gray');

  const cores={'Elétrico':'#dc2626','Mecânico':'#2563eb','Operacional':'#d97706','Programação/Manejo':'#7c3aed','Chuva':'#0284c7','Energia/Coelba':'#f59e0b'};
  const porCategoria=paradaPorCategoria(paradas);
  document.getElementById('par-categoria').innerHTML=porCategoria.length
    ?donut(porCategoria.map(c=>({l:c.chave,v:c.valor,c:cores[c.chave]||'#94a3b8'})),fmt(calcAcumulado(paradas,'tempoParadoHoras'),0)+'h','total',108)
    :emEl('Nenhuma parada registrada ainda.');

  document.getElementById('par-ranking-falhas').innerHTML=barH(paradaRankingFalhas(paradas).slice(0,8).map(r=>({l:r.motivo,v:r.ocorrencias,c:'#dc2626'})),150);
  document.getElementById('par-ranking-pivos').innerHTML=barH(paradaRankingPivos(paradas).slice(0,8).map(r=>({l:r.pivo,v:r.horas,c:'#d97706',dec:1})),50);

  document.getElementById('par-fazenda').innerHTML=barH(
    agruparPorChave(paradas,r=>{ const p=horimetroPivoInfo(r.pivoId); return p?cadLookupLabel('fazendas',p.fazendaId):null; },r=>r.tempoParadoHoras||0)
      .map(r=>({l:r.chave,v:r.valor,c:'#2563eb',dec:1})),90);

  const evol=paradaEvolucaoMensal().slice(-12);
  document.getElementById('par-evolucao').innerHTML=lineChart([{lbl:'Tempo Parado',pts:evol.map(m=>({x:m.mes.slice(2),y:m.horas})),c:'var(--c-danger)'}],130);
}

/* ── FAL ────────────────────────────────────────────────────────── */
function renderFal(){
  renderFalLocal();
  renderParadasLocal();
  const fl=D.fal_stats;
  document.getElementById('fal-kpis').innerHTML=
    kpi('Falhas Mecânicas',fmt(fl.mec),'',fmtP(fl.mec/fl.total*100),fl.mec/fl.total*100,'#2563eb','kpi-blue')+
    kpi('Falhas Elétricas',fmt(fl.ele),'',fmtP(fl.ele/fl.total*100),fl.ele/fl.total*100,'#dc2626','kpi-red')+
    kpi('Falhas Operacionais',fmt(fl.oper),'',fmtP(fl.oper/fl.total*100),fl.oper/fl.total*100,'#d97706','kpi-amber')+
    kpi('Programação',fmt(fl.prog),'','',null,null,'kpi-purple')+
    kpi('Total Ocorrências',fmt(fl.total),'','',null,null,'kpi-gray');

  const cabF=(arr,c,lw=130)=>{const m2={};arr.forEach(r=>{const k=r[3]||'N/A';m2[k]=(m2[k]||0)+1;});return barH(Object.entries(m2).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([l,v2])=>({l,v:v2,c})),lw);};
  document.getElementById('fal-mec').innerHTML=cabF(FAL_D.filter(r=>r[2]==='Mecânico'),'#2563eb');
  document.getElementById('fal-ele').innerHTML=cabF(FAL_D.filter(r=>r[2]==='Elétrico'),'#dc2626');
  document.getElementById('fal-oper-bars').innerHTML=cabF(FAL_D.filter(r=>r[2]==='Operacional'||r[2]==='operacional'),'#d97706');

  const ev2=D.fal_meses.slice(-15);
  document.getElementById('fal-ev').innerHTML=lineChart([
    {lbl:'Mec.',pts:ev2.map(r=>({x:r[0].slice(2),y:r[1]})),c:'#2563eb'},
    {lbl:'Ele.',pts:ev2.map(r=>({x:r[0].slice(2),y:r[2]})),c:'#dc2626'},
    {lbl:'Oper.',pts:ev2.map(r=>({x:r[0].slice(2),y:r[3]})),c:'#d97706'}],120);

  const det2={};FAL_D.forEach(r=>{const k=r[3]||'N/A';if(!det2[k])det2[k]={n:0,t:r[2]};det2[k].n++;});
  const detArr2=Object.entries(det2).sort((a,b)=>b[1].n-a[1].n).slice(0,15);
  const mc3={Mecânico:'b-info',Elétrico:'b-danger',Operacional:'b-warning',Programação:'b-purple'};
  document.getElementById('fal-det').innerHTML=`<table class="table"><thead><tr><th>Causa</th><th>Categoria</th><th style="text-align:right">Ocorrências</th><th style="text-align:right">% Total</th></tr></thead><tbody>${detArr2.map(([c,v2])=>`<tr><td>${c}</td><td><span class="badge ${mc3[v2.t]||'b-neutral'}">${v2.t}</span></td><td style="text-align:right;font-weight:700">${v2.n}</td><td style="text-align:right;color:var(--text-tertiary)">${fmtP(v2.n/fl.total*100)}</td></tr>`).join('')}</tbody></table>`;
}

/* ── RELAT ──────────────────────────────────────────────────────── */
function renderRelat(){
  document.getElementById('rel-pv').innerHTML=barH(D.hor_pivos.slice(0,15).map(p=>({l:'P.'+p[0],v:p[2],c:'var(--brand-600)',dec:1})),45);
  document.getElementById('rel-cult').innerHTML=barH(D.hor_culturas.map(c=>({l:c[0],v:c[1],c:'#16a34a',dec:1})),100);
  const faz2=D.faz_data||{};
  document.getElementById('rel-faz').innerHTML=`${['KARITEL','RDM'].map(f=>{const fd2=faz2[f]||{};const as2=fd2.ass||0;return`<div style="margin-bottom:1rem"><div style="display:flex;justify-content:space-between;margin-bottom:.4rem"><span style="font-size:13px;font-weight:700">${f}</span><span style="font-size:15px;font-weight:800;color:${as2>=80?'#16a34a':as2>=60?'#d97706':'#dc2626'}">${fmtP(as2)}</span></div><div style="background:var(--bg-surface3);border-radius:4px;height:8px;overflow:hidden"><div style="height:100%;background:${as2>=80?'#16a34a':'#d97706'};width:${as2}%;transition:width .6s ease"></div></div><div style="font-size:10.5px;color:var(--text-tertiary);margin-top:3px">Feito:${fmt(fd2.feito||0)} Oper:${fmt(fd2.oper||0)} Mec:${fmt(fd2.mec||0)}</div></div>`;}).join('')}`;
  const motArr2=[['Realizado',D.ferti_stats.motivos?.Realizado||0,'#16a34a'],['Operacional',D.ferti_stats.motivos?.Operacional||0,'#d97706'],['Logística',D.ferti_stats.motivos?.Logística||0,'#7c3aed'],['Mecânico',D.ferti_stats.motivos?.Mecânico||0,'#2563eb'],['Elétrico',D.ferti_stats.motivos?.Elétrico||0,'#dc2626']];
  document.getElementById('rel-ferti-mot').innerHTML=barH(motArr2.filter(m=>m[1]>0).map(([l,v2,c])=>({l,v:v2,c})),90);

  /* Contagem de cada botão "Exportar Módulos" (Fase 12.0): vinha fixa em
     texto no HTML e ficava desatualizada a cada nova carga do ETL — agora
     lê o mesmo EXPORT_DEFS[mod].data() que o próprio exportMod() usa. */
  ['exe','ferti','itv','hor'].forEach(mod=>{
    const el=document.getElementById('rel-export-cnt-'+mod);
    const def=typeof EXPORT_DEFS!=='undefined'?EXPORT_DEFS[mod]:null;
    if(el&&def) el.textContent=def.data().length.toLocaleString('pt-BR')+' registros';
  });

  renderRelatFavoritos();
  renderRelatHistoricoLancamentos();
  renderRelatHistorico();
}

/* ── PONTO 7 — RELATÓRIO DE HISTÓRICO DE LANÇAMENTOS ─────────────────
   Módulo próprio dentro de Relatórios (fisicamente fora de #page-lanc).
   Consolida Horímetro/Paradas/Planejamento/Calibração usando as MESMAS
   consultas que cada service já expõe (horimetroConsultar/paradaConsultar/
   planejamentoConsultar/calibracaoAtivas) — nenhuma leitura direta de
   storage aqui, nenhum dado duplicado. O filtro "Usuário" busca em
   operador/responsável, o campo que cada tipo já usa para isso. */
function relatHistoricoLancamentosLimpar(){
  ['rel-hist-tipo','rel-hist-pivo','rel-hist-usuario','rel-hist-inicio','rel-hist-fim'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  renderRelatHistoricoLancamentos();
}
function relatHistoricoLancamentosDados(){
  const tipo=v('rel-hist-tipo'), pivoId=v('rel-hist-pivo'),
    usuario=(v('rel-hist-usuario')||'').toLowerCase().trim(),
    dataInicio=v('rel-hist-inicio')||undefined, dataFim=v('rel-hist-fim')||undefined;
  const filtros={dataInicio,dataFim,pivoId:pivoId||undefined};

  let itens=[];
  if(!tipo||tipo==='Horímetro'){
    itens.push(...horimetroConsultar(filtros).map(r=>({tipo:'Horímetro',pivoId:r.pivoId,data:r.data,usuario:r.operador,
      status:'Feito',detalhe:`${fmt(r.horimetroInicial,1)}→${fmt(r.horimetroFinal,1)} (${fmt(r.horas,1)}h)`})));
  }
  if(!tipo||tipo==='Parada'){
    itens.push(...paradaConsultar(filtros).map(r=>({tipo:'Parada',pivoId:r.pivoId,data:r.data,usuario:r.operador,
      status:'Registrada',detalhe:`${r.horaInicial}–${r.horaFinal} (${fmt(r.tempoParadoHoras,1)}h)`})));
  }
  if(!tipo||tipo==='Planejamento'){
    itens.push(...planejamentoConsultar(filtros).map(r=>({tipo:'Planejamento',pivoId:r.pivoId,data:r.data,usuario:'',
      status:planejamentoStatusExecucao(r),detalhe:`${r.percentual}%${r.naoFeito?' — '+(r.motivoNaoFeito||'—'):''}`})));
  }
  if(!tipo||tipo==='Calibração'){
    itens.push(...calibracaoAtivas()
      .filter(r=>(!pivoId||r.pivoId===pivoId)&&(!dataInicio||r.data>=dataInicio)&&(!dataFim||r.data<=dataFim))
      .map(r=>({tipo:'Calibração',pivoId:r.pivoId,data:r.data,usuario:r.operador,
        status:'Registrada',detalhe:`${r.laminaAnterior??'—'} → ${fmt(r.laminaCalculada100,2)} mm`})));
  }
  if(usuario) itens=itens.filter(i=>(i.usuario||'').toLowerCase().includes(usuario));
  return itens.sort((a,b)=>b.data.localeCompare(a.data));
}
function renderRelatHistoricoLancamentos(){
  const tbl=document.getElementById('rel-hist-lanc-tbl'); if(!tbl) return;
  const pivoSel=document.getElementById('rel-hist-pivo');
  if(pivoSel&&!pivoSel.dataset.built){
    pivoSel.innerHTML='<option value="">Pivô</option>'+pivoOptionsAgrupados((cadAll('pivos')||[]).sort((a,b)=>a.numero-b.numero));
    pivoSel.dataset.built='1';
  }
  const itens=relatHistoricoLancamentosDados();
  const cnt=document.getElementById('rel-hist-lanc-cnt');
  if(cnt) cnt.textContent=itens.length.toLocaleString('pt-BR')+' registros';

  const STATUS_BADGE={'Feito':'b-success','Registrada':'b-info','pendente':'b-warning','nao_feito':'b-danger','feito':'b-success'};
  tbl.innerHTML=itens.length?`<table class="table"><thead><tr><th>Tipo</th><th>Data</th><th>Pivô</th><th>Usuário</th><th>Status</th><th>Detalhe</th></tr></thead><tbody>${itens.slice(0,300).map(i=>{
    const p=horimetroPivoInfo(i.pivoId);
    return `<tr><td>${i.tipo}</td><td>${fmtD(i.data)}</td><td><span class="badge b-brand">P.${p?p.numero:'?'}</span></td><td>${i.usuario||'—'}</td><td><span class="badge ${STATUS_BADGE[i.status]||'b-neutral'}">${i.status}</span></td><td style="font-size:11px;color:var(--text-secondary)">${i.detalhe}</td></tr>`;
  }).join('')}</tbody></table>`:emEl('Nenhum registro para os filtros escolhidos.');

  /* Ponto 10 — donut por tipo, derivado da MESMA lista `itens` da tabela
     ao lado (nenhuma segunda consulta para o gráfico). */
  const donutBox=document.getElementById('rel-hist-lanc-donut');
  if(donutBox){
    const porTipo={};
    itens.forEach(i=>{ porTipo[i.tipo]=(porTipo[i.tipo]||0)+1; });
    const CORES_TIPO={'Horímetro':'#0284c7','Parada':'#dc2626','Planejamento':'#d97706','Calibração':'#7c3aed'};
    donutBox.innerHTML=itens.length
      ? donut(Object.keys(porTipo).map(t=>({v:porTipo[t],c:CORES_TIPO[t]||'#64748b',l:t})),itens.length,'registros',130)
      : '';
  }
}

/* Favoritos (Fase 12.1) — reaproveita a mesma estrela de favoritos da
   sidebar (js/nav.js: sbFavoritos/sbToggleFavorito, Fase 10.0), sem
   nenhum mecanismo novo: só lista aqui os módulos que o usuário já
   marcou em qualquer lugar do sistema. */
function renderRelatFavoritos(){
  const box=document.getElementById('rel-favoritos'); if(!box) return;
  const favs=(typeof sbFavoritos==='function'?sbFavoritos():[])
    .map(k=>SB_MODULES.find(m=>m.key===k)).filter(Boolean);
  box.innerHTML=favs.length?favs.map(m=>
    `<button class="btn btn-ghost btn-xs" onclick="sbNavigate('${m.key}')"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" stroke="none" style="margin-right:4px;vertical-align:-1px">${SB_ICON.star}</svg>${m.label}</button>`
  ).join(''):emEl('Nenhum módulo favoritado ainda — use a estrela ao lado de qualquer item da sidebar.');
}

/* Histórico + Recentes de exportações/importações (Fase 12.0/12.1) —
   junta dois logs reais que já existem, cada um só na fonte onde já
   era gravado: exportações vêm de js/services/auditoria.js (exportMod,
   Fase 10.2), importações vêm do log mais antigo js/audit.js (auditLog,
   já usado por js/services/importacao.js desde antes desta fase).
   Nenhum dos dois serviços foi alterado — só a leitura combinada aqui,
   uma vez, reaproveitada tanto pelo card "Recentes" (top 5) quanto pela
   tabela completa de "Histórico". */
function relatEventosCombinados(){
  const exportacoes=(typeof auditoriaTodos==='function'?auditoriaTodos():[])
    .filter(r=>r.acao==='EXPORTAÇÃO')
    .map(r=>({ordKey:r.dataHora,quando:new Date(r.dataHora).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}),acao:'Exportação',item:r.registro,detalhe:r.descricao}));
  const importacoes=(typeof auditAll==='function'?auditAll():[])
    .filter(a=>a.tela==='Importação de Planejamento')
    .map(a=>({ordKey:a.data+' '+a.hora,quando:fmtD(a.data)+' '+a.hora,acao:'Importação',item:'Planejamento de Irrigação',detalhe:a.detalhe}));
  return [...exportacoes,...importacoes].sort((a,b)=>String(b.ordKey).localeCompare(String(a.ordKey)));
}
function renderRelatRecentes(){
  const box=document.getElementById('rel-recentes'); if(!box) return;
  const recentes=relatEventosCombinados().slice(0,5);
  box.innerHTML=recentes.length?recentes.map(r=>
    `<div class="exec2-list-row"><div class="exec2-list-main"><div class="exec2-list-title">${r.acao} · ${r.item}</div><div class="exec2-list-sub">${r.detalhe||'—'}</div></div><div class="exec2-list-time">${r.quando}</div></div>`
  ).join(''):'<div class="exec2-empty">Nenhuma atividade recente.</div>';
}
function renderRelatHistorico(){
  const tbl=document.getElementById('rel-historico-tbl'); if(!tbl) return;
  renderRelatRecentes();
  const eventos=relatEventosCombinados();
  const cnt=document.getElementById('rel-historico-cnt');
  if(cnt) cnt.textContent=eventos.length.toLocaleString('pt-BR')+' evento(s)';
  tbl.innerHTML=eventos.length?`<table class="table"><thead><tr><th>Data/Hora</th><th>Ação</th><th>Arquivo/Módulo</th><th>Descrição</th></tr></thead><tbody>${eventos.slice(0,50).map(r=>`
    <tr>
      <td style="font-size:11px;white-space:nowrap">${r.quando}</td>
      <td><span class="badge ${r.acao==='Exportação'?'b-neutral':'b-info'}">${r.acao}</span></td>
      <td style="font-size:11px">${r.item}</td>
      <td style="font-size:11px;color:var(--text-secondary)">${r.detalhe||'—'}</td>
    </tr>`).join('')}</tbody></table>`:emEl('Nenhuma exportação ou importação registrada ainda.');
}

/* ── CAD ────────────────────────────────────────────────────────── */
/* CRUD completo (pivôs, casas de bomba, bombas, motores, painéis,
   sensores, operadores, técnicos, fazendas, setores, culturas) migrou
   para js/cadastro.js (renderCad/CAD_ENTITIES) no Módulo 3. */

/* ── CFG ────────────────────────────────────────────────────────── */
/* Status real por fonte (Fase 13.0): antes todo item mostrava 'si-ok'
   fixo, sem checar nada — um indicador que nunca podia informar um
   problema real não informa nada. Agora ETL usa DATA_SOURCE (a mesma
   flag que já existe em js/data-loader.js e decide o toast de
   carregamento) e local usa a própria contagem — sem cálculo novo,
   só reaproveitando o que os dois já sabem. */
function renderCfg(){
  const hs=D.hor_stats, is2=D.itv_stats, fs2=D.ferti_stats;
  const etlOk=DATA_SOURCE==='remoto';
  const linhas=[
    ['Fato_Horimetro (ETL)',hs.total_registros.toLocaleString('pt-BR')+' registros · '+fmt(hs.total_horas,0)+'h',etlOk],
    ['Irrigação Executado (ETL)',EXE_D.length.toLocaleString('pt-BR')+' registros',etlOk],
    ['Intervalo Paradas (ETL)',is2.total.toLocaleString('pt-BR')+' registros · '+fmt(is2.horas_total,0)+'h',etlOk],
    ['Fertirrigação (ETL)',fs2.total.toLocaleString('pt-BR')+' registros · '+fmtP(fs2.ass)+' assertividade',etlOk],
    ['Indicadores/Falhas (ETL)',FAL_D.length.toLocaleString('pt-BR')+' registros',etlOk],
    ['Horímetro (local)',horimetroAtivos().length.toLocaleString('pt-BR')+' lançamentos',horimetroAtivos().length>0],
    ['Paradas (local)',paradaAtivas().length.toLocaleString('pt-BR')+' registros',paradaAtivas().length>0],
    ['Fertirrigação (local)',fertiAtivos().length.toLocaleString('pt-BR')+' registros',fertiAtivos().length>0],
    ['Indicadores/Falhas (local)',indicadorAtivos().length.toLocaleString('pt-BR')+' ocorrências',indicadorAtivos().length>0],
    ['Planejamento (local)',planejamentoAtivos().length.toLocaleString('pt-BR')+' registros',planejamentoAtivos().length>0],
    ['Calibrações de Lâmina (local)',calibracaoAtivas().length.toLocaleString('pt-BR')+' registros',calibracaoAtivas().length>0],
    ['Auditoria',auditAll().length.toLocaleString('pt-BR')+' eventos',auditAll().length>0],
  ];
  document.getElementById('cfg-status').innerHTML=`
    <div style="display:flex;flex-direction:column;gap:.7rem">
      ${linhas.map(([n,d,ok])=>`<div style="display:flex;align-items:center;gap:.65rem;padding:.5rem .75rem;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-surface2)"><div class="status-indicator ${ok?'si-ok':'si-gray'}" title="${ok?'Dados disponíveis':'Sem dados ainda'}"></div><div><div style="font-size:12.5px;font-weight:600;color:var(--text-primary)">${n}</div><div style="font-size:10.5px;color:var(--text-secondary)">${d}</div></div></div>`).join('')}
    </div>`;
}
