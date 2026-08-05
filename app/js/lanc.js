/* ── LANÇAMENTOS DE HORÍMETRO (tela) ───────────────────────────────
   Só interface: monta os campos e o histórico, e delega todo cálculo,
   validação e persistência para js/services/horimetro.js. Esta tela
   nunca lê/grava localStorage diretamente.
   ──────────────────────────────────────────────────────────────── */

/* Botões de Editar/Excluir das 5 tabelas de lançamento (Fase 10.2) —
   só aparecem quando o perfil do usuário permite (services/permissoes.js).
   A ação em si também é bloqueada dentro de salvar()/excluir(), então
   esconder o botão é reforço de UX, não a única barreira. */
function lancAcoesHtml(ctrl,grupoId){
  const podeEditar=canEdit('lancamentos'), podeExcluir=canDelete('lancamentos');
  if(!podeEditar&&!podeExcluir) return '<span style="font-size:10px;color:var(--text-tertiary)">Somente leitura</span>';
  return `${podeEditar?`<button class="btn btn-ghost btn-xs" onclick="${ctrl}.editar('${grupoId}')">Editar</button> `:''}${podeExcluir?`<button class="btn btn-danger btn-xs" onclick="${ctrl}.excluir('${grupoId}',this)">Excluir</button>`:''}`;
}

