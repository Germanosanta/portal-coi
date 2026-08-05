/* ── CADASTROS — MOTOR GENÉRICO DE CRUD ───────────────────────────
   Um único motor de CRUD (guiado por configuração) atende os 11
   cadastros do sistema (pivôs, casas de bomba, bombas, motores,
   painéis, sensores, operadores, técnicos, fazendas, setores,
   culturas) em vez de 11 implementações quase idênticas.

   Armazenamento: localStorage, chave `cad_<entidade>` (via lsGet/
   lsSet de js/storage.js). Toda inclusão/alteração/exclusão grava um
   evento de auditoria (js/audit.js). O Módulo Firebase vai trocar só
   `cadAll`/`cadSaveAll` por leitura/escrita no Firestore — o resto
   (validação, formulário, listagem) não muda.
   ──────────────────────────────────────────────────────────────── */

const CAD_ENTITIES={
  fazendas:{ label:'Fazendas', labelField:'nome', fields:[
    {key:'nome',label:'Nome',type:'text',required:true,unique:true},
    {key:'codigo',label:'Código',type:'text'},
    {key:'areaTotal',label:'Área Total (ha)',type:'number'},
  ]},
  setores:{ label:'Setores', labelField:'nome', fields:[
    {key:'nome',label:'Nome',type:'text',required:true,unique:true},
    {key:'fazendaId',label:'Fazenda',type:'select',ref:'fazendas',required:true},
    {key:'descricao',label:'Descrição',type:'text'},
  ]},
  culturas:{ label:'Culturas', labelField:'nome', fields:[
    {key:'nome',label:'Nome',type:'text',required:true,unique:true},
    {key:'cicloDias',label:'Ciclo (dias)',type:'number'},
  ]},
  casasBomba:{ label:'Casas de Bomba', labelField:'nome', fields:[
    {key:'nome',label:'Nome',type:'text',required:true,unique:true},
    {key:'fazendaId',label:'Fazenda',type:'select',ref:'fazendas',required:true},
    {key:'setorId',label:'Setor',type:'select',ref:'setores'},
    {key:'localizacao',label:'Localização',type:'text'},
  ]},
  bombas:{ label:'Bombas', labelField:'tag', fields:[
    {key:'tag',label:'Identificação (Tag)',type:'text',required:true,unique:true},
    {key:'casaBombaId',label:'Casa de Bomba',type:'select',ref:'casasBomba',required:true},
    {key:'potenciaCv',label:'Potência (CV)',type:'number'},
    {key:'fabricante',label:'Fabricante',type:'text'},
    {key:'status',label:'Status',type:'select',options:['Ativo','Manutenção','Inativo'],required:true},
  ]},
  motores:{ label:'Motores', labelField:'tag', fields:[
    {key:'tag',label:'Identificação (Tag)',type:'text',required:true,unique:true},
    {key:'bombaId',label:'Bomba',type:'select',ref:'bombas'},
    {key:'potenciaCv',label:'Potência (CV)',type:'number'},
    {key:'fabricante',label:'Fabricante',type:'text'},
    {key:'status',label:'Status',type:'select',options:['Ativo','Manutenção','Inativo'],required:true},
  ]},
  paineis:{ label:'Painéis', labelField:'tag', fields:[
    {key:'tag',label:'Identificação (Tag)',type:'text',required:true,unique:true},
    {key:'casaBombaId',label:'Casa de Bomba',type:'select',ref:'casasBomba'},
    {key:'tipo',label:'Tipo',type:'text'},
    {key:'status',label:'Status',type:'select',options:['Ativo','Manutenção','Inativo'],required:true},
  ]},
  sensores:{ label:'Sensores', labelField:'tag', fields:[
    {key:'tag',label:'Identificação (Tag)',type:'text',required:true,unique:true},
    {key:'tipo',label:'Tipo',type:'select',options:['Nível','Pressão','Vazão','Outro'],required:true},
    {key:'equipamento',label:'Equipamento associado',type:'text'},
    {key:'status',label:'Status',type:'select',options:['Ativo','Manutenção','Inativo'],required:true},
  ]},
  operadores:{ label:'Operadores', labelField:'nome', fields:[
    {key:'nome',label:'Nome',type:'text',required:true,unique:true},
    {key:'matricula',label:'Matrícula',type:'text'},
    {key:'fazendaId',label:'Fazenda',type:'select',ref:'fazendas'},
    {key:'telefone',label:'Telefone',type:'text'},
    {key:'status',label:'Status',type:'select',options:['Ativo','Inativo'],required:true},
  ]},
  tecnicos:{ label:'Técnicos', labelField:'nome', fields:[
    {key:'nome',label:'Nome',type:'text',required:true,unique:true},
    {key:'especialidade',label:'Especialidade',type:'select',options:['Mecânica','Elétrica','Mecânica e Elétrica']},
    {key:'telefone',label:'Telefone',type:'text'},
    {key:'status',label:'Status',type:'select',options:['Ativo','Inativo'],required:true},
  ]},
  pivos:{ label:'Pivôs', labelField:'numero', fields:[
    {key:'numero',label:'Número',type:'number',required:true,unique:true},
    {key:'fazendaId',label:'Fazenda',type:'select',ref:'fazendas',required:true},
    {key:'casaBombaId',label:'Casa de Bomba',type:'select',ref:'casasBomba'},
    {key:'area',label:'Área (ha)',type:'number'},
    {key:'laminaBase100',label:'Lâmina a 100% (mm)',type:'number'},
    {key:'status',label:'Status',type:'select',options:['Ativo','Manutenção','Inativo'],required:true},
  ]},
  falhas:{ label:'Falhas', labelField:'motivo', fields:[
    {key:'categoria',label:'Categoria',type:'text',required:true},
    {key:'motivo',label:'Motivo',type:'text',required:true,uniqueWith:['categoria']},
    {key:'submotivo',label:'Submotivo',type:'text'},
    {key:'prioridade',label:'Prioridade',type:'select',options:['Baixa','Média','Alta','Urgente'],required:true},
    {key:'criticidade',label:'Criticidade',type:'select',options:['Baixa','Média','Alta'],required:true},
    {key:'observacoes',label:'Observações',type:'text'},
  ]},
  categoriasProduto:{ label:'Categorias de Produto', labelField:'nome', fields:[
    {key:'nome',label:'Nome',type:'text',required:true,unique:true},
  ]},
  unidadesMedida:{ label:'Unidades de Medida', labelField:'nome', fields:[
    {key:'nome',label:'Nome',type:'text',required:true,unique:true},
    {key:'simbolo',label:'Símbolo',type:'text',required:true,unique:true},
  ]},
  produtos:{ label:'Produtos', labelField:'nome', fields:[
    {key:'nome',label:'Nome',type:'text',required:true,unique:true},
    {key:'categoriaId',label:'Categoria',type:'select',ref:'categoriasProduto',required:true},
    {key:'unidadeId',label:'Unidade de Medida',type:'select',ref:'unidadesMedida',required:true},
    {key:'fabricante',label:'Fabricante',type:'text'},
    {key:'status',label:'Status',type:'select',options:['Ativo','Inativo'],required:true},
  ]},
};

