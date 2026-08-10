/* ── IMPORTAÇÃO DE PLANEJAMENTO (tela) ─────────────────────────────
   Só interface: lê o arquivo escolhido e delega parsing/validação/
   efetivação para js/services/importacao.js. Nunca grava no storage
   diretamente — isso é responsabilidade exclusiva do serviço.
   ──────────────────────────────────────────────────────────────── */
const imp={
  preview:null,

  init(){
    const el=document.getElementById('imp-colunas-opcionais');
    if(el) el.textContent=IMPORT_COLUNAS_OPCIONAIS.join(', ');
  },

  arquivoSelecionado(input){
    const arquivo=input.files&&input.files[0];
    if(!arquivo) return;
    toast('Lendo arquivo...','info');
    importacaoParsearArquivo(arquivo)
      .then(linhas=>{
        if(!linhas.length){ toast('Arquivo vazio.','warn'); return; }
        const colunasErro=importacaoValidarColunas(linhas);
        if(colunasErro.length){ toast(colunasErro[0],'err'); return; }
        this.preview=importacaoPreVisualizar(linhas);
        this.render();
        toast(`${linhas.length} linha(s) lida(s) do arquivo.`,'ok');
      })
      .catch(err=>{ console.error(err); toast(err.message||'Não foi possível ler o arquivo.','err'); });
  },

  limpar(){
    this.preview=null;
    document.getElementById('imp-arquivo').value='';
    document.getElementById('imp-resultado').style.display='none';
  },

  corrigirCampo(indice,campo,valor){
    const item=this.preview.linhas[indice];
    const chaveOriginal=Object.keys(item.dados).find(k=>normalizarTexto(k)===campo)||campo;
    item.dados[chaveOriginal]=valor;
  },

  revalidar(indice){
    importacaoRevalidarLinha(this.preview.linhas[indice]);
    this.render();
  },

  async importar(){
    if(!this.preview||!this.preview.linhasValidas){ toast('Nenhuma linha válida para importar.','warn'); return; }
    const resultado=await importacaoCommitar(this.preview);
    toast(`${resultado.sucesso} registro(s) importado(s)${resultado.falhas?`, ${resultado.falhas} falharam`:''}.`,resultado.falhas?'warn':'ok');
    this.limpar();
  },

  render(){
    const p=this.preview;
    document.getElementById('imp-resultado').style.display=p?'':'none';
    if(!p) return;

    document.getElementById('imp-kpis').innerHTML=
      kpi('Registros no Arquivo',p.totalLinhas,'','',null,null,'kpi-teal')+
      kpi('Linhas Válidas',p.linhasValidas,'','prontas para importar',null,null,'kpi-green')+
      kpi('Linhas Inválidas',p.linhasInvalidas,'','precisam de correção',null,null,'kpi-red')+
      kpi('Erros',p.totalErros,'','',null,null,'kpi-red')+
      kpi('Avisos',p.totalAvisos,'','',null,null,'kpi-amber');

    document.getElementById('imp-tbl').innerHTML=`<table class="table"><thead><tr>
      <th>Linha</th><th>Data</th><th>Pivô</th><th>%</th><th>Cultura</th><th>Área</th><th>Fazenda</th><th>Casa de Bomba</th><th>Operador</th><th>Status</th>
      </tr></thead><tbody>${p.linhas.map((item,i)=>this.linhaHtml(item,i)).join('')}</tbody></table>`;
  },

  linhaHtml(item,indice){
    const campo=nome=>importacaoCampo(item.dados,nome);
    const camposEditaveis=['data','pivo','percentual','cultura','area','fazenda','casabomba','operador'];
    const cor=item.valido?'':'background:color-mix(in srgb,var(--c-danger) 6%,transparent)';
    const celula=nome=>item.valido
      ?`<td>${campo(nome)||'—'}</td>`
      :`<td><input type="text" class="input" style="height:26px;font-size:11px;min-width:80px" value="${(campo(nome)??'').toString().replace(/"/g,'&quot;')}" onchange="imp.corrigirCampo(${indice},'${nome}',this.value)"></td>`;

    const status=item.valido
      ?`<span class="badge b-success">Válida</span>${item.avisos.length?`<div style="font-size:10px;color:var(--c-warning-d);margin-top:2px">${item.avisos.join('<br>')}</div>`:''}`
      :`<span class="badge b-danger">Erro</span><div style="font-size:10px;color:var(--c-danger);margin-top:2px">${item.erros.join('<br>')}</div><button class="btn btn-ghost btn-xs" style="margin-top:4px" onclick="imp.revalidar(${indice})">Revalidar</button>`;

    return `<tr style="${cor}"><td>${item.linha}</td>${camposEditaveis.map(celula).join('')}<td style="min-width:160px">${status}</td></tr>`;
  },
};