const lhm={
  editandoGrupoId:null,
  pagina:0,
  _histSelectsBuilt:false,

  /* ── NAVEGAÇÃO ENTRE ABAS ─────────────────────────────────────── */
  tabNav(id){
    ['lanc','falha','parada','ferti','calibracao','historico','auditoria'].forEach(k=>{
      const panel=document.getElementById('lhm-panel-'+k);
      if(panel) panel.style.display=(k===id)?'':'none';
      const tabBtn=document.getElementById('lhm-tab-'+k);
      if(tabBtn) tabBtn.classList.toggle('active',k===id);
    });
    if(id==='falha') lhf.render();
    if(id==='parada') lp.render();
    if(id==='ferti') lft.render();
    if(id==='calibracao') lc.render();
    if(id==='historico') this.renderHist();
    if(id==='auditoria'&&typeof renderAudit==='function') renderAudit();
  },

  novo(){ this.tabNav('lanc'); this.limpar(); },
  cancelar(){ this.limpar(); toast('Lançamento cancelado.','info'); },

  /* ── FORMULÁRIO: RESET COMPLETO ───────────────────────────────── */
  limpar(){
    this.editandoGrupoId=null;
    ['lhm-faz','lhm-pivo','lhm-cult','lhm-safra','lhm-oper','lhm-h1','lhm-h2','lhm-hora','lhm-pct','lhm-lam','lhm-pres','lhm-hoc','lhm-obs']
      .forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('lhm-area').value='COMPLETO';
    document.getElementById('lhm-data').value=today();

    const pivoSel=document.getElementById('lhm-pivo');
    pivoSel.innerHTML='<option value="">Selecione a fazenda</option>'; pivoSel.disabled=true;
    const cultSel=document.getElementById('lhm-cult');
    cultSel.innerHTML='<option value="">Selecione o pivô</option>'; cultSel.disabled=true;
    const safraSel=document.getElementById('lhm-safra');
    safraSel.innerHTML='<option value="">Selecione</option>'; safraSel.disabled=true;

    const sec2=document.getElementById('lhm-sec2');
    sec2.style.opacity='.5'; sec2.style.pointerEvents='none';

    const h1=document.getElementById('lhm-h1');
    h1.readOnly=false;
    document.getElementById('lhm-h1-unlock').style.display='none';
    document.getElementById('lhm-h1-autolbl').textContent='';
    ['lhm-h1-hint','lhm-h2-err','lhm-data-err','lhm-pct-err'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=''; });

    document.getElementById('lhm-horas-display').textContent='—';
    const badge=document.getElementById('lhm-horas-badge');
    badge.textContent='Informe os horímetros'; badge.className='badge b-neutral';
    document.getElementById('lhm-pct-bar-wrap').style.display='none';

    const equipBadge=document.getElementById('lhm-equip-badge');
    equipBadge.textContent='Aguardando'; equipBadge.className='badge b-neutral';
    document.getElementById('lhm-equip-panel').innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;gap:.5rem;padding:.5rem;color:var(--text-tertiary)"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--border-strong)" stroke-width="1"><path d="M12 22V12"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><circle cx="12" cy="5" r="3"/></svg><span style="font-size:12px">Selecione o pivô</span></div>`;
    document.getElementById('lhm-lam-card').style.display='none';
    document.getElementById('lhm-resumo-card').style.display='none';
    document.getElementById('lhm-footer-msg').textContent='Preencha Fazenda e Pivô para ativar o preenchimento automático';
    document.getElementById('lhm-salvar-lbl').textContent='Salvar Lançamento';
  },

  /* ── CASCATA FAZENDA → PIVÔ ───────────────────────────────────── */
  onFaz(){
    const faz=v('lhm-faz');
    const pivoSel=document.getElementById('lhm-pivo');
    const cultSel=document.getElementById('lhm-cult');
    const safraSel=document.getElementById('lhm-safra');
    const sec2=document.getElementById('lhm-sec2');

    cultSel.innerHTML='<option value="">Selecione o pivô</option>'; cultSel.disabled=true;
    safraSel.innerHTML='<option value="">Selecione</option>'; safraSel.disabled=true;
    sec2.style.opacity='.5'; sec2.style.pointerEvents='none';

    if(!faz){ pivoSel.innerHTML='<option value="">Selecione a fazenda</option>'; pivoSel.disabled=true; return; }

    const fazRec=(cadAll('fazendas')||[]).find(f=>f.nome===faz);
    const pivos=(cadAll('pivos')||[]).filter(p=>p.fazendaId===(fazRec&&fazRec.id)).sort((a,b)=>a.numero-b.numero);
    pivoSel.innerHTML='<option value="">Selecione...</option>'+pivos.map(p=>`<option value="${p.id}">P.${p.numero}</option>`).join('');
    pivoSel.disabled=false;
  },

  /* ── SELEÇÃO DO PIVÔ: ATIVA SEÇÃO 2 E PREENCHE AUTOMÁTICO ─────── */
  onPivo(){
    const pivoId=v('lhm-pivo');
    if(!pivoId) return;
    const pivo=horimetroPivoInfo(pivoId);

    const culturas=(cadAll('culturas')||[]).map(c=>c.nome).sort();
    const cultSel=document.getElementById('lhm-cult');
    cultSel.innerHTML='<option value="">Selecione...</option>'+culturas.map(c=>`<option>${c}</option>`).join('');
    cultSel.disabled=false;

    // Safra: estrutura preparada para uso futuro (ainda sem cadastro dedicado)
    const anoAtual=new Date().getFullYear();
    const safraSel=document.getElementById('lhm-safra');
    safraSel.innerHTML='<option value="">Selecione</option>'+[anoAtual-1,anoAtual,anoAtual+1].map(a=>`<option>${a}/${a+1}</option>`).join('');
    safraSel.disabled=false;

    const sec2=document.getElementById('lhm-sec2');
    const jaHabilitada=sec2.style.pointerEvents==='';
    sec2.style.opacity=''; sec2.style.pointerEvents='';
    if(!jaHabilitada){ sec2.classList.remove('op-unlock'); void sec2.offsetWidth; sec2.classList.add('op-unlock'); }

    const ultimo=horimetroUltimoDoPivo(pivoId,this.editandoGrupoId);
    const h1=document.getElementById('lhm-h1');
    if(ultimo){
      h1.value=ultimo.horimetroFinal; h1.readOnly=true;
      document.getElementById('lhm-h1-unlock').style.display='inline-block';
      document.getElementById('lhm-h1-autolbl').textContent='auto';
      document.getElementById('lhm-h1-hint').textContent=`Preenchido a partir do último lançamento (${fmtD(ultimo.data)}).`;
    }else{
      h1.value=''; h1.readOnly=false;
      document.getElementById('lhm-h1-unlock').style.display='none';
      document.getElementById('lhm-h1-autolbl').textContent='';
      document.getElementById('lhm-h1-hint').textContent='Nenhum lançamento anterior — informe manualmente.';
    }

    this.renderEquipamento(pivo);
    document.getElementById('lhm-footer-msg').textContent='Preencha os horímetros e o percentual para calcular automaticamente.';
    this.calc();
  },

  renderEquipamento(pivo){
    if(!pivo) return;
    const resumo=horimetroResumoPivo(pivo.id);
    const fazenda=cadLookupLabel('fazendas',pivo.fazendaId);
    const casaBomba=pivo.casaBombaId?cadLookupLabel('casasBomba',pivo.casaBombaId):'—';
    const ultimoLanc=horimetroUltimoDoPivo(pivo.id,this.editandoGrupoId);
    const ultimaCalib=(typeof calibracaoUltimaDoPivo==='function')?calibracaoUltimaDoPivo(pivo.id,null):null;

    const badge=document.getElementById('lhm-equip-badge');
    badge.textContent=pivo.status||'Ativo';
    badge.className='badge '+(pivo.status==='Manutenção'?'b-warning':pivo.status==='Inativo'?'b-danger':'b-success');

    document.getElementById('lhm-equip-panel').innerHTML=`
      <div style="display:flex;flex-direction:column;gap:.55rem;font-size:12px">
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-tertiary)">Pivô</span><strong>P.${pivo.numero}</strong></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-tertiary)">Fazenda</span><span>${fazenda}</span></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-tertiary)">Casa de Bomba</span><span>${casaBomba}</span></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-tertiary)">Lâmina a 100%</span><span>${pivo.laminaBase100?fmt(pivo.laminaBase100,2)+' mm':'—'}</span></div>
        <div style="height:1px;background:var(--border);margin:.2rem 0"></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-tertiary)">Último lançamento</span><span>${ultimoLanc?fmtD(ultimoLanc.data)+' · '+fmt(ultimoLanc.horas,1)+'h':'nenhum ainda'}</span></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-tertiary)">Última calibração</span><span>${ultimaCalib?fmtD(ultimaCalib.data):'sem calibração'}</span></div>
        <div style="height:1px;background:var(--border);margin:.2rem 0"></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-tertiary)">Acumulado lançado</span><strong style="color:var(--brand-600)">${fmt(resumo.acumulado,1)}h</strong></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-tertiary)">Média diária</span><span>${fmt(resumo.mediaDiaria,1)}h</span></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-tertiary)">Utilização</span><span>${fmtP(resumo.utilizacao)}</span></div>
      </div>`;

    const lamCard=document.getElementById('lhm-lam-card');
    if(pivo.laminaBase100){
      lamCard.style.display='';
      const linhas=[50,60,70,80,90,100].map(p=>({p,l:calcLamina(p,pivo.laminaBase100)}));
      document.getElementById('lhm-lam-table').innerHTML=`<table class="table"><thead><tr><th>%</th><th style="text-align:right">Lâmina (mm)</th></tr></thead><tbody>${linhas.map(r=>`<tr><td>${r.p}%</td><td style="text-align:right;font-weight:700;color:var(--brand-600)">${fmt(r.l,2)}</td></tr>`).join('')}</tbody></table>`;
    }else{
      lamCard.style.display='none';
    }
  },

  unlockH1(){
    const h1=document.getElementById('lhm-h1');
    h1.readOnly=false; h1.focus();
    document.getElementById('lhm-h1-unlock').style.display='none';
    document.getElementById('lhm-h1-autolbl').textContent='manual';
    document.getElementById('lhm-h1-hint').textContent='Editado manualmente — confira o valor.';
  },

  /* ── CÁLCULOS AO VIVO (delegados a services/calculos.js) ──────── */
  onH1(){ this.calc(); },

  onPct(){
    this.calc();
    const pct=Number(v('lhm-pct'))||0;
    const bar=document.getElementById('lhm-pct-bar-wrap');
    if(pct>0){
      bar.style.display='';
      document.getElementById('lhm-pct-bar').style.width=Math.min(pct,100)+'%';
      document.getElementById('lhm-pct-bar-lbl').textContent=pct+'%';
    }else{
      bar.style.display='none';
    }
  },
  setPct(val){ document.getElementById('lhm-pct').value=val; this.onPct(); },

  onData(){
    const data=v('lhm-data');
    document.getElementById('lhm-data-err').textContent = dataEhFutura(data) ? 'Data futura — será confirmada ao salvar.' : '';
  },

  calc(){
    const h1=v('lhm-h1'), h2=v('lhm-h2'), pct=v('lhm-pct');
    const pivoId=v('lhm-pivo');
    const pivo=pivoId?horimetroPivoInfo(pivoId):null;

    const informouAmbos=(h1!==''&&h2!=='');
    const h2Err=document.getElementById('lhm-h2-err');
    const h2El=document.getElementById('lhm-h2');
    const badge=document.getElementById('lhm-horas-badge');
    if(informouAmbos&&!horasValidas(h1,h2)){
      h2Err.textContent='Horímetro final deve ser maior que o inicial.';
      document.getElementById('lhm-horas-display').textContent='—';
      badge.textContent='Valor inválido'; badge.className='badge b-danger';
      h2El.classList.add('error'); h2El.classList.remove('success');
    }else{
      h2Err.textContent='';
      const horas=informouAmbos?calcHoras(h1,h2):null;
      document.getElementById('lhm-horas-display').textContent = horas!==null ? fmt(horas,1) : '—';
      badge.textContent = horas!==null ? 'Calculado' : 'Informe os horímetros';
      badge.className = 'badge '+(horas!==null?'b-success':'b-neutral');
      h2El.classList.remove('error'); h2El.classList.toggle('success',horas!==null);
    }

    const pctEl=document.getElementById('lhm-pct');
    const pctInvalido=(pct!==''&&!percentualValido(pct));
    document.getElementById('lhm-pct-err').textContent=pctInvalido?'Percentual deve ser entre 1 e 100.':'';
    pctEl.classList.toggle('error',pctInvalido);
    pctEl.classList.toggle('success',pct!==''&&!pctInvalido);

    const lamina=(pivo&&pct!==''&&percentualValido(pct))?calcLamina(Number(pct),pivo.laminaBase100):null;
    document.getElementById('lhm-lam').value = lamina!==null ? lamina : '';
    document.getElementById('lhm-lam-autolbl').textContent = lamina!==null ? 'auto' : '';
  },

  /* ── SALVAR (cria ou, se em edição, gera nova versão) ─────────── */
  salvar(dataFuturaAutorizada){
    if(bloquearSemPermissao('lancamentos','edit')) return;
    const dados={
      pivoId:v('lhm-pivo'), data:v('lhm-data'), horaInicio:v('lhm-hora'),
      horimetroInicial:v('lhm-h1'), horimetroFinal:v('lhm-h2'), percentual:v('lhm-pct'),
      pressao:v('lhm-pres'), horasOciosas:v('lhm-hoc'), cultura:v('lhm-cult'),
      areaPivo:v('lhm-area'), operador:v('lhm-oper'), observacao:v('lhm-obs'), safra:v('lhm-safra'),
      dataFuturaAutorizada:!!dataFuturaAutorizada,
    };

    const btn=document.getElementById('lhm-salvar-btn');
    const lbl=document.getElementById('lhm-salvar-lbl');
    btn.disabled=true; lbl.textContent='Salvando...';

    const resultado=this.editandoGrupoId ? horimetroAtualizar(this.editandoGrupoId,dados) : horimetroCriar(dados);

    if(resultado.dataFuturaPendente){
      btn.disabled=false; lbl.textContent='Salvar Lançamento';
      if(confirm('A data informada é futura. Confirma o lançamento mesmo assim?')) this.salvar(true);
      return;
    }
    btn.disabled=false; lbl.textContent='Salvar Lançamento';
    if(!resultado.ok){ toast(resultado.erros[0],'err'); return; }

    toast(this.editandoGrupoId?'Lançamento atualizado com sucesso.':'Lançamento salvo com sucesso.','ok');
    this.mostrarResumo(resultado.registro);
    if(typeof atuSB==='function') atuSB();
    this.editandoGrupoId=null;
    this.limparCamposAposSalvar();
  },

  limparCamposAposSalvar(){
    // Mantém Fazenda/Pivô (fluxo comum: vários lançamentos seguidos no mesmo pivô)
    ['lhm-h2','lhm-pres','lhm-hoc','lhm-obs'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('lhm-pct').value='';
    document.getElementById('lhm-lam').value='';
    document.getElementById('lhm-pct-bar-wrap').style.display='none';
    document.getElementById('lhm-horas-display').textContent='—';
    const badge=document.getElementById('lhm-horas-badge');
    badge.textContent='Informe os horímetros'; badge.className='badge b-neutral';
    this.onPivo();
  },

  mostrarResumo(registro){
    const pivo=horimetroPivoInfo(registro.pivoId);
    const card=document.getElementById('lhm-resumo-card');
    card.style.display='';
    card.classList.remove('op-saved-pulse'); void card.offsetWidth; card.classList.add('op-saved-pulse');
    document.getElementById('lhm-resumo-body').innerHTML=`
      <div style="display:flex;flex-direction:column;gap:.45rem;font-size:12px">
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-tertiary)">Pivô</span><strong>P.${pivo?pivo.numero:'?'}</strong></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-tertiary)">Data</span><span>${fmtD(registro.data)}</span></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-tertiary)">Horas</span><strong style="color:var(--brand-600)">${fmt(registro.horas,1)}h</strong></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-tertiary)">Lâmina</span><span>${registro.lamina?fmt(registro.lamina,2)+' mm':'—'}</span></div>
      </div>`;
  },

  editar(grupoId){
    const reg=horimetroTodos().find(r=>r.grupoId===grupoId&&r.atual);
    if(!reg) return;
    opPulseCard('#lhm-panel-lanc','op-edit-pulse');
    this.tabNav('lanc');
    this.editandoGrupoId=grupoId;

    const pivo=horimetroPivoInfo(reg.pivoId);
    document.getElementById('lhm-faz').value=pivo?cadLookupLabel('fazendas',pivo.fazendaId):'';
    this.onFaz();
    document.getElementById('lhm-pivo').value=reg.pivoId;
    this.onPivo();

    document.getElementById('lhm-cult').value=reg.cultura;
    document.getElementById('lhm-safra').value=reg.safra||'';
    document.getElementById('lhm-area').value=reg.areaPivo||'COMPLETO';
    document.getElementById('lhm-oper').value=reg.operador||'';
    document.getElementById('lhm-data').value=reg.data;
    document.getElementById('lhm-hora').value=reg.horaInicio||'';

    const h1=document.getElementById('lhm-h1');
    h1.value=reg.horimetroInicial; h1.readOnly=false;
    document.getElementById('lhm-h1-unlock').style.display='none';
    document.getElementById('lhm-h1-autolbl').textContent='';
    document.getElementById('lhm-h2').value=reg.horimetroFinal;
    document.getElementById('lhm-pct').value=reg.percentual;
    document.getElementById('lhm-pres').value=reg.pressao??'';
    document.getElementById('lhm-hoc').value=reg.horasOciosas??'';
    document.getElementById('lhm-obs').value=reg.observacao||'';
    this.calc();
    document.getElementById('lhm-salvar-lbl').textContent='Salvar Alteração';
    toast('Editando lançamento — uma nova versão será criada ao salvar (o registro original é preservado).','info');
  },

  verVersoes(grupoId){
    const versoes=horimetroHistoricoVersoes(grupoId);
    const itens=versoes.map(v=>({versao:v.versao,atual:v.atual,status:v.status,
      linha:`${fmtD(v.data)} — Horímetro ${fmt(v.horimetroInicial,1)} → ${fmt(v.horimetroFinal,1)} (${fmt(v.horas,1)}h)`}));
    showVersoesModal('Histórico de Versões — Horímetro',itens);
  },

  excluir(grupoId,btn){
    if(bloquearSemPermissao('lancamentos','delete')) return;
    if(!confirm('Excluir este lançamento? Ele some das consultas, mas o registro permanece guardado e a exclusão fica na auditoria.')) return;
    opFadeRowThen(btn,()=>{
      const resultado=horimetroExcluir(grupoId);
      if(resultado.ok){
        auditoriaRegistrar('EXCLUSÃO','Horímetro',grupoId,'Lançamento de horímetro excluído.');
        toast('Lançamento excluído.','ok');
        this.renderHist();
        if(typeof atuSB==='function') atuSB();
      }
    });
  },

  /* ── HISTÓRICO: FILTROS + TABELA + RESUMO/GRÁFICOS POR PIVÔ ───── */
  buildHistSelects(){
    if(this._histSelectsBuilt) return;
    const pivos=(cadAll('pivos')||[]).slice().sort((a,b)=>a.numero-b.numero);
    fillSelect('lhm-hist-pv',pivos.map(p=>`<option value="${p.id}">P.${p.numero}</option>`).join(''),'Pivô');
    const casas=(cadAll('casasBomba')||[]);
    fillSelect('lhm-hist-cb',casas.map(c=>`<option value="${c.id}">${c.nome}</option>`).join(''),'Casa de Bomba');
    this._histSelectsBuilt=true;
  },

  renderHist(){
    this.buildHistSelects();
    const q=v('lhm-hist-q').toLowerCase();
    const faz=v('lhm-hist-faz');
    const pivoId=v('lhm-hist-pv');
    const casaBombaId=v('lhm-hist-cb');
    const mes=v('lhm-hist-mes');

    let base;
    if(pivoId) base=horimetroPorPivo(pivoId);
    else if(casaBombaId) base=horimetroPorCasaBomba(casaBombaId);
    else if(faz){
      const fazRec=(cadAll('fazendas')||[]).find(f=>f.nome===faz);
      base=fazRec?horimetroPorFazenda(fazRec.id):horimetroAtivos();
    }else base=horimetroAtivos();

    const filtrados=base.filter(r=>{
      if(mes&&r.data.slice(0,7)!==mes) return false;
      if(!q) return true;
      const pivo=horimetroPivoInfo(r.pivoId);
      return String(pivo?pivo.numero:'').includes(q)||(r.cultura||'').toLowerCase().includes(q)||(r.operador||'').toLowerCase().includes(q);
    }).sort((a,b)=>b.data.localeCompare(a.data));

    document.getElementById('lhm-hist-cnt').textContent=filtrados.length.toLocaleString('pt-BR')+' registros';

    const resumoWrap=document.getElementById('lhm-hist-resumo');
    if(pivoId){
      resumoWrap.style.display='';
      const resumo=horimetroResumoPivo(pivoId);
      document.getElementById('lhm-hist-kpis').innerHTML=
        kpi('Acumulado',fmt(resumo.acumulado,1),'h','total lançado',null,null,'kpi-teal')+
        kpi('Média Diária',fmt(resumo.mediaDiaria,1),'h','',null,null,'kpi-sky')+
        kpi('Média Mensal',fmt(resumo.mediaMensal,1),'h','',null,null,'kpi-green')+
        kpi('Utilização',fmtP(resumo.utilizacao),'','',resumo.utilizacao,'#16a34a','kpi-purple');
      document.getElementById('lhm-hist-evolucao').innerHTML=lineChart([{lbl:'Horímetro',pts:horimetroEvolucaoAcumulada(pivoId).map(p=>({x:fmtD(p.x).slice(0,5),y:p.y})),c:'var(--brand-600)'}],130);
      document.getElementById('lhm-hist-mensal').innerHTML=lineChart([{lbl:'Horas/mês',pts:resumo.porMes.map(m=>({x:m.mes.slice(2),y:m.horas})),c:'#0284c7'}],130);
      document.getElementById('lhm-hist-anual').innerHTML=barH(resumo.porAno.map(a=>({l:a.ano,v:a.horas,c:'var(--brand-600)',dec:1})),50);
      document.getElementById('lhm-hist-safra').innerHTML=barH(resumo.porSafra.map(s=>({l:s.safra,v:s.horas,c:'#7c3aed',dec:1})),110);
    }else{
      resumoWrap.style.display='none';
    }

    const PER=20;
    const pagina=filtrados.slice(this.pagina*PER,(this.pagina+1)*PER);
    const tbl=document.getElementById('lhm-hist-tbl');
    tbl.innerHTML=pagina.length?`<table class="table"><thead><tr><th>Data</th><th>Pivô</th><th>Cultura</th><th>Área</th><th style="text-align:right">H.Inicial</th><th style="text-align:right">H.Final</th><th style="text-align:right">Horas</th><th style="text-align:right">%</th><th style="text-align:right">Lâmina</th><th>Operador</th><th style="text-align:right">Versão</th><th style="text-align:right">Ações</th></tr></thead><tbody>${pagina.map(r=>{
      const pivo=horimetroPivoInfo(r.pivoId);
      return `<tr class="${isRecent24h(r.criadoEm)?'op-recent':''}"><td>${isRecent24h(r.criadoEm)?'<span class="op-recent-dot" title="Lançado nas últimas 24h"></span>':''}${fmtD(r.data)}</td><td><span class="badge b-brand">P.${pivo?pivo.numero:'?'}</span></td><td>${r.cultura||'—'}</td><td>${r.areaPivo||'—'}</td><td style="text-align:right">${fmt(r.horimetroInicial,1)}</td><td style="text-align:right">${fmt(r.horimetroFinal,1)}</td><td style="text-align:right;font-weight:700;color:var(--brand-600)">${fmt(r.horas,1)}</td><td style="text-align:right">${r.percentual}%</td><td style="text-align:right">${r.lamina?fmt(r.lamina,2):'—'}</td><td>${r.operador||'—'}</td><td style="text-align:right;color:var(--text-tertiary);${r.versao>1?'cursor:pointer;text-decoration:underline':''}" ${r.versao>1?`onclick="lhm.verVersoes('${r.grupoId}')" title="Ver versões anteriores"`:''}>v${r.versao}</td><td style="text-align:right;white-space:nowrap">${lancAcoesHtml('lhm',r.grupoId)}</td></tr>`;
    }).join('')}</tbody></table>`:emEl('Nenhum lançamento encontrado.');
    pag('lhm-hist-pg',filtrados.length,this.pagina,p=>{ this.pagina=p; this.renderHist(); });
  },

  clearHist(){
    ['lhm-hist-q','lhm-hist-faz','lhm-hist-pv','lhm-hist-cb','lhm-hist-mes'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    this.pagina=0;
    this.renderHist();
  },

  exportHist(){
    const rows=horimetroAtivos().map(r=>{
      const pivo=horimetroPivoInfo(r.pivoId);
      return [fmtD(r.data),pivo?pivo.numero:'',r.cultura,r.areaPivo,r.horimetroInicial,r.horimetroFinal,r.horas,r.percentual,r.lamina,r.operador,r.versao];
    });
    if(!rows.length){ toast('Nada para exportar.','warn'); return; }
    downloadCSV('lancamentos_horimetro.csv',toCSV(['Data','Pivô','Cultura','Área','H.Inicial','H.Final','Horas','Percentual','Lâmina','Operador','Versão'],rows));
    toast(`${rows.length} lançamentos exportados.`,'ok');
  },
};

/* ── FALHA / INDICADOR (aba "Falha / Indicador" de Lançamentos) ───
   Categoria/Motivo/Submotivo vêm do cadastro configurável de Falhas
   (js/cadastro.js) — nada fixo no código. Persistência e cálculos via
   js/services/indicador.js.
   ──────────────────────────────────────────────────────────────── */
const lhf={
  editandoGrupoId:null,
  pagina:0,

  onCategoria(){
    const cat=v('lhf-cat');
    const motivoSel=document.getElementById('lhf-motivo');
    document.getElementById('lhf-submotivo').value='';
    if(!cat){ motivoSel.innerHTML='<option value="">Selecione a categoria</option>'; motivoSel.disabled=true; return; }
    const motivos=(cadAll('falhas')||[]).filter(f=>f.categoria===cat);
    motivoSel.innerHTML='<option value="">Selecione...</option>'+motivos.map(f=>`<option value="${f.id}">${f.motivo}</option>`).join('');
    motivoSel.disabled=false;
  },
  onMotivo(){
    const falhaId=v('lhf-motivo');
    const falha=(cadAll('falhas')||[]).find(f=>f.id===falhaId);
    document.getElementById('lhf-submotivo').value=falha?(falha.submotivo||'—'):'';
  },

  /* Painel lateral "Equipamento" — mesmo padrão do Horímetro
     (lhm.renderEquipamento): ao escolher o pivô, mostra fazenda/casa de
     bomba (cadastro) e o histórico de ocorrências já registradas para
     ele (indicadorPorPivo, já existente) — nada digitado de novo. */
  onPivo(){
    const pivoId=v('lhf-pivo');
    if(!pivoId){ this.limparEquipamento(); return; }
    this.renderEquipamento(horimetroPivoInfo(pivoId));
  },
  limparEquipamento(){
    const badge=document.getElementById('lhf-equip-badge');
    badge.textContent='Aguardando'; badge.className='badge b-neutral';
    document.getElementById('lhf-equip-panel').innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;gap:.5rem;padding:.5rem;color:var(--text-tertiary)"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--border-strong)" stroke-width="1"><path d="M12 22V12"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><circle cx="12" cy="5" r="3"/></svg><span style="font-size:12px">Selecione o pivô</span></div>`;
  },
  renderEquipamento(pivo){
    if(!pivo){ this.limparEquipamento(); return; }
    const fazenda=cadLookupLabel('fazendas',pivo.fazendaId);
    const casaBomba=pivo.casaBombaId?cadLookupLabel('casasBomba',pivo.casaBombaId):'—';
    const ocorrencias=indicadorPorPivo(pivo.id);
    const ultima=ocorrencias.length?ocorrencias[ocorrencias.length-1]:null;
    const ultimaFalha=ultima?indicadorFalhaInfo(ultima.falhaId):null;

    const badge=document.getElementById('lhf-equip-badge');
    badge.textContent=pivo.status||'Ativo';
    badge.className='badge '+(pivo.status==='Manutenção'?'b-warning':pivo.status==='Inativo'?'b-danger':'b-success');

    document.getElementById('lhf-equip-panel').innerHTML=`
      <div style="display:flex;flex-direction:column;gap:.55rem;font-size:12px">
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-tertiary)">Pivô</span><strong>P.${pivo.numero}</strong></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-tertiary)">Fazenda</span><span>${fazenda}</span></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-tertiary)">Casa de Bomba</span><span>${casaBomba}</span></div>
        <div style="height:1px;background:var(--border);margin:.2rem 0"></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-tertiary)">Ocorrências registradas</span><strong style="color:${ocorrencias.length?'var(--c-warning-d)':'var(--brand-600)'}">${ocorrencias.length}</strong></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-tertiary)">Última ocorrência</span><span>${ultima?fmtD(ultima.data):'nenhuma ainda'}</span></div>
        ${ultimaFalha?`<div style="display:flex;justify-content:space-between"><span style="color:var(--text-tertiary)">Categoria / Motivo</span><span style="text-align:right">${ultimaFalha.categoria} — ${ultimaFalha.motivo}</span></div>`:''}
      </div>`;
  },

  limpar(){
    this.editandoGrupoId=null;
    ['lhf-data','lhf-pivo','lhf-cat','lhf-obs'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('lhf-data').value=today();
    const motivoSel=document.getElementById('lhf-motivo');
    motivoSel.innerHTML='<option value="">Selecione a categoria</option>'; motivoSel.disabled=true;
    document.getElementById('lhf-submotivo').value='';
    document.getElementById('lhf-salvar-lbl').textContent='Registrar';
    this.limparEquipamento();
  },

  salvar(dataFuturaAutorizada){
    if(bloquearSemPermissao('lancamentos','edit')) return;
    const dados={
      pivoId:v('lhf-pivo'), falhaId:v('lhf-motivo'), data:v('lhf-data'),
      observacao:v('lhf-obs'),
      dataFuturaAutorizada:!!dataFuturaAutorizada,
    };
    if(!dados.pivoId||!dados.falhaId||!dados.data){ toast('Preencha data, pivô, categoria e motivo.','err'); return; }

    const resultado=this.editandoGrupoId?indicadorAtualizar(this.editandoGrupoId,dados):indicadorCriar(dados);
    if(resultado.dataFuturaPendente){
      if(confirm('A data informada é futura. Confirma mesmo assim?')) this.salvar(true);
      return;
    }
    if(!resultado.ok){ toast((resultado.erros&&resultado.erros[0])||'Não foi possível salvar.','err'); return; }

    toast(this.editandoGrupoId?'Ocorrência atualizada.':'Falha registrada com sucesso.','ok');
    this.editandoGrupoId=null;
    this.limpar();
    this.render();
  },

  editar(grupoId){
    const reg=indicadorTodos().find(r=>r.grupoId===grupoId&&r.atual);
    if(!reg) return;
    opPulseCard('#lhm-panel-falha','op-edit-pulse');
    this.editandoGrupoId=grupoId;
    document.getElementById('lhf-data').value=reg.data;
    document.getElementById('lhf-pivo').value=reg.pivoId;
    this.onPivo();
    const falha=indicadorFalhaInfo(reg.falhaId);
    if(falha){
      document.getElementById('lhf-cat').value=falha.categoria;
      this.onCategoria();
      document.getElementById('lhf-motivo').value=falha.id;
      this.onMotivo();
    }
    document.getElementById('lhf-obs').value=reg.observacao||'';
    document.getElementById('lhf-salvar-lbl').textContent='Salvar Alteração';
    toast('Editando ocorrência — uma nova versão será criada ao salvar.','info');
  },
  excluir(grupoId,btn){
    if(bloquearSemPermissao('lancamentos','delete')) return;
    if(!confirm('Excluir esta ocorrência? Ela some das consultas, mas o registro fica guardado e a exclusão vai para a auditoria.')) return;
    opFadeRowThen(btn,()=>{
      const resultado=indicadorExcluir(grupoId);
      if(resultado.ok){ auditoriaRegistrar('EXCLUSÃO','Falha/Indicador',grupoId,'Ocorrência excluída.'); toast('Ocorrência excluída.','ok'); this.render(); }
    });
  },

  verVersoes(grupoId){
    const versoes=indicadorHistoricoVersoes(grupoId);
    const itens=versoes.map(v=>({versao:v.versao,atual:v.atual,status:v.status,linha:`${fmtD(v.data)} — ocorrência de falha`}));
    showVersoesModal('Histórico de Versões — Falha/Indicador',itens);
  },

  render(){
    const q=v('lhf-q').toLowerCase();
    const pivoId=v('lhf-filtro-pivo');
    const casaBombaId=v('lhf-filtro-cb');
    const fazendaId=v('lhf-filtro-faz');

    let base;
    if(pivoId) base=indicadorPorPivo(pivoId);
    else if(casaBombaId) base=indicadorPorCasaBomba(casaBombaId);
    else if(fazendaId) base=indicadorPorFazenda(fazendaId);
    else base=indicadorAtivos();

    const filtrados=base.filter(r=>{
      if(!q) return true;
      const pivo=horimetroPivoInfo(r.pivoId), falha=indicadorFalhaInfo(r.falhaId);
      return String(pivo?pivo.numero:'').includes(q)||(falha&&(falha.categoria.toLowerCase().includes(q)||falha.motivo.toLowerCase().includes(q)));
    }).sort((a,b)=>b.data.localeCompare(a.data));

    document.getElementById('lhf-cnt').textContent=filtrados.length.toLocaleString('pt-BR')+' ocorrências';
    const PER=20;
    const pagina=filtrados.slice(this.pagina*PER,(this.pagina+1)*PER);
    const badgeCriticidade={Baixa:'b-success',Média:'b-warning',Alta:'b-danger'};
    document.getElementById('lhf-tbl').innerHTML=pagina.length?`<table class="table"><thead><tr><th>Data</th><th>Pivô</th><th>Categoria</th><th>Motivo</th><th>Criticidade</th><th>Prioridade</th><th style="text-align:right">Versão</th><th style="text-align:right">Ações</th></tr></thead><tbody>${pagina.map(r=>{
      const pivo=horimetroPivoInfo(r.pivoId), falha=indicadorFalhaInfo(r.falhaId);
      return `<tr class="${isRecent24h(r.criadoEm)?'op-recent':''}"><td>${isRecent24h(r.criadoEm)?'<span class="op-recent-dot" title="Registrado nas últimas 24h"></span>':''}${fmtD(r.data)}</td><td><span class="badge b-brand">P.${pivo?pivo.numero:'?'}</span></td><td>${falha?falha.categoria:'—'}</td><td>${falha?falha.motivo:'—'}</td><td><span class="badge ${badgeCriticidade[falha&&falha.criticidade]||'b-neutral'}">${falha?falha.criticidade:'—'}</span></td><td>${falha?falha.prioridade:'—'}</td><td style="text-align:right;color:var(--text-tertiary);${r.versao>1?'cursor:pointer;text-decoration:underline':''}" ${r.versao>1?`onclick="lhf.verVersoes('${r.grupoId}')" title="Ver versões anteriores"`:''}>v${r.versao}</td><td style="text-align:right;white-space:nowrap">${lancAcoesHtml('lhf',r.grupoId)}</td></tr>`;
    }).join('')}</tbody></table>`:emEl('Nenhuma ocorrência registrada ainda.');
    pag('lhf-pg',filtrados.length,this.pagina,p=>{ this.pagina=p; this.render(); });
  },
  clear(){
    ['lhf-q','lhf-filtro-pivo','lhf-filtro-faz','lhf-filtro-cb'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    this.pagina=0;
    this.render();
  },
};

/* ── PARADA (aba "Parada" de Lançamentos) ──────────────────────────
   Fazenda/Casa de Bomba são derivadas do Pivô (cadastro), nunca
   redigitadas. Categoria/Motivo/Submotivo/Criticidade/Prioridade vêm
   do cadastro de Falhas (mesma taxonomia usada em Falha/Indicador —
   nunca duplicada). Cálculo e persistência 100% em
   js/services/parada.js; esta tela só monta os campos.
   ──────────────────────────────────────────────────────────────── */
const lp={
  editandoGrupoId:null,
  pagina:0,

  onFaz(){
    const faz=v('lp-faz');
    const pivoSel=document.getElementById('lp-pivo');
    document.getElementById('lp-casabomba').value='';
    if(!faz){ pivoSel.innerHTML='<option value="">Selecione a fazenda</option>'; pivoSel.disabled=true; return; }
    const fazRec=(cadAll('fazendas')||[]).find(f=>f.nome===faz);
    const pivos=(cadAll('pivos')||[]).filter(p=>p.fazendaId===(fazRec&&fazRec.id)).sort((a,b)=>a.numero-b.numero);
    pivoSel.innerHTML='<option value="">Selecione...</option>'+pivos.map(p=>`<option value="${p.id}">P.${p.numero}</option>`).join('');
    pivoSel.disabled=false;
  },
  onPivo(){
    const pivoId=v('lp-pivo');
    const pivo=pivoId?horimetroPivoInfo(pivoId):null;
    document.getElementById('lp-casabomba').value=pivo&&pivo.casaBombaId?cadLookupLabel('casasBomba',pivo.casaBombaId):'—';
  },
  onCategoria(){
    const cat=v('lp-cat');
    const motivoSel=document.getElementById('lp-motivo');
    ['lp-submotivo','lp-criticidade','lp-prioridade'].forEach(id=>document.getElementById(id).value='');
    if(!cat){ motivoSel.innerHTML='<option value="">Selecione a categoria</option>'; motivoSel.disabled=true; return; }
    const motivos=(cadAll('falhas')||[]).filter(f=>f.categoria===cat);
    motivoSel.innerHTML='<option value="">Selecione...</option>'+motivos.map(f=>`<option value="${f.id}">${f.motivo}</option>`).join('');
    motivoSel.disabled=false;
  },
  onMotivo(){
    const falha=(cadAll('falhas')||[]).find(f=>f.id===v('lp-motivo'));
    document.getElementById('lp-submotivo').value=falha?(falha.submotivo||'—'):'';
    document.getElementById('lp-criticidade').value=falha?falha.criticidade:'';
    document.getElementById('lp-prioridade').value=falha?falha.prioridade:'';
  },

  calc(){
    const tempo=calcDuracaoHoras(v('lp-h1'),v('lp-h2'));
    document.getElementById('lp-tempo-display').textContent=tempo!=null?fmt(tempo,2)+'h':'—';
  },

  limpar(){
    this.editandoGrupoId=null;
    ['lp-data','lp-h1','lp-h2','lp-faz','lp-cat','lp-oper','lp-tecnico','lp-obs'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('lp-data').value=today();
    document.getElementById('lp-tipo').value='Não Programada';
    const pivoSel=document.getElementById('lp-pivo');
    pivoSel.innerHTML='<option value="">Selecione a fazenda</option>'; pivoSel.disabled=true;
    document.getElementById('lp-casabomba').value='';
    const motivoSel=document.getElementById('lp-motivo');
    motivoSel.innerHTML='<option value="">Selecione a categoria</option>'; motivoSel.disabled=true;
    ['lp-submotivo','lp-criticidade','lp-prioridade'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('lp-tempo-display').textContent='—';
    document.getElementById('lp-salvar-lbl').textContent='Registrar Parada';
  },

  salvar(dataFuturaAutorizada){
    if(bloquearSemPermissao('lancamentos','edit')) return;
    const dados={
      pivoId:v('lp-pivo'), falhaId:v('lp-motivo'), data:v('lp-data'),
      horaInicial:v('lp-h1'), horaFinal:v('lp-h2'),
      operador:v('lp-oper'), tecnicoId:v('lp-tecnico'), tipoParada:v('lp-tipo'),
      observacao:v('lp-obs'), dataFuturaAutorizada:!!dataFuturaAutorizada,
    };
    const resultado=this.editandoGrupoId?paradaAtualizar(this.editandoGrupoId,dados):paradaCriar(dados);
    if(resultado.dataFuturaPendente){
      if(confirm('A data informada é futura. Confirma mesmo assim?')) this.salvar(true);
      return;
    }
    if(!resultado.ok){ toast((resultado.erros&&resultado.erros[0])||'Não foi possível salvar.','err'); return; }

    toast(this.editandoGrupoId?'Parada atualizada.':'Parada registrada com sucesso.','ok');
    this.editandoGrupoId=null;
    this.limpar();
    this.render();
  },

  editar(grupoId){
    const reg=paradaTodos().find(r=>r.grupoId===grupoId&&r.atual);
    if(!reg) return;
    opPulseCard('#lhm-panel-parada','op-edit-pulse');
    this.editandoGrupoId=grupoId;
    const pivo=horimetroPivoInfo(reg.pivoId);
    document.getElementById('lp-faz').value=pivo?cadLookupLabel('fazendas',pivo.fazendaId):'';
    this.onFaz();
    document.getElementById('lp-pivo').value=reg.pivoId;
    this.onPivo();
    const falha=indicadorFalhaInfo(reg.falhaId);
    if(falha){
      document.getElementById('lp-cat').value=falha.categoria;
      this.onCategoria();
      document.getElementById('lp-motivo').value=falha.id;
      this.onMotivo();
    }
    document.getElementById('lp-data').value=reg.data;
    document.getElementById('lp-h1').value=reg.horaInicial;
    document.getElementById('lp-h2').value=reg.horaFinal;
    document.getElementById('lp-tipo').value=reg.tipoParada;
    document.getElementById('lp-oper').value=reg.operador||'';
    document.getElementById('lp-tecnico').value=reg.tecnicoId||'';
    document.getElementById('lp-obs').value=reg.observacao||'';
    this.calc();
    document.getElementById('lp-salvar-lbl').textContent='Salvar Alteração';
    toast('Editando parada — uma nova versão será criada ao salvar.','info');
  },
  excluir(grupoId,btn){
    if(bloquearSemPermissao('lancamentos','delete')) return;
    if(!confirm('Excluir esta parada? Ela some das consultas, mas o registro fica guardado e a exclusão vai para a auditoria.')) return;
    opFadeRowThen(btn,()=>{
      const resultado=paradaExcluir(grupoId);
      if(resultado.ok){ auditoriaRegistrar('EXCLUSÃO','Paradas',grupoId,'Parada excluída.'); toast('Parada excluída.','ok'); this.render(); }
    });
  },
  verVersoes(grupoId){
    const versoes=paradaHistoricoVersoes(grupoId);
    const itens=versoes.map(v=>({versao:v.versao,atual:v.atual,status:v.status,linha:`${fmtD(v.data)} — ${v.horaInicial}–${v.horaFinal}`}));
    showVersoesModal('Histórico de Versões — Parada',itens);
  },

  render(){
    const q=v('lp-q').toLowerCase();
    const pivoId=v('lp-filtro-pivo');
    const casaBombaId=v('lp-filtro-cb');
    const fazendaId=v('lp-filtro-faz');

    let base;
    if(pivoId) base=paradaPorPivo(pivoId);
    else if(casaBombaId) base=paradaPorCasaBomba(casaBombaId);
    else if(fazendaId){
      const fazRec=(cadAll('fazendas')||[]).find(f=>f.nome===fazendaId||f.id===fazendaId);
      base=fazRec?paradaPorFazenda(fazRec.id):paradaAtivas();
    }else base=paradaAtivas();

    const filtrados=base.filter(r=>{
      if(!q) return true;
      const pivo=horimetroPivoInfo(r.pivoId), falha=indicadorFalhaInfo(r.falhaId);
      return String(pivo?pivo.numero:'').includes(q)||(falha&&(falha.categoria.toLowerCase().includes(q)||falha.motivo.toLowerCase().includes(q)));
    }).sort((a,b)=>(b.data+b.horaInicial).localeCompare(a.data+a.horaInicial));

    document.getElementById('lp-cnt').textContent=filtrados.length.toLocaleString('pt-BR')+' paradas';

    const resumoWrap=document.getElementById('lp-resumo');
    if(pivoId){
      resumoWrap.style.display='';
      const resumo=paradaResumoPivo(pivoId);
      document.getElementById('lp-resumo-kpis').innerHTML=
        kpi('Tempo Acumulado',fmt(resumo.tempoAcumulado,1),'h','',null,null,'kpi-red')+
        kpi('Frequência',resumo.frequencia,'','ocorrências',null,null,'kpi-amber')+
        kpi('Tempo Médio',fmt(resumo.tempoMedio,2),'h','por parada',null,null,'kpi-gray');
      document.getElementById('lp-resumo-evolucao').innerHTML=lineChart([{lbl:'Tempo Parado',pts:resumo.linhaDoTempo.map(p=>({x:fmtD(p.data).slice(0,5),y:p.horas})),c:'var(--c-danger)'}],120);
      document.getElementById('lp-resumo-ranking').innerHTML=barH(resumo.rankingMotivos.slice(0,8).map(r=>({l:r.motivo,v:r.ocorrencias,c:'#dc2626'})),150);
    }else{
      resumoWrap.style.display='none';
    }

    const PER=20;
    const pagina=filtrados.slice(this.pagina*PER,(this.pagina+1)*PER);
    document.getElementById('lp-tbl').innerHTML=pagina.length?`<table class="table"><thead><tr><th>Data</th><th>Horário</th><th>Pivô</th><th>Categoria/Motivo</th><th>Tipo</th><th style="text-align:right">Tempo Parado</th><th style="text-align:right">Versão</th><th style="text-align:right">Ações</th></tr></thead><tbody>${pagina.map(r=>{
      const pivo=horimetroPivoInfo(r.pivoId), falha=indicadorFalhaInfo(r.falhaId);
      return `<tr class="${isRecent24h(r.criadoEm)?'op-recent':''}"><td>${isRecent24h(r.criadoEm)?'<span class="op-recent-dot" title="Registrado nas últimas 24h"></span>':''}${fmtD(r.data)}</td><td style="white-space:nowrap">${r.horaInicial}–${r.horaFinal}</td><td><span class="badge b-brand">P.${pivo?pivo.numero:'?'}</span></td><td style="font-size:11px">${falha?falha.categoria+' / '+falha.motivo:'—'}</td><td><span class="badge ${r.tipoParada==='Programada'?'b-info':'b-warning'}">${r.tipoParada}</span></td><td style="text-align:right;font-weight:700;color:var(--c-danger)">${fmt(r.tempoParadoHoras,2)}h</td><td style="text-align:right;color:var(--text-tertiary);${r.versao>1?'cursor:pointer;text-decoration:underline':''}" ${r.versao>1?`onclick="lp.verVersoes('${r.grupoId}')" title="Ver versões anteriores"`:''}>v${r.versao}</td><td style="text-align:right;white-space:nowrap">${lancAcoesHtml('lp',r.grupoId)}</td></tr>`;
    }).join('')}</tbody></table>`:emEl('Nenhuma parada registrada ainda.');
    pag('lp-pg',filtrados.length,this.pagina,p=>{ this.pagina=p; this.render(); });
  },
  clear(){
    ['lp-q','lp-filtro-pivo','lp-filtro-faz','lp-filtro-cb'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    this.pagina=0;
    this.render();
  },
};

/* ── FERTIRRIGAÇÃO (aba "Fertirrigação" de Lançamentos) ────────────
   Fazenda/Casa de Bomba derivadas do Pivô; Categoria/Unidade derivadas
   do Produto selecionado (cadastro) — nada redigitado. Cálculo e
   persistência 100% em js/services/fertirrigacao.js.
   ──────────────────────────────────────────────────────────────── */
const lft={
  editandoGrupoId:null,
  pagina:0,

  onFaz(){
    const faz=v('lft-faz');
    const pivoSel=document.getElementById('lft-pivo');
    document.getElementById('lft-casabomba').value='';
    if(!faz){ pivoSel.innerHTML='<option value="">Selecione a fazenda</option>'; pivoSel.disabled=true; return; }
    const fazRec=(cadAll('fazendas')||[]).find(f=>f.nome===faz);
    const pivos=(cadAll('pivos')||[]).filter(p=>p.fazendaId===(fazRec&&fazRec.id)).sort((a,b)=>a.numero-b.numero);
    pivoSel.innerHTML='<option value="">Selecione...</option>'+pivos.map(p=>`<option value="${p.id}">P.${p.numero}</option>`).join('');
    pivoSel.disabled=false;
  },
  onPivo(){
    const pivo=horimetroPivoInfo(v('lft-pivo'));
    document.getElementById('lft-casabomba').value=pivo&&pivo.casaBombaId?cadLookupLabel('casasBomba',pivo.casaBombaId):'—';
  },
  onProduto(){
    const produto=(cadAll('produtos')||[]).find(p=>p.id===v('lft-produto'));
    document.getElementById('lft-categoria').value=produto?cadLookupLabel('categoriasProduto',produto.categoriaId):'';
    document.getElementById('lft-unidade').value=produto?cadLookupLabel('unidadesMedida',produto.unidadeId):'';
  },
  calc(){
    const tempo=calcDuracaoHoras(v('lft-h1'),v('lft-h2'));
    document.getElementById('lft-tempo-display').textContent=tempo!=null?fmt(tempo,2)+'h':'—';
  },

  limpar(){
    this.editandoGrupoId=null;
    ['lft-data','lft-h1','lft-h2','lft-faz','lft-cultura','lft-produto','lft-qtd','lft-conc','lft-volume','lft-vazao','lft-oper','lft-obs'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('lft-data').value=today();
    const pivoSel=document.getElementById('lft-pivo');
    pivoSel.innerHTML='<option value="">Selecione a fazenda</option>'; pivoSel.disabled=true;
    document.getElementById('lft-casabomba').value='';
    document.getElementById('lft-categoria').value='';
    document.getElementById('lft-unidade').value='';
    document.getElementById('lft-tempo-display').textContent='—';
    document.getElementById('lft-salvar-lbl').textContent='Registrar';
  },

  salvar(dataFuturaAutorizada){
    if(bloquearSemPermissao('lancamentos','edit')) return;
    const dados={
      pivoId:v('lft-pivo'), produtoId:v('lft-produto'), cultura:v('lft-cultura'), safra:v('lft-safra'),
      data:v('lft-data'), horaInicial:v('lft-h1'), horaFinal:v('lft-h2'),
      quantidadeAplicada:v('lft-qtd'), concentracao:v('lft-conc'), volumeAgua:v('lft-volume'), vazao:v('lft-vazao'),
      operador:v('lft-oper'), observacao:v('lft-obs'), dataFuturaAutorizada:!!dataFuturaAutorizada,
    };
    const resultado=this.editandoGrupoId?fertiAtualizar(this.editandoGrupoId,dados):fertiCriar(dados);
    if(resultado.dataFuturaPendente){
      if(confirm('A data informada é futura. Confirma mesmo assim?')) this.salvar(true);
      return;
    }
    if(!resultado.ok){ toast((resultado.erros&&resultado.erros[0])||'Não foi possível salvar.','err'); return; }

    toast(this.editandoGrupoId?'Fertirrigação atualizada.':'Fertirrigação registrada com sucesso.','ok');
    this.editandoGrupoId=null;
    this.limpar();
    this.render();
  },

  editar(grupoId){
    const reg=fertiTodos().find(r=>r.grupoId===grupoId&&r.atual);
    if(!reg) return;
    opPulseCard('#lhm-panel-ferti','op-edit-pulse');
    this.editandoGrupoId=grupoId;
    const pivo=horimetroPivoInfo(reg.pivoId);
    document.getElementById('lft-faz').value=pivo?cadLookupLabel('fazendas',pivo.fazendaId):'';
    this.onFaz();
    document.getElementById('lft-pivo').value=reg.pivoId;
    this.onPivo();
    document.getElementById('lft-cultura').value=reg.cultura;
    document.getElementById('lft-safra').value=reg.safra||'';
    document.getElementById('lft-produto').value=reg.produtoId;
    this.onProduto();
    document.getElementById('lft-data').value=reg.data;
    document.getElementById('lft-h1').value=reg.horaInicial;
    document.getElementById('lft-h2').value=reg.horaFinal;
    document.getElementById('lft-qtd').value=reg.quantidadeAplicada;
    document.getElementById('lft-conc').value=reg.concentracao??'';
    document.getElementById('lft-volume').value=reg.volumeAgua??'';
    document.getElementById('lft-vazao').value=reg.vazao??'';
    document.getElementById('lft-oper').value=reg.operador||'';
    document.getElementById('lft-obs').value=reg.observacao||'';
    this.calc();
    document.getElementById('lft-salvar-lbl').textContent='Salvar Alteração';
    toast('Editando fertirrigação — uma nova versão será criada ao salvar.','info');
  },
  excluir(grupoId,btn){
    if(bloquearSemPermissao('lancamentos','delete')) return;
    if(!confirm('Excluir esta fertirrigação? Ela some das consultas, mas o registro fica guardado e a exclusão vai para a auditoria.')) return;
    opFadeRowThen(btn,()=>{
      const resultado=fertiExcluir(grupoId);
      if(resultado.ok){ auditoriaRegistrar('EXCLUSÃO','Fertirrigação',grupoId,'Fertirrigação excluída.'); toast('Fertirrigação excluída.','ok'); this.render(); }
    });
  },
  verVersoes(grupoId){
    const versoes=fertiHistoricoVersoes(grupoId);
    const itens=versoes.map(v=>({versao:v.versao,atual:v.atual,status:v.status,linha:`${fmtD(v.data)} — ${fmt(v.quantidadeAplicada,2)} aplicado`}));
    showVersoesModal('Histórico de Versões — Fertirrigação',itens);
  },

  render(){
    const q=v('lft-q').toLowerCase();
    const pivoId=v('lft-filtro-pivo');
    const casaBombaId=v('lft-filtro-cb');
    const fazendaId=v('lft-filtro-faz');

    let base;
    if(pivoId) base=fertiPorPivo(pivoId);
    else if(casaBombaId) base=fertiPorCasaBomba(casaBombaId);
    else if(fazendaId) base=fertiPorFazenda(fazendaId);
    else base=fertiAtivos();

    const filtrados=base.filter(r=>{
      if(!q) return true;
      const pivo=horimetroPivoInfo(r.pivoId), produto=fertiProdutoInfo(r.produtoId);
      return String(pivo?pivo.numero:'').includes(q)||(produto&&produto.nome.toLowerCase().includes(q))||(r.cultura||'').toLowerCase().includes(q);
    }).sort((a,b)=>b.data.localeCompare(a.data));

    document.getElementById('lft-cnt').textContent=filtrados.length.toLocaleString('pt-BR')+' registros';

    const resumoWrap=document.getElementById('lft-resumo');
    if(pivoId){
      resumoWrap.style.display='';
      const resumo=fertiResumoPivo(pivoId);
      document.getElementById('lft-resumo-kpis').innerHTML=
        kpi('Quantidade Acumulada',fmt(resumo.quantidadeAcumulada,1),'','',null,null,'kpi-purple')+
        kpi('Frequência',resumo.frequencia,'','aplicações',null,null,'kpi-teal')+
        kpi('Média por Aplicação',fmt(resumo.mediaPorAplicacao,2),'','',null,null,'kpi-sky')+
        kpi('Média Mensal',fmt(resumo.mediaMensal,1),'','',null,null,'kpi-green');
      document.getElementById('lft-resumo-evolucao').innerHTML=lineChart([{lbl:'Quantidade',pts:resumo.linhaDoTempo.map(p=>({x:fmtD(p.data).slice(0,5),y:p.quantidade})),c:'#7c3aed'}],120);
      document.getElementById('lft-resumo-produtos').innerHTML=barH(resumo.porProduto.slice(0,8).map(r=>({l:r.produto,v:r.quantidade,c:'#7c3aed',dec:1})),110);
    }else{
      resumoWrap.style.display='none';
    }

    const PER=20;
    const pagina=filtrados.slice(this.pagina*PER,(this.pagina+1)*PER);
    document.getElementById('lft-tbl').innerHTML=pagina.length?`<table class="table"><thead><tr><th>Data</th><th>Pivô</th><th>Produto</th><th>Cultura</th><th style="text-align:right">Quantidade</th><th style="text-align:right">Tempo</th><th>Operador</th><th style="text-align:right">Versão</th><th style="text-align:right">Ações</th></tr></thead><tbody>${pagina.map(r=>{
      const pivo=horimetroPivoInfo(r.pivoId), produto=fertiProdutoInfo(r.produtoId), unidade=produto?cadLookupLabel('unidadesMedida',produto.unidadeId):'';
      return `<tr class="${isRecent24h(r.criadoEm)?'op-recent':''}"><td>${isRecent24h(r.criadoEm)?'<span class="op-recent-dot" title="Registrado nas últimas 24h"></span>':''}${fmtD(r.data)}</td><td><span class="badge b-brand">P.${pivo?pivo.numero:'?'}</span></td><td>${produto?produto.nome:'—'}</td><td><span class="badge b-success">${r.cultura||'—'}</span></td><td style="text-align:right;font-weight:700;color:#7c3aed">${fmt(r.quantidadeAplicada,2)} ${unidade}</td><td style="text-align:right">${r.tempoAplicacaoHoras!=null?fmt(r.tempoAplicacaoHoras,1)+'h':'—'}</td><td>${r.operador||'—'}</td><td style="text-align:right;color:var(--text-tertiary);${r.versao>1?'cursor:pointer;text-decoration:underline':''}" ${r.versao>1?`onclick="lft.verVersoes('${r.grupoId}')" title="Ver versões anteriores"`:''}>v${r.versao}</td><td style="text-align:right;white-space:nowrap">${lancAcoesHtml('lft',r.grupoId)}</td></tr>`;
    }).join('')}</tbody></table>`:emEl('Nenhuma fertirrigação registrada ainda.');
    pag('lft-pg',filtrados.length,this.pagina,p=>{ this.pagina=p; this.render(); });
  },
  clear(){
    ['lft-q','lft-filtro-pivo','lft-filtro-faz','lft-filtro-cb'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    this.pagina=0;
    this.render();
  },
};

/* ── CALIBRAÇÃO DE LÂMINA (aba "Calibração de Lâmina" de Lançamentos) ──
   Fazenda/Casa de Bomba derivadas do Pivô. Ao salvar, o serviço já
   atualiza sozinho `laminaBase100` no cadastro do pivô — esta tela só
   mostra o valor atual como referência, nunca o edita diretamente.
   ──────────────────────────────────────────────────────────────── */
const lc={
  editandoGrupoId:null,
  pagina:0,

  onFaz(){
    const faz=v('lc-faz');
    const pivoSel=document.getElementById('lc-pivo');
    document.getElementById('lc-casabomba').value='';
    document.getElementById('lc-lamina-atual').value='';
    if(!faz){ pivoSel.innerHTML='<option value="">Selecione a fazenda</option>'; pivoSel.disabled=true; return; }
    const fazRec=(cadAll('fazendas')||[]).find(f=>f.nome===faz);
    const pivos=(cadAll('pivos')||[]).filter(p=>p.fazendaId===(fazRec&&fazRec.id)).sort((a,b)=>a.numero-b.numero);
    pivoSel.innerHTML='<option value="">Selecione...</option>'+pivos.map(p=>`<option value="${p.id}">P.${p.numero}</option>`).join('');
    pivoSel.disabled=false;
  },
  onPivo(){
    const pivo=horimetroPivoInfo(v('lc-pivo'));
    document.getElementById('lc-casabomba').value=pivo&&pivo.casaBombaId?cadLookupLabel('casasBomba',pivo.casaBombaId):'—';
    document.getElementById('lc-lamina-atual').value=pivo&&pivo.laminaBase100?fmt(pivo.laminaBase100,2)+' mm':'—';
    this.calc();
  },
  calc(){
    const pct=v('lc-percentual'), medida=v('lc-lamina-medida');
    const calculada=(pct!==''&&medida!==''&&percentualValido(pct))?calcLaminaBase100(pct,medida):null;
    document.getElementById('lc-calculada-display').textContent=calculada!=null?fmt(calculada,2)+' mm':'—';

    const pivo=horimetroPivoInfo(v('lc-pivo'));
    const anterior=pivo?pivo.laminaBase100:null;
    if(calculada!=null&&anterior){
      const variacao=calcVariacao(anterior,calculada);
      document.getElementById('lc-diferenca').value=variacao.diferenca!=null?`${variacao.diferenca>0?'+':''}${fmt(variacao.diferenca,2)} mm`:'—';
      document.getElementById('lc-variacao').value=variacao.percentual!=null?`${variacao.percentual>0?'+':''}${variacao.percentual}%`:'—';
    }else{
      document.getElementById('lc-diferenca').value='—';
      document.getElementById('lc-variacao').value='—';
    }
  },

  limpar(){
    this.editandoGrupoId=null;
    ['lc-hora','lc-faz','lc-percentual','lc-lamina-medida','lc-oper','lc-responsavel','lc-obs'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('lc-data').value=today();
    document.getElementById('lc-metodo').value=METODOS_CALIBRACAO[0];
    const pivoSel=document.getElementById('lc-pivo');
    pivoSel.innerHTML='<option value="">Selecione a fazenda</option>'; pivoSel.disabled=true;
    document.getElementById('lc-casabomba').value='';
    document.getElementById('lc-lamina-atual').value='';
    document.getElementById('lc-calculada-display').textContent='—';
    document.getElementById('lc-diferenca').value='—';
    document.getElementById('lc-variacao').value='—';
    document.getElementById('lc-salvar-lbl').textContent='Registrar Calibração';
  },

  salvar(){
    if(bloquearSemPermissao('lancamentos','edit')) return;
    const dados={
      pivoId:v('lc-pivo'), data:v('lc-data'), hora:v('lc-hora'),
      operador:v('lc-oper'), responsavelCalibracao:v('lc-responsavel'),
      laminaMedida:v('lc-lamina-medida'), percentualUtilizado:v('lc-percentual'),
      metodoCalibracao:v('lc-metodo'), observacoes:v('lc-obs'),
    };
    const resultado=this.editandoGrupoId?calibracaoAtualizar(this.editandoGrupoId,dados):calibracaoCriar(dados);
    if(!resultado.ok){ toast((resultado.erros&&resultado.erros[0])||'Não foi possível salvar.','err'); return; }

    toast(this.editandoGrupoId?'Calibração atualizada — lâmina do pivô já foi ajustada.':'Calibração registrada — lâmina do pivô já foi ajustada.','ok');
    this.editandoGrupoId=null;
    this.limpar();
    this.render();
  },

  editar(grupoId){
    const reg=calibracaoTodos().find(r=>r.grupoId===grupoId&&r.atual);
    if(!reg) return;
    opPulseCard('#lhm-panel-calibracao','op-edit-pulse');
    this.editandoGrupoId=grupoId;
    const pivo=horimetroPivoInfo(reg.pivoId);
    document.getElementById('lc-faz').value=pivo?cadLookupLabel('fazendas',pivo.fazendaId):'';
    this.onFaz();
    document.getElementById('lc-pivo').value=reg.pivoId;
    this.onPivo();
    document.getElementById('lc-data').value=reg.data;
    document.getElementById('lc-hora').value=reg.hora;
    document.getElementById('lc-percentual').value=reg.percentualUtilizado;
    document.getElementById('lc-lamina-medida').value=reg.laminaMedida;
    document.getElementById('lc-oper').value=reg.operador||'';
    document.getElementById('lc-responsavel').value=reg.responsavelCalibracao||'';
    document.getElementById('lc-metodo').value=reg.metodoCalibracao;
    document.getElementById('lc-obs').value=reg.observacoes||'';
    this.calc();
    document.getElementById('lc-salvar-lbl').textContent='Salvar Alteração';
    toast('Editando calibração — uma nova versão será criada ao salvar.','info');
  },
  excluir(grupoId,btn){
    if(bloquearSemPermissao('lancamentos','delete')) return;
    if(!confirm('Excluir esta calibração? Ela some das consultas, mas o registro fica guardado e a exclusão vai para a auditoria.')) return;
    opFadeRowThen(btn,()=>{
      const resultado=calibracaoExcluir(grupoId);
      if(resultado.ok){ auditoriaRegistrar('EXCLUSÃO','Calibração',grupoId,'Calibração excluída.'); toast('Calibração excluída.','ok'); this.render(); }
    });
  },
  verVersoes(grupoId){
    const versoes=calibracaoHistoricoVersoes(grupoId);
    const itens=versoes.map(v=>({versao:v.versao,atual:v.atual,status:v.status,
      linha:`${fmtD(v.data)} ${v.hora} — lâmina a 100%: ${fmt(v.laminaCalculada100,2)}mm${v.percentualVariacao!=null?` (${v.percentualVariacao>0?'+':''}${v.percentualVariacao}%)`:''}`}));
    showVersoesModal('Histórico de Versões — Calibração de Lâmina',itens);
  },

  render(){
    const pivoId=v('lc-filtro-pivo'), fazendaId=v('lc-filtro-faz');
    let base;
    if(pivoId) base=calibracaoPorPivo(pivoId);
    else if(fazendaId) base=calibracaoPorFazenda(fazendaId);
    else base=calibracaoAtivas();

    const registros=base.slice().sort((a,b)=>(b.data+b.hora).localeCompare(a.data+a.hora));
    document.getElementById('lc-cnt').textContent=registros.length.toLocaleString('pt-BR')+' calibrações';

    const resumoWrap=document.getElementById('lc-resumo');
    if(pivoId){
      resumoWrap.style.display='';
      const historico=calibracaoPorPivo(pivoId);
      const ultima=historico[historico.length-1];
      document.getElementById('lc-resumo-kpis').innerHTML=
        kpi('Última Calibração',ultima?fmtD(ultima.data):'—','','',null,null,'kpi-teal')+
        kpi('Lâmina a 100% Atual',ultima?fmt(ultima.laminaCalculada100,2):'—','mm','',null,null,'kpi-green')+
        kpi('Quantidade de Calibrações',historico.length,'','',null,null,'kpi-sky');
      document.getElementById('lc-resumo-evolucao').innerHTML=lineChart([{lbl:'Lâmina a 100%',pts:calibracaoEvolucaoPivo(pivoId).map(p=>({x:fmtD(p.data).slice(0,5),y:p.laminaCalculada100})),c:'var(--brand-600)'}],120);
    }else{
      resumoWrap.style.display='none';
    }

    const PER=20;
    const pagina=registros.slice(this.pagina*PER,(this.pagina+1)*PER);
    document.getElementById('lc-tbl').innerHTML=pagina.length?`<table class="table"><thead><tr><th>Data</th><th>Hora</th><th>Pivô</th><th style="text-align:right">% Utilizado</th><th style="text-align:right">Lâmina Medida</th><th style="text-align:right">Lâmina a 100%</th><th style="text-align:right">Variação</th><th>Método</th><th style="text-align:right">Versão</th><th style="text-align:right">Ações</th></tr></thead><tbody>${pagina.map(r=>{
      const pivo=horimetroPivoInfo(r.pivoId);
      return `<tr class="${isRecent24h(r.criadoEm)?'op-recent':''}"><td>${isRecent24h(r.criadoEm)?'<span class="op-recent-dot" title="Registrado nas últimas 24h"></span>':''}${fmtD(r.data)}</td><td>${r.hora}</td><td><span class="badge b-brand">P.${pivo?pivo.numero:'?'}</span></td><td style="text-align:right">${r.percentualUtilizado}%</td><td style="text-align:right">${fmt(r.laminaMedida,2)}</td><td style="text-align:right;font-weight:700;color:var(--brand-600)">${fmt(r.laminaCalculada100,2)}</td><td style="text-align:right">${r.percentualVariacao!=null?`${r.percentualVariacao>0?'+':''}${r.percentualVariacao}%`:'—'}</td><td style="font-size:11px">${r.metodoCalibracao}</td><td style="text-align:right;color:var(--text-tertiary);${r.versao>1?'cursor:pointer;text-decoration:underline':''}" ${r.versao>1?`onclick="lc.verVersoes('${r.grupoId}')" title="Ver versões anteriores"`:''}>v${r.versao}</td><td style="text-align:right;white-space:nowrap">${lancAcoesHtml('lc',r.grupoId)}</td></tr>`;
    }).join('')}</tbody></table>`:emEl('Nenhuma calibração registrada ainda.');
    pag('lc-pg',registros.length,this.pagina,p=>{ this.pagina=p; this.render(); });
  },
  clear(){
    ['lc-filtro-faz','lc-filtro-pivo'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    this.pagina=0;
    this.render();
  },
};