/* ── ARMAZENAMENTO ────────────────────────────────────────────────── */
const cadKey = entity => 'cad_'+entity;
const cadAll = entity => lsGet(cadKey(entity),[]);
const cadSaveAll = (entity,arr) => lsSet(cadKey(entity),arr);
function cadLookupLabel(entity,id){
  if(!id) return '—';
  const cfg=CAD_ENTITIES[entity];
  const rec=cadAll(entity).find(r=>r.id===id);
  return rec?rec[cfg.labelField]:'—';
}

/* Atualiza um ou mais campos de UM registro já existente, sem passar pelo
   formulário genérico (usado por outros serviços quando uma ação deles
   deve refletir num campo do cadastro — ex.: calibração de lâmina
   atualizando `laminaBase100` do pivô). Continua sendo o único ponto que
   grava em `cad_<entidade>` — nenhum serviço acessa lsSet diretamente. */
function cadPatchRecord(entity,id,patch){
  const all=cadAll(entity);
  const idx=all.findIndex(r=>r.id===id);
  if(idx===-1) return false;
  all[idx]={...all[idx],...patch};
  cadSaveAll(entity,all);
  return true;
}

/* Catálogo inicial de Falhas levantado do sistema legado (categoria→motivo).
   Só usado como semente/reconciliação em cadSeedIfEmpty — depois disso o
   cadastro (editável pelo usuário) é a única fonte de verdade. */