/* ── PLANEJAMENTO — VISUALIZAÇÃO/EXCLUSÃO (aba Planejado × Executado) ──
   Consulta e exclusão dos registros de planejamento (criados pela
   Importação ou, futuramente, por lançamento manual). Só chama
   js/services/planejamento.js.
   ──────────────────────────────────────────────────────────────── */
const planUI={
  pagina:0,

  buildSelects(){
    if(this._selectsBuilt) return;
    const fazendas=cadAll('fazendas')||[];
    fillSelect('plan-filtro-faz',fazendas.map(f=>`<option value="${f.id}">${f.nome}</option>`).join(''),'Fazenda');
    const pivos=(cadAll('pivos')||[]).slice().sort((a,b)=>a.numero-b.numero);
    fillSelect('plan-filtro-pivo',pivos.map(p=>`<option value="${p.id}">P.${p.numero}</option>`).join(''),'Pivô');
    this._selectsBuilt=true;
  },

  render(){
    this.buildSelects();
    const pivoId=v('plan-filtro-pivo'), fazendaId=v('plan-filtro-faz');
    let base;
    if(pivoId) base=planejamentoPorPivo(pivoId);
    else if(fazendaId) base=planejamentoPorFazenda(fazendaId);
    else base=planejamentoAtivos();

    const registros=base.slice().sort((a,b)=>b.data.localeCompare(a.data));
    document.getElementById('plan-cnt').textContent=registros.length.toLocaleString('pt-BR')+' registros';

    const executados=new Set(horimetroAtivos().map(r=>r.pivoId+'_'+r.data));
    const PER=20;
    const pagina=registros.slice(this.pagina*PER,(this.pagina+1)*PER);
    document.getElementById('plan-tbl').innerHTML=pagina.length?`<table class="table"><thead><tr><th>Data</th><th>Pivô</th><th style="text-align:right">%</th><th>Cultura</th><th>Área</th><th>Status</th><th style="text-align:right">Versão</th><th style="text-align:right">Ações</th></tr></thead><tbody>${pagina.map(r=>{
      const pivo=horimetroPivoInfo(r.pivoId);
      const feito=executados.has(r.pivoId+'_'+r.data);
      return `<tr><td>${fmtD(r.data)}</td><td><span class="badge b-brand">P.${pivo?pivo.numero:'?'}</span></td><td style="text-align:right">${r.percentual}%</td><td>${r.cultura||'—'}</td><td>${r.areaPivo||'—'}</td><td><span class="badge ${feito?'b-success':'b-warning'}">${feito?'Executado':'Pendente'}</span></td><td style="text-align:right;color:var(--text-tertiary);${r.versao>1?'cursor:pointer;text-decoration:underline':''}" ${r.versao>1?`onclick="planUI.verVersoes('${r.grupoId}')" title="Ver versões anteriores"`:''}>v${r.versao}</td><td style="text-align:right"><button class="btn btn-danger btn-xs" onclick="planUI.excluir('${r.grupoId}')">Excluir</button></td></tr>`;
    }).join('')}</tbody></table>`:emEl('Nenhum planejamento importado ainda.');
    pag('plan-pg',registros.length,this.pagina,p=>{ this.pagina=p; this.render(); });
  },

  verVersoes(grupoId){
    const versoes=planejamentoHistoricoVersoes(grupoId);
    const texto=versoes.map(v=>`v${v.versao} — ${fmtD(v.data)} — ${v.percentual}% — ${v.atual?'ATUAL':'substituída'}`).join('\n');
    alert('Histórico de versões deste planejamento (nada é apagado, cada correção vira uma nova versão):\n\n'+texto);
  },
  async excluir(grupoId){
    if(!confirm('Excluir este planejamento? Ele some das consultas, mas o registro fica guardado e a exclusão vai para a auditoria.')) return;
    const resultado=await planejamentoExcluir(grupoId);
    if(resultado.ok){ toast('Planejamento excluído.','ok'); this.render(); }
  },
  clear(){
    ['plan-filtro-faz','plan-filtro-pivo'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    this.pagina=0;
    this.render();
  },
};
