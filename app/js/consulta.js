/* ── CONSULTA OPERACIONAL (Sprint 01.3) ────────────────────────────
   Só renderização/filtro: nenhum Service novo, nenhuma regra de negócio
   nova. Une os 5 lançamentos já existentes (horimetroAtivos/paradaAtivas/
   indicadorAtivos/fertiAtivos/calibracaoAtivas, todos em js/services/*.js)
   numa única lista normalizada, para permitir um só painel de filtros +
   tabela + detalhe em vez de 5 abas separadas. A Base ETL histórica
   (EXE_D/ITV_D/HOR_D/FAL_D/FERTI_D) continua intacta na seção recolhível
   "Base ETL Histórica" — não é tocada por este arquivo.

   "Histórico daquele lançamento" reaproveita EXATAMENTE os controllers
   já existentes (lhm/lhf/lp/lft/lc.verVersoes → showVersoesModal), sem
   reescrever a consulta de versões para cada tipo.
   ──────────────────────────────────────────────────────────────── */

const DQ_TIPO_BADGE={'Horímetro':'b-success','Parada':'b-danger','Falha':'b-warning','Fertirrigação':'b-info','Calibração':'b-purple'};
const DQ_TIPO_ROWCLASS={'Horímetro':'dq-row-horimetro','Parada':'dq-row-parada','Falha':'dq-row-falha','Fertirrigação':'dq-row-ferti','Calibração':'dq-row-calibracao'};
const DQ_CRITICIDADE_BADGE={Baixa:'b-success',Média:'b-warning',Alta:'b-danger'};

/* Cada lançamento vira um registro normalizado com os mesmos campos,
   para a tabela/filtro/detalhe não precisarem saber de onde ele veio. */
function dqRegistroBase(tipo,r,extra){
  const pivo=horimetroPivoInfo(r.pivoId);
  return Object.assign({
    tipo, grupoId:r.grupoId, versao:r.versao, data:r.data, criadoEm:r.criadoEm,
    pivoId:r.pivoId, pivo,
    fazendaId:pivo?pivo.fazendaId:null,
    casaBombaId:pivo?pivo.casaBombaId:null,
    cultura:r.cultura||'',
    observacao:r.observacao||r.observacoes||'',
    responsavel:'—', horario:'—', tempo:null, motivo:null, criticidade:null,
    situacaoLabel:null, situacaoBadge:'b-neutral',
    raw:r,
  },extra);
}

function dqBuildRegistros(){
  const horimetro=horimetroAtivos().map(r=>dqRegistroBase('Horímetro',r,{
    responsavel:r.operador||'—', horario:r.horaInicio||'—', tempo:r.horas,
    horasIrrigadas:r.horas, situacaoLabel:'Executado', situacaoBadge:'b-success',
  }));
  const parada=paradaAtivas().map(r=>{
    const falha=indicadorFalhaInfo(r.falhaId);
    return dqRegistroBase('Parada',r,{
      responsavel:r.tecnicoId?cadLookupLabel('tecnicos',r.tecnicoId):(r.operador||'—'),
      horario:`${r.horaInicial||'—'}–${r.horaFinal||'—'}`, tempo:r.tempoParadoHoras,
      motivo:falha?`${falha.categoria} — ${falha.motivo}`:null,
      criticidade:falha?falha.criticidade:null,
      situacaoLabel:falha?falha.criticidade:'—', situacaoBadge:falha?(DQ_CRITICIDADE_BADGE[falha.criticidade]||'b-neutral'):'b-neutral',
    });
  });
  const falha=indicadorAtivos().map(r=>{
    const fa=indicadorFalhaInfo(r.falhaId);
    return dqRegistroBase('Falha',r,{
      motivo:fa?`${fa.categoria} — ${fa.motivo}`:null,
      criticidade:fa?fa.criticidade:null,
      situacaoLabel:fa?fa.criticidade:'—', situacaoBadge:fa?(DQ_CRITICIDADE_BADGE[fa.criticidade]||'b-neutral'):'b-neutral',
    });
  });
  const ferti=fertiAtivos().map(r=>dqRegistroBase('Fertirrigação',r,{
    responsavel:r.operador||'—', horario:`${r.horaInicial||'—'}–${r.horaFinal||'—'}`, tempo:r.tempoAplicacaoHoras,
    situacaoLabel:'Aplicado', situacaoBadge:'b-info',
  }));
  const calibracao=calibracaoAtivas().map(r=>dqRegistroBase('Calibração',r,{
    responsavel:r.responsavelCalibracao||r.operador||'—', horario:r.hora||'—',
    situacaoLabel:'Calibrado', situacaoBadge:'b-purple',
  }));
  return [...horimetro,...parada,...falha,...ferti,...calibracao];
}