const FALHAS_SEED=(()=>{
  const porCategoria={
    'Elétrico':['Anel Coletor','Cabo Acionamento','Cabo de Segurança','Caixa do Micro','Chave Aberta','Contactora','Disjuntor','Falta de Fase','Gerador','Inversor de Frequência','Painel da Bomba','Painel do Pivô','Rede Interna','Transformador'],
    'Mecânico':['Adutora/Tubulação','Bomba de Poços','Bomba/Sucção','Canal/Reservatório','Castanha/Cardã','Estrutura','Gerador','Manutenção Preventiva','Mangote','Motorredutor','Pneu','Redutor','Rolamento','Vedação'],
    'Operacional':['Adubação','Aguardando Anterior','Bomba com Entrada de Ar','Capina','Colheita','Demanda de Energia','Desponte/Anti-Brotante','Entrega do Produto','Entupimento','Equipamentos Ferti','Erosão/Rastro','Falha de Alinhamento','Falta de Água','Falta de Produto','Funcionário Indisponível','Kit Fertirrigação','Limpeza e Aferições','Manejo','Máquina Atolada no Pivô','Máquina Quebrada no Pivô','Mecânico/Trator','Operação Equipe Irrigação','Pivô Atolado','Pivô em Manual','Plantio','Preparo de Solo','Pulverização','Suporte/Telemetria','Transplantio','Transporte/Logística'],
    'Programação/Manejo':['Alinhamento de Operações','Cancelamento','Início Tardio','Mudança de Manejo'],
    'Chuva':['Chuva'],
    'Energia/Coelba':['Falta de Energia (Concessionária)'],
  };
  const seed=[];
  Object.entries(porCategoria).forEach(([categoria,motivos])=>{
    motivos.forEach(motivo=>seed.push({categoria,motivo,submotivo:'',prioridade:'Média',criticidade:'Média',observacoes:''}));
  });
  return seed;
})();

