/* ── SERVICES / IMPORTAÇÃO DE PLANEJAMENTO ────────────────────────
   Toda a lógica de importação (parsing de arquivo, validação de
   colunas/linhas, pré-visualização, correção e efetivação) mora aqui.
   A tela (js/importacao-ui.js) só monta a UI e chama estas funções.

   Formatos suportados hoje: .csv, .xlsx, .xls — via o registro
   `IMPORT_PARSERS`, deliberadamente separado do resto da lógica: para
   suportar um formato novo no futuro basta adicionar uma entrada nesse
   objeto, nada mais precisa mudar.

   A efetivação (`importacaoCommitar`) nunca grava direto no storage —
   sempre chama `planejamentoCriar`/`planejamentoAtualizar`
   (js/services/planejamento.js), reaproveitando toda a validação e
   auditoria que esse serviço já tem, em vez de duplicá-la aqui.
   ──────────────────────────────────────────────────────────────── */

const IMPORT_COLUNAS_OBRIGATORIAS=['data','pivo','percentual','cultura','area'];
const IMPORT_COLUNAS_OPCIONAIS=['observacao','fazenda','casabomba','operador'];

function normalizarTexto(texto){
  const semAcento=String(texto??'').normalize('NFD').replace(new RegExp('['+String.fromCharCode(0x0300)+'-'+String.fromCharCode(0x036f)+']','g'),'');
  return semAcento.trim().toLowerCase();
}

/* ── PARSERS (registro extensível por formato) ────────────────────── */
function importacaoDetectarFormato(nomeArquivo){
  const ext=(nomeArquivo.split('.').pop()||'').toLowerCase();
  return IMPORT_PARSERS[ext]?ext:null;
}

function importacaoParsearCSV(arquivo){
  return arquivo.text().then(texto=>{
    const linhas=texto.split(/\r?\n/).filter(l=>l.trim()!=='');
    if(!linhas.length) return [];
    const delimitador=(linhas[0].split(';').length>=linhas[0].split(',').length)?';':',';
    const headers=linhas[0].split(delimitador).map(h=>h.trim());
    return linhas.slice(1).map(linha=>{
      const valores=linha.split(delimitador);
      const obj={};
      headers.forEach((h,i)=>{ obj[h]=valores[i]!==undefined?valores[i].trim():''; });
      return obj;
    });
  });
}

function importacaoParsearExcel(arquivo){
  return arquivo.arrayBuffer().then(buffer=>{
    if(typeof XLSX==='undefined') throw new Error('Biblioteca de leitura de Excel não carregada.');
    const wb=XLSX.read(buffer,{type:'array'});
    const aba=wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(aba,{defval:'',raw:false});
  });
}

const IMPORT_PARSERS={csv:importacaoParsearCSV,xlsx:importacaoParsearExcel,xls:importacaoParsearExcel};

function importacaoParsearArquivo(arquivo){
  const formato=importacaoDetectarFormato(arquivo.name);
  if(!formato) return Promise.reject(new Error(`Formato não suportado: "${arquivo.name}". Use .csv, .xlsx ou .xls.`));
  return IMPORT_PARSERS[formato](arquivo);
}

/* ── NORMALIZAÇÃO DE DATA (ISO, dd/mm/aaaa ou serial do Excel) ────── */
function importacaoNormalizarData(valor){
  if(valor===''||valor==null) return null;
  if(typeof valor==='number'){
    const d=new Date(Math.round((valor-25569)*86400*1000));
    if(isNaN(d)) return null;
    return d.toISOString().slice(0,10);
  }
  const texto=String(valor).trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const m=texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(m){
    const [,dd,mm,yyyy]=m;
    const d=new Date(+yyyy,+mm-1,+dd);
    if(d.getFullYear()==+yyyy&&d.getMonth()==+mm-1&&d.getDate()==+dd) return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
  }
  return null;
}

function importacaoCampo(linha,nomeNormalizado){
  const chave=Object.keys(linha).find(k=>normalizarTexto(k)===nomeNormalizado);
  return chave!==undefined?linha[chave]:'';
}

/* ── VALIDAÇÃO DE ESTRUTURA (colunas) ─────────────────────────────── */
function importacaoValidarColunas(linhas){
  if(!linhas.length) return ['Planilha vazia.'];
  const colunasArquivo=Object.keys(linhas[0]).map(normalizarTexto);
  const faltando=IMPORT_COLUNAS_OBRIGATORIAS.filter(c=>!colunasArquivo.includes(c));
  if(faltando.length) return [`Colunas obrigatórias ausentes: ${faltando.join(', ')}.`];
  return [];
}

/* Contexto de cadastros carregado uma vez por importação (não a cada
   linha) — evita centenas de buscas repetidas em cadAll(). */
function importacaoMontarContexto(){
  return {
    pivosPorNumero:Object.fromEntries((cadAll('pivos')||[]).map(p=>[String(p.numero),p])),
    culturas:new Set((cadAll('culturas')||[]).map(c=>c.nome)),
    areas:new Set(AREAS_ALL||[]),
    fazendas:new Set((cadAll('fazendas')||[]).map(f=>f.nome)),
    casasBomba:new Set((cadAll('casasBomba')||[]).map(c=>c.nome)),
    operadores:new Set((cadAll('operadores')||[]).map(o=>o.nome)),
  };
}