function dqFiltrar(todos){
  todos=todos||dqBuildRegistros();
  const faz=v('dq-faz'), cb=v('dq-cb'), pivo=v('dq-pivo'), cultura=v('dq-cultura'),
        d1=v('dq-d1'), d2=v('dq-d2'), tipo=v('dq-tipo'), resp=v('dq-resp'),
        status=v('dq-status'), q=(v('dq-q')||'').toLowerCase().trim();
  return todos.filter(r=>{
    if(faz&&r.fazendaId!==faz) return false;
    if(cb&&r.casaBombaId!==cb) return false;
    if(pivo&&r.pivoId!==pivo) return false;
    if(cultura&&r.cultura!==cultura) return false;
    if(d1&&r.data<d1) return false;
    if(d2&&r.data>d2) return false;
    if(tipo&&r.tipo!==tipo) return false;
    if(resp&&r.responsavel!==resp) return false;
    if(status&&r.criticidade!==status) return false;
    if(q){
      const fazNome=r.fazendaId?cadLookupLabel('fazendas',r.fazendaId):'';
      const hay=[r.pivo?'P.'+r.pivo.numero:'',fazNome,r.cultura,r.observacao,r.motivo,r.responsavel].filter(Boolean).join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}

const dq={
  pagina:0, ordCampo:'data', ordDir:'desc', selecionadoIdx:null, registrosFiltrados:[],
  PER:50, /* mesmo tamanho de página já usado por pag()/filters.js (PER=50) — evita descompasso entre a paginação e o slice da tabela */

  init(){
    /* Constrói a lista unificada uma única vez e reaproveita tanto para
       popular o select de Responsável quanto para o primeiro render —
       evita montar os mesmos 5 lançamentos duas vezes seguidas. */
    const todos=dqBuildRegistros();
    this.popularResponsaveis(todos);
    this.pagina=0; this.selecionadoIdx=null;
    this.render(todos);
  },
  popularResponsaveis(todos){
    const nomes=[...new Set((todos||dqBuildRegistros()).map(r=>r.responsavel).filter(n=>n&&n!=='—'))].sort();
    fillSelect('dq-resp',nomes.map(n=>`<option>${n}</option>`).join(''),'Todos');
  },
  aplicarFiltros(){ this.pagina=0; this.selecionadoIdx=null; this.render(); },
  limparFiltros(){
    ['dq-faz','dq-cb','dq-pivo','dq-cultura','dq-d1','dq-d2','dq-tipo','dq-resp','dq-status','dq-q'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.value='';
    });
    this.aplicarFiltros();
  },
  setPeriodo(tipo){
    const hoje=today();
    let ini=hoje, fim=hoje;
    if(tipo==='semana'){ const s=semanaAtual(); ini=s.inicio; fim=s.fim; }
    if(tipo==='mes'){ ini=hoje.slice(0,7)+'-01'; }
    document.getElementById('dq-d1').value=ini;
    document.getElementById('dq-d2').value=fim;
    this.aplicarFiltros();
  },
  ordenarPor(campo){
    if(this.ordCampo===campo) this.ordDir=this.ordDir==='asc'?'desc':'asc';
    else { this.ordCampo=campo; this.ordDir='asc'; }
    this.render();
  },

  render(todosPreCarregados){
    const filtrados=dqFiltrar(todosPreCarregados);
    const campo=this.ordCampo, dir=this.ordDir==='asc'?1:-1;
    filtrados.sort((a,b)=>{
      if(campo==='tempo'){ return ((a.tempo||0)-(b.tempo||0))*dir; }
      if(campo==='data'){ const av=a.data+(a.criadoEm||''), bv=b.data+(b.criadoEm||''); return av<bv?-1*dir:av>bv?1*dir:0; }
      const av=String(a[campo]||''), bv=String(b[campo]||'');
      return av<bv?-1*dir:av>bv?1*dir:0;
    });
    this.registrosFiltrados=filtrados;
    this.renderResumo(filtrados);
    this.renderTabela();
    this.renderDetalhe();
    this.renderRodape(filtrados);
  },

  renderResumo(filtrados){
    const box=document.getElementById('dq-resumo'); if(!box) return;
    const porTipo=t=>filtrados.filter(r=>r.tipo===t);
    const horasIrrigadas=calcAcumulado(porTipo('Horímetro').map(r=>r.raw),'horas');
    const d1=v('dq-d1')||undefined, d2=v('dq-d2')||undefined;
    const resumoPlan=planejamentoResumo(d1,d2);

    box.innerHTML=[
      execKpiCard({label:'Registros Encontrados',icon:'fileText',value:filtrados.length}),
      execKpiCard({label:'Horas Irrigadas',icon:'droplet',value:fmt(horasIrrigadas,1),unit:'h',color:'c-green'}),
      execKpiCard({label:'Paradas Registradas',icon:'pause',value:porTipo('Parada').length,color:porTipo('Parada').length?'c-amber':'c-green'}),
      execKpiCard({label:'Falhas',icon:'alert',value:porTipo('Falha').length,color:porTipo('Falha').length?'c-amber':'c-green'}),
      execKpiCard({label:'Fertirrigações',icon:'droplet',value:porTipo('Fertirrigação').length}),
      execKpiCard({label:'Calibrações',icon:'gaugeCal',value:porTipo('Calibração').length}),
      execKpiCard({label:'Planejados',icon:'calendar',value:resumoPlan.total}),
      execKpiCard({label:'Executados',icon:'droplet',value:resumoPlan.feito,color:'c-green'}),
      execKpiCard({label:'Pendentes',icon:'alert',value:resumoPlan.pendente,color:resumoPlan.pendente?'c-amber':'c-green'}),
    ].join('');
  },

  renderTabela(){
    const box=document.getElementById('dq-tbl'); if(!box) return;
    const total=this.registrosFiltrados.length;
    document.getElementById('dq-cnt').textContent=total.toLocaleString('pt-BR')+' registros';
    const pagina=this.registrosFiltrados.slice(this.pagina*this.PER,(this.pagina+1)*this.PER);
    const seta=campo=>this.ordCampo===campo?(this.ordDir==='asc'?' ▲':' ▼'):'';

    box.innerHTML=pagina.length?`<table class="table dq-table">
      <thead><tr>
        <th class="dq-sortable" onclick="dq.ordenarPor('data')">Data${seta('data')}</th>
        <th>Fazenda</th>
        <th>Equipamento</th>
        <th>Casa de Bomba</th>
        <th>Cultura</th>
        <th class="dq-sortable" onclick="dq.ordenarPor('tipo')">Tipo${seta('tipo')}</th>
        <th>Situação</th>
        <th class="dq-sortable" onclick="dq.ordenarPor('responsavel')">Responsável${seta('responsavel')}</th>
        <th>Observação</th>
      </tr></thead>
      <tbody>${pagina.map((r,i)=>{
        const idxReal=this.pagina*this.PER+i;
        const pivoLbl=r.pivo?`P.${r.pivo.numero}`:'—';
        const fazLbl=r.fazendaId?cadLookupLabel('fazendas',r.fazendaId):'—';
        const cbLbl=r.casaBombaId?cadLookupLabel('casasBomba',r.casaBombaId):'—';
        const obsEsc=(r.observacao||'').replace(/"/g,'&quot;');
        return `<tr class="dq-row ${DQ_TIPO_ROWCLASS[r.tipo]}${this.selecionadoIdx===idxReal?' selected':''}" onclick="dq.selecionar(${idxReal})">
          <td style="white-space:nowrap">${fmtD(r.data)}</td>
          <td>${fazLbl}</td>
          <td><span class="badge b-brand">${pivoLbl}</span></td>
          <td>${cbLbl}</td>
          <td>${r.cultura||'—'}</td>
          <td><span class="badge ${DQ_TIPO_BADGE[r.tipo]}">${r.tipo}</span></td>
          <td>${r.situacaoLabel?`<span class="badge ${r.situacaoBadge}">${r.situacaoLabel}</span>`:'—'}</td>
          <td>${r.responsavel||'—'}</td>
          <td class="dq-obs-cell" title="${obsEsc}">${r.observacao||'—'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`:emEl('Nenhum lançamento encontrado com os filtros atuais.');

    pag('dq-pg',total,this.pagina,p=>{ dq.pagina=p; dq.renderTabela(); });
  },

  selecionar(idx){
    this.selecionadoIdx=(this.selecionadoIdx===idx)?null:idx;
    this.renderTabela();
    this.renderDetalhe();
  },

  renderDetalhe(){
    const box=document.getElementById('dq-detail-body'); if(!box) return;
    if(this.selecionadoIdx==null||!this.registrosFiltrados[this.selecionadoIdx]){
      box.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;gap:.5rem;padding:1.3rem .5rem;color:var(--text-tertiary)">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="var(--border-strong)" stroke-width="1"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        <span style="font-size:12px;text-align:center">Selecione um lançamento na tabela para ver os detalhes.</span>
      </div>`;
      return;
    }
    const r=this.registrosFiltrados[this.selecionadoIdx];
    const pivoLbl=r.pivo?`P.${r.pivo.numero}`:'—';
    const fazLbl=r.fazendaId?cadLookupLabel('fazendas',r.fazendaId):'—';
    const cbLbl=r.casaBombaId?cadLookupLabel('casasBomba',r.casaBombaId):null;

    const linhas=[
      ['Tipo',`<span class="badge ${DQ_TIPO_BADGE[r.tipo]}">${r.tipo}</span>`],
      ['Equipamento',`${pivoLbl} · ${fazLbl}${cbLbl?' · '+cbLbl:''}`],
      ['Responsável',r.responsavel||'—'],
      ['Horário',r.horario||'—'],
      ['Tempo',r.tempo!=null?`${fmt(r.tempo,2)}h`:'—'],
    ];
    if(r.tipo==='Horímetro') linhas.push(['Horas Irrigadas',`${fmt(r.horasIrrigadas,1)}h`]);
    if(r.motivo) linhas.push(['Motivo da Parada',r.motivo]);
    linhas.push(['Observações',r.observacao||'—']);
    linhas.push(['Data',fmtD(r.data)]);
    linhas.push(['Versão','v'+r.versao]);

    box.innerHTML=`<div style="display:flex;flex-direction:column;gap:.55rem;font-size:12px">
      ${linhas.map(([l,val])=>`<div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--text-tertiary);flex-shrink:0">${l}</span><span style="text-align:right">${val}</span></div>`).join('')}
      <div style="height:1px;background:var(--border);margin:.3rem 0"></div>
      <button class="btn btn-secondary btn-xs" style="width:100%" onclick="dq.verHistorico('${r.tipo}','${r.grupoId}')">Ver histórico de versões</button>
    </div>`;
  },

  /* Reaproveita os controllers já existentes de Lançamentos — cada um já
     sabe montar seu próprio histórico de versões e abrir o mesmo modal
     global (showVersoesModal). Nenhuma consulta de versão é duplicada aqui. */
  verHistorico(tipo,grupoId){
    const ctrl={'Horímetro':lhm,'Parada':lp,'Falha':lhf,'Fertirrigação':lft,'Calibração':lc}[tipo];
    if(ctrl&&typeof ctrl.verVersoes==='function') ctrl.verVersoes(grupoId);
  },

  renderRodape(filtrados){
    const box=document.getElementById('dq-footer'); if(!box) return;
    const d1=v('dq-d1'), d2=v('dq-d2');
    const periodoTxt=(d1||d2)?`${d1?fmtD(d1):'início'} — ${d2?fmtD(d2):'hoje'}`:'Todo o histórico disponível';
    const ultimaCriadoEm=filtrados.reduce((max,r)=>(r.criadoEm&&r.criadoEm>max)?r.criadoEm:max,'');
    box.innerHTML=`
      <div class="dq-footer-item"><span class="l">Registros</span><span class="v">${filtrados.length.toLocaleString('pt-BR')}</span></div>
      <div class="dq-footer-item"><span class="l">Período consultado</span><span class="v">${periodoTxt}</span></div>
      <div class="dq-footer-item"><span class="l">Última atualização</span><span class="v">${ultimaCriadoEm?fmtD(ultimaCriadoEm.slice(0,10))+' · '+horaDe(ultimaCriadoEm):'—'}</span></div>
      <div class="dq-footer-item"><span class="l">Origem dos dados</span><span class="v">Lançamentos operacionais da equipe (Horímetro, Parada, Falha/Indicador, Fertirrigação, Calibração)</span></div>
    `;
  },
};

/* ── BASE ETL HISTÓRICA — recolhível (Sprint 01.3) ─────────────────
   Mesmo padrão já usado em "Analítico Consolidado" (#page-exec,
   toggleExecAnalitico/restoreExecAnaliticoState) — aqui recolhido por
   padrão porque deixou de ser o conteúdo principal da tela: o dado real
   e atual é a consulta unificada acima, isto é só o arquivo histórico
   importado em lote. */
function dqToggleLegado(){
  const body=document.getElementById('dq-legado-body');
  const chev=document.getElementById('dq-legado-chevron');
  if(!body) return;
  const aberto=body.style.display==='none';
  body.style.display=aberto?'':'none';
  if(chev) chev.style.transform=aberto?'rotate(180deg)':'';
  localStorage.setItem('coi_dq_legado_aberto',aberto?'1':'0');
}
function restoreDqLegadoState(){
  const body=document.getElementById('dq-legado-body');
  const chev=document.getElementById('dq-legado-chevron');
  if(!body) return;
  const aberto=localStorage.getItem('coi_dq_legado_aberto')==='1';
  body.style.display=aberto?'':'none';
  if(chev) chev.style.transform=aberto?'rotate(180deg)':'';
}