/* ── SEED INICIAL (só roda se o cadastro ainda estiver vazio) ─────── */
function cadSeedIfEmpty(){
  if(!cadAll('fazendas').length){
    cadSaveAll('fazendas',[
      {id:gId(),nome:'KARITEL',codigo:'KAR',areaTotal:null},
      {id:gId(),nome:'RDM',codigo:'RDM',areaTotal:null},
    ]);
  }
  if(!cadAll('pivos').length && (D.pivos_cad||[]).length){
    const fazendas=cadAll('fazendas');
    const fazId=nome=>(fazendas.find(f=>f.nome===nome)||{}).id||'';
    // laminaBase100 = lâmina de referência a 100% de velocidade, usada no
    // cálculo automático de lâmina do Lançamento de Horímetro (lâmina(%) =
    // laminaBase100 / (percentual/100)). Fica no próprio registro do pivô
    // (não em uma tabela separada) para não duplicar a mesma informação em
    // dois lugares — a "Atualização de Lâmina" só passa a atualizar este
    // campo, LAMINA_PIVOS_SEED nunca é lido de novo depois deste seed.
    cadSaveAll('pivos',D.pivos_cad.map(p=>({id:gId(),numero:p[0],fazendaId:fazId(p[1]),casaBombaId:'',area:null,laminaBase100:LAMINA_PIVOS_SEED[String(p[0])]??null,status:'Ativo'})));
  }
  // Pivôs 75 e 76 (KARITEL) — não existem na planilha oficial de lançamentos
  // (Informações_Pivôs/Pivôs_KARITEL vão de 1 a 74 e pulam pra 101), mas
  // foram encontrados em "informações pivôs e reservatórios..." (planilha
  // à parte, atualizada em 12/06/2026): Casa de Bomba "C3Z3/R7", área 82ha
  // (P.75) e 75ha (P.76). Vazão/potência/energia/lâmina ainda não constam
  // em nenhuma fonte — ficam em branco até serem medidos. Reconciliado do
  // mesmo jeito que Culturas/Falhas — roda toda vez, só cria o que ainda
  // não existir, nunca duplica nem sobrescreve o que já foi editado.
  if(cadAll('fazendas').length){
    const karitelId=(cadAll('fazendas').find(f=>f.nome==='KARITEL')||{}).id||'';
    if(karitelId){
      cadEnsureDefaults('casasBomba',[
        {nome:'C3Z3/R7',fazendaId:karitelId,setorId:'',localizacao:''},
      ]);
      const casaC3Z3R7Id=(cadAll('casasBomba').find(c=>c.nome==='C3Z3/R7'&&c.fazendaId===karitelId)||{}).id||'';
      cadEnsureDefaults('pivos',[
        {numero:75,fazendaId:karitelId,casaBombaId:casaC3Z3R7Id,area:82,laminaBase100:null,status:'Ativo'},
        {numero:76,fazendaId:karitelId,casaBombaId:casaC3Z3R7Id,area:75,laminaBase100:null,status:'Ativo'},
      ]);
      // Se os pivôs 75/76 já tinham sido criados antes desta planilha ser
      // encontrada (com Casa de Bomba/Área em branco), completa agora —
      // cadEnsureDefaults só cria quando falta, não atualiza quem já existe.
      const areaEsperada={75:82,76:75};
      cadAll('pivos').filter(p=>p.numero===75||p.numero===76).forEach(p=>{
        const patch={};
        if(!p.casaBombaId) patch.casaBombaId=casaC3Z3R7Id;
        if(p.area==null) patch.area=areaEsperada[p.numero];
        if(Object.keys(patch).length) cadPatchRecord('pivos',p.id,patch);
      });
    }
  }
  // Culturas: reconciliado (não só semeado) — reaproveita registros já
  // existentes/editados pelo usuário e só acrescenta os nomes da lista
  // mestre que ainda não estiverem cadastrados, sem duplicar nem apagar.
  cadEnsureDefaults('culturas',(CULTURAS_ALL||[]).map(nome=>({nome,cicloDias:null})));
  // Falhas: catálogo inicial levantado do sistema legado (categoria→motivo),
  // reconciliado do mesmo jeito — o usuário pode editar/completar depois,
  // isso só garante que a tela de Indicadores não comece vazia.
  cadEnsureDefaults('falhas',FALHAS_SEED);

  // Fertirrigação: unidades e categorias reconciliadas (mesmo padrão de
  // Culturas/Falhas); Produtos é semeado uma vez só (depende dos ids
  // recém-criados de categoria/unidade, não dá para reconciliar por nome
  // sozinho sem repetir a resolução de FK).
  cadEnsureDefaults('unidadesMedida',[
    {nome:'Litro',simbolo:'L'},{nome:'Mililitro',simbolo:'mL'},
    {nome:'Quilograma',simbolo:'kg'},{nome:'Grama',simbolo:'g'},
  ]);
  cadEnsureDefaults('categoriasProduto',[
    {nome:'Fertilizante Foliar'},{nome:'Biológico'},{nome:'Corretivo'},{nome:'Micronutriente'},
  ]);
  if(!cadAll('produtos').length){
    const unidades=cadAll('unidadesMedida'), categorias=cadAll('categoriasProduto');
    const unidId=simbolo=>(unidades.find(u=>u.simbolo===simbolo)||{}).id||'';
    const catId=nome=>(categorias.find(c=>c.nome===nome)||{}).id||'';
    cadSaveAll('produtos',[
      {id:gId(),nome:'BIO ND',categoriaId:catId('Biológico'),unidadeId:unidId('L'),fabricante:'',status:'Ativo'},
      {id:gId(),nome:'BIO AZ',categoriaId:catId('Biológico'),unidadeId:unidId('L'),fabricante:'',status:'Ativo'},
      {id:gId(),nome:'BIO MEGA',categoriaId:catId('Biológico'),unidadeId:unidId('L'),fabricante:'',status:'Ativo'},
      {id:gId(),nome:'BIO MAIS',categoriaId:catId('Biológico'),unidadeId:unidId('L'),fabricante:'',status:'Ativo'},
      {id:gId(),nome:'PRO K+BORO',categoriaId:catId('Micronutriente'),unidadeId:unidId('kg'),fabricante:'',status:'Ativo'},
    ]);
  }
}