/* ── VALIDAÇÃO DE LINHA ────────────────────────────────────────────── */
function importacaoValidarLinha(linha,contexto){
  const erros=[];
  const dataRaw=importacaoCampo(linha,'data'), pivoRaw=String(importacaoCampo(linha,'pivo')).trim(),
    percentualRaw=importacaoCampo(linha,'percentual'), cultura=String(importacaoCampo(linha,'cultura')).trim(),
    area=String(importacaoCampo(linha,'area')).trim(), fazenda=String(importacaoCampo(linha,'fazenda')).trim(),
    casaBomba=String(importacaoCampo(linha,'casabomba')||importacaoCampo(linha,'casa de bomba')).trim(),
    operador=String(importacaoCampo(linha,'operador')).trim();

  const data=importacaoNormalizarData(dataRaw);
  if(!dataRaw) erros.push('Data vazia.');
  else if(!data) erros.push(`Data inválida: "${dataRaw}".`);

  if(!pivoRaw) erros.push('Pivô vazio.');
  else if(!contexto.pivosPorNumero[pivoRaw]) erros.push(`Pivô "${pivoRaw}" não cadastrado.`);

  if(percentualRaw===''||percentualRaw==null) erros.push('Percentual vazio.');
  else if(!percentualValido(percentualRaw)) erros.push(`Percentual inválido: "${percentualRaw}" (deve ser 1–100).`);

  if(cultura&&!contexto.culturas.has(cultura)) erros.push(`Cultura "${cultura}" não cadastrada.`);
  if(area&&!contexto.areas.has(area)) erros.push(`Área "${area}" fora da lista padrão.`);
  if(fazenda&&!contexto.fazendas.has(fazenda)) erros.push(`Fazenda "${fazenda}" não cadastrada.`);
  if(casaBomba&&!contexto.casasBomba.has(casaBomba)) erros.push(`Casa de bomba "${casaBomba}" não cadastrada.`);
  if(operador&&!contexto.operadores.has(operador)) erros.push(`Operador "${operador}" não cadastrado.`);

  return {erros,dataNormalizada:data};
}

/* ── PRÉ-VISUALIZAÇÃO ─────────────────────────────────────────────── */
function importacaoPreVisualizar(linhasRaw){
  const contexto=importacaoMontarContexto();
  const vistos=new Set();
  const linhas=linhasRaw.map((dados,i)=>{
    const {erros,dataNormalizada}=importacaoValidarLinha(dados,contexto);
    const avisos=[];
    const pivoRaw=String(importacaoCampo(dados,'pivo')).trim();
    if(erros.length===0){
      const chave=pivoRaw+'_'+dataNormalizada;
      if(vistos.has(chave)) avisos.push('Duplicado dentro do próprio arquivo — a última ocorrência prevalece.');
      vistos.add(chave);
      const pivo=contexto.pivosPorNumero[pivoRaw];
      if(pivo&&planejamentoAtivos().some(p=>p.pivoId===pivo.id&&p.data===dataNormalizada)){
        avisos.push('Já existe planejamento para este pivô nesta data — será substituído (nova versão).');
      }
    }
    return {linha:i+2,dados,erros,avisos,valido:erros.length===0};
  });
  return {
    totalLinhas:linhas.length,
    totalErros:linhas.filter(l=>l.erros.length).length,
    totalAvisos:linhas.filter(l=>l.avisos.length).length,
    linhasValidas:linhas.filter(l=>l.valido).length,
    linhasInvalidas:linhas.filter(l=>!l.valido).length,
    linhas,
  };
}

/* Revalida uma única linha (após o usuário corrigir um campo na tela de
   pré-visualização) — mesma regra usada na pré-visualização inicial. */
function importacaoRevalidarLinha(item){
  const contexto=importacaoMontarContexto();
  const {erros}=importacaoValidarLinha(item.dados,contexto);
  item.erros=erros;
  item.valido=erros.length===0;
  return item;
}

/* ── EFETIVAÇÃO ───────────────────────────────────────────────────── */
/* Fase 18 — planejamentoCriar/Atualizar viraram async (gravam no
   Supabase); o laço virou `for...of` com `await` para gravar uma linha
   de cada vez, na ordem, e realmente confirmar cada gravação antes de
   contar sucesso/falha — nenhuma regra de importação mudou. */
async function importacaoCommitar(preview){
  const contexto=importacaoMontarContexto();
  let sucesso=0,falhas=0;
  for(const item of preview.linhas.filter(l=>l.valido)){
    const pivoRaw=String(importacaoCampo(item.dados,'pivo')).trim();
    const pivo=contexto.pivosPorNumero[pivoRaw];
    const data=importacaoNormalizarData(importacaoCampo(item.dados,'data'));
    const dadosPlanejamento={
      pivoId:pivo.id, data,
      percentual:importacaoCampo(item.dados,'percentual'),
      cultura:String(importacaoCampo(item.dados,'cultura')).trim(),
      areaPivo:String(importacaoCampo(item.dados,'area')).trim()||'COMPLETO',
      observacao:String(importacaoCampo(item.dados,'observacao')).trim(),
    };
    const existente=planejamentoAtivos().find(p=>p.pivoId===pivo.id&&p.data===data);
    const resultado=existente?await planejamentoAtualizar(existente.grupoId,dadosPlanejamento):await planejamentoCriar(dadosPlanejamento);
    if(resultado.ok) sucesso++; else falhas++;
  }
  auditLog('Importação de Planejamento','INCLUSÃO',`${sucesso} registro(s) importado(s)${falhas?`, ${falhas} falharam na gravação`:''}.`);
  return {sucesso,falhas};
}
