/* ── EXPORTAÇÃO CSV ────────────────────────────────────────────────
   Exportação client-side em CSV (sem dependências externas). Excel
   (.xlsx real) e PDF entram no módulo Relatórios; os botões que já
   existiam na interface (exportMod/exportAllCSV/confirmClear) foram
   implementados aqui para não ficarem quebrados.
   ──────────────────────────────────────────────────────────────── */

function csvEscape(val){
  const s=val===null||val===undefined?'':String(val);
  return /[";\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
function toCSV(headers,rows){
  const lines=[headers.map(csvEscape).join(';')];
  rows.forEach(r=>lines.push(r.map(csvEscape).join(';')));
  return '﻿'+lines.join('\r\n');
}
function downloadCSV(filename,csvContent){
  const blob=new Blob([csvContent],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

const EXPORT_DEFS={
  exe:{file:'irrigacao_executado.csv',headers:['Fazenda','Pivô','Cultura','Indicador','Status','Data'],data:()=>EXE_D},
  itv:{file:'intervalo_paradas.csv',headers:['Data','Pivô','Causa','Tipo','Horas'],data:()=>ITV_D},
  hor:{file:'fato_horimetro.csv',headers:['Data','Fazenda','Pivô','Cultura','Horas','Origem'],data:()=>HOR_D},
  fal:{file:'indicadores_falhas.csv',headers:['Fazenda','Pivô','Categoria','Causa','Data'],data:()=>FAL_D},
  ferti:{file:'fertirrigacao.csv',headers:['Data','Pivô','Cultura','Aplicação','Motivo','Status'],
    data:()=>FERTI_D.map(r=>[r.data,r.pivo,r.cultura,r.aplicacao,r.motivo,r.status])},
};

function exportMod(mod){
  const def=EXPORT_DEFS[mod];
  if(!def){ toast('Módulo de exportação desconhecido: '+mod,'err'); return; }
  const rows=def.data();
  if(!rows.length){ toast('Nada para exportar.','warn'); return; }
  downloadCSV(def.file,toCSV(def.headers,rows));
  toast(`${rows.length.toLocaleString('pt-BR')} registros exportados (${def.file}).`,'ok');
  if(typeof auditoriaRegistrar==='function') auditoriaRegistrar('EXPORTAÇÃO','Relatórios',def.file,`${rows.length} registro(s) exportado(s).`);
}
function exportAllCSV(){
  ['exe','ferti','itv','hor','fal'].forEach(mod=>exportMod(mod));
}
/* Chaves de storage de cada serviço de lançamento — usado só aqui, para o
   botão "Limpar lançamentos locais" de Configurações. Auditoria, Cadastros
   e a base ETL (D/EXE_D/...) não são afetados por esta ação. */
const LANCAMENTOS_KEYS=()=>[HORIMETRO_KEY,PARADA_KEY,FERTI_KEY,INDICADOR_KEY,PLANEJAMENTO_KEY,CALIBRACAO_KEY];

function confirmClear(){
  if(!confirm('Tem certeza que deseja apagar todos os lançamentos locais (Horímetro, Paradas, Fertirrigação, Indicadores, Planejamento e Calibrações)? Esta ação não pode ser desfeita.')) return;
  LANCAMENTOS_KEYS().forEach(key=>lsSet(key,[]));
  auditLog('Sistema','EXCLUSÃO','Limpeza geral de lançamentos locais (Horímetro/Paradas/Fertirrigação/Indicadores/Planejamento/Calibrações).');
  toast('Lançamentos locais apagados.','ok');
  if(typeof renderCfg==='function') renderCfg();
}