/* Garante que cada item de `defaults` exista no cadastro `entity` (comparando
   pelo labelField), sem duplicar os que já existem nem tocar em edições do
   usuário. Usado para listas de referência que podem ganhar itens novos no
   arquivo mestre (data/*.json) depois que o cadastro já foi usado. */
function cadEnsureDefaults(entity,defaults){
  const cfg=CAD_ENTITIES[entity];
  const labelFieldCfg=cfg.fields.find(f=>f.key===cfg.labelField);
  const camposChave=[cfg.labelField,...(labelFieldCfg&&labelFieldCfg.uniqueWith?labelFieldCfg.uniqueWith:[])];
  const chaveDe=r=>camposChave.map(k=>String(r[k]||'').trim().toLowerCase()).join('␟');

  const all=cadAll(entity);
  const existentes=new Set(all.map(chaveDe));
  let mudou=false;
  defaults.forEach(def=>{
    const chave=chaveDe(def);
    if(!existentes.has(chave)){
      all.push({id:gId(),...def});
      existentes.add(chave);
      mudou=true;
    }
  });
  if(mudou) cadSaveAll(entity,all);
}

/* ── VALIDAÇÃO E PREVENÇÃO DE DUPLICADOS ──────────────────────────── */
function cadValidate(entity,data,editId){
  const cfg=CAD_ENTITIES[entity];
  for(const f of cfg.fields){
    if(f.required&&(data[f.key]===undefined||data[f.key]===null||String(data[f.key]).trim()==='')){
      return `Campo "${f.label}" é obrigatório.`;
    }
  }
  const all=cadAll(entity);
  const igual=(a,b)=>String(a).trim().toLowerCase()===String(b).trim().toLowerCase();
  for(const f of cfg.fields){
    if(f.unique){
      const dup=all.find(r=>r.id!==editId&&igual(r[f.key],data[f.key]));
      if(dup) return `Já existe um registro de "${cfg.label}" com ${f.label.toLowerCase()} = "${data[f.key]}".`;
    }
    // Duplicado composto: único quando combinado com outro(s) campo(s), ex.:
    // Motivo repetido é permitido em categorias diferentes, mas não na mesma.
    if(f.uniqueWith){
      const dup=all.find(r=>r.id!==editId&&igual(r[f.key],data[f.key])&&f.uniqueWith.every(k=>igual(r[k],data[k])));
      if(dup) return `Já existe "${data[f.key]}" cadastrado para ${f.uniqueWith.map(k=>data[k]).join(' / ')}.`;
    }
  }
  return null;
}

/* ── FORMULÁRIO (MODAL ÚNICO REUTILIZADO POR TODOS OS CADASTROS) ──── */
let CAD_CTX={entity:null,editId:null};

function cadFieldsHtml(cfg,rec){
  return cfg.fields.map(f=>{
    const val=rec[f.key]!==undefined&&rec[f.key]!==null?rec[f.key]:'';
    if(f.type==='select'){
      const opts=f.ref?cadAll(f.ref).map(r=>({v:r.id,l:r[CAD_ENTITIES[f.ref].labelField]})):(f.options||[]).map(o=>({v:o,l:o}));
      return `<div class="field" style="margin-bottom:.7rem">
        <label>${f.label}${f.required?' <span class="req">*</span>':''}</label>
        <select class="select" id="cadf-${f.key}">
          <option value="">Selecione...</option>
          ${opts.map(o=>`<option value="${o.v}" ${String(o.v)===String(val)?'selected':''}>${o.l}</option>`).join('')}
        </select>
      </div>`;
    }
    return `<div class="field" style="margin-bottom:.7rem">
      <label>${f.label}${f.required?' <span class="req">*</span>':''}</label>
      <input type="${f.type==='number'?'number':'text'}" class="input" id="cadf-${f.key}" value="${val}">
    </div>`;
  }).join('');
}
function cadOpenForm(entity,id){
  if(bloquearSemPermissao('cadastros','edit')) return;
  CAD_CTX={entity,editId:id||null};
  const cfg=CAD_ENTITIES[entity];
  const rec=id?(cadAll(entity).find(r=>r.id===id)||{}):{};
  document.getElementById('cad-modal-title').textContent=(id?'Editar — ':'Novo(a) — ')+cfg.label;
  document.getElementById('cad-modal-body').innerHTML=cadFieldsHtml(cfg,rec);
  document.getElementById('cad-modal-overlay').classList.add('open');
}
function cadCloseForm(){
  document.getElementById('cad-modal-overlay').classList.remove('open');
  CAD_CTX={entity:null,editId:null};
}
function cadSubmitForm(){
  if(bloquearSemPermissao('cadastros','edit')) return;
  const {entity,editId}=CAD_CTX;
  const cfg=CAD_ENTITIES[entity];
  const data={};
  cfg.fields.forEach(f=>{
    const el=document.getElementById('cadf-'+f.key);
    let val=el?el.value:'';
    if(f.type==='number'&&val!=='') val=Number(val);
    data[f.key]=val;
  });
  const err=cadValidate(entity,data,editId);
  if(err){ toast(err,'err'); return; }
  const all=cadAll(entity);
  if(editId){
    const idx=all.findIndex(r=>r.id===editId);
    all[idx]={...all[idx],...data};
    auditLog(cfg.label,'ALTERAÇÃO',`${cfg.labelField}: ${data[cfg.labelField]}`);
    auditoriaRegistrar('ALTERAÇÃO',cfg.label,data[cfg.labelField],'Cadastro atualizado.');
  }else{
    data.id=gId();
    all.push(data);
    auditLog(cfg.label,'INCLUSÃO',`${cfg.labelField}: ${data[cfg.labelField]}`);
    auditoriaRegistrar('INCLUSÃO',cfg.label,data[cfg.labelField],'Cadastro criado.');
  }
  cadSaveAll(entity,all);
  cadCloseForm();
  cadRenderList(entity);
  toast('Registro salvo com sucesso.','ok');
}
function cadDelete(entity,id){
  if(bloquearSemPermissao('cadastros','delete')) return;
  const cfg=CAD_ENTITIES[entity];
  const all=cadAll(entity);
  const rec=all.find(r=>r.id===id);
  if(!rec) return;
  if(!confirm(`Excluir "${rec[cfg.labelField]}" de ${cfg.label}? Esta ação não pode ser desfeita.`)) return;
  cadSaveAll(entity,all.filter(r=>r.id!==id));
  auditLog(cfg.label,'EXCLUSÃO',`${cfg.labelField}: ${rec[cfg.labelField]}`);
  auditoriaRegistrar('EXCLUSÃO',cfg.label,rec[cfg.labelField],'Cadastro excluído.');
  cadRenderList(entity);
  toast('Registro excluído.','ok');
}

/* ── LISTAGEM: BUSCA + ORDENAÇÃO + PAGINAÇÃO ──────────────────────── */
const CAD_STATE={};
const cadState=entity=>CAD_STATE[entity]||(CAD_STATE[entity]={q:'',sortKey:null,sortDir:1,page:0});

function cadRenderList(entity){
  const cfg=CAD_ENTITIES[entity];
  if(!cfg) return;
  const st=cadState(entity);
  const qInput=document.getElementById('cad-'+entity+'-q');
  if(qInput) st.q=qInput.value.toLowerCase();

  let rows=cadAll(entity).filter(r=>!st.q||cfg.fields.some(f=>String(r[f.key]||'').toLowerCase().includes(st.q)));
  if(st.sortKey){
    rows=rows.slice().sort((a,b)=>{
      const av=a[st.sortKey],bv=b[st.sortKey];
      if(av===bv) return 0;
      return (av>bv?1:-1)*st.sortDir;
    });
  }
  const cntEl=document.getElementById('cad-'+entity+'-cnt');
  if(cntEl) cntEl.textContent=rows.length.toLocaleString('pt-BR')+' registros';

  const PER=20;
  const pageRows=rows.slice(st.page*PER,(st.page+1)*PER);
  const thead=`<tr>${cfg.fields.map(f=>`<th style="cursor:pointer" onclick="cadSort('${entity}','${f.key}')">${f.label}${st.sortKey===f.key?(st.sortDir===1?' ▲':' ▼'):''}</th>`).join('')}<th style="text-align:right">Ações</th></tr>`;
  const podeEditar=canEdit('cadastros'), podeExcluir=canDelete('cadastros');
  const tbody=pageRows.map(r=>{
    const tds=cfg.fields.map(f=>{
      const display=f.ref?cadLookupLabel(f.ref,r[f.key]):(r[f.key]===undefined||r[f.key]===null||r[f.key]===''?'—':r[f.key]);
      return `<td>${display}</td>`;
    }).join('');
    const acoes=(!podeEditar&&!podeExcluir)?'<span style="font-size:10px;color:var(--text-tertiary)">Somente leitura</span>':`
      ${podeEditar?`<button class="btn btn-ghost btn-xs" onclick="cadOpenForm('${entity}','${r.id}')">Editar</button>`:''}
      ${podeExcluir?`<button class="btn btn-danger btn-xs" onclick="cadDelete('${entity}','${r.id}')">Excluir</button>`:''}`;
    return `<tr>${tds}<td style="text-align:right;white-space:nowrap">${acoes}</td></tr>`;
  }).join('');

  const tbl=document.getElementById('cad-'+entity+'-tbl');
  if(tbl) tbl.innerHTML=pageRows.length?`<table class="table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`:emEl('Nenhum registro cadastrado ainda.');
  pag('cad-'+entity+'-pg',rows.length,st.page,p=>{ st.page=p; cadRenderList(entity); });
  const novoBtn=document.getElementById('cad-'+entity+'-novo');
  if(novoBtn) novoBtn.style.display=podeEditar?'':'none';
}
function cadSort(entity,key){
  const st=cadState(entity);
  if(st.sortKey===key) st.sortDir*=-1; else { st.sortKey=key; st.sortDir=1; }
  cadRenderList(entity);
}

/* ── RENDER GERAL DA PÁGINA CADASTROS ─────────────────────────────── */
function renderCad(){
  Object.keys(CAD_ENTITIES).forEach(cadRenderList);
}
