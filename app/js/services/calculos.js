/* ── SERVICES / CÁLCULOS ───────────────────────────────────────────
   Funções puras de cálculo (sem DOM, sem storage) usadas pelos
   serviços de Horímetro, Indicadores e Paradas — para que a mesma
   fórmula nunca seja reescrita em serviços diferentes. As funções de
   soma/agrupamento aceitam um `campo` opcional (padrão `'horas'`) —
   Paradas passa `'tempoParadoHoras'` e reaproveita as mesmas funções,
   em vez de duplicá-las com outro nome de campo.
   ──────────────────────────────────────────────────────────────── */

/* Horas trabalhadas = diferença entre horímetro final e inicial. */
function calcHoras(h1,h2){
  const a=Number(h1),b=Number(h2);
  if(!isFinite(a)||!isFinite(b)) return null;
  return +(b-a).toFixed(2);
}

/* Lâmina aplicada num percentual, a partir da lâmina de referência a 100%
   (calibrada no cadastro do pivô). Fórmula confirmada com o sistema legado:
   quanto menor o percentual (pivô mais lento), maior a lâmina aplicada. */
function calcLamina(percentual,laminaBase100){
  const p=Number(percentual),base=Number(laminaBase100);
  if(!isFinite(p)||p<=0||p>100||!isFinite(base)||base<=0) return null;
  return +(base/(p/100)).toFixed(2);
}

/* Soma de um campo numérico (padrão `horas`) de uma lista de lançamentos. */
function calcAcumulado(lancamentos,campo='horas'){
  return +(lancamentos||[]).reduce((soma,l)=>soma+(Number(l[campo])||0),0).toFixed(2);
}

/* Média diária: valor acumulado dividido pelo nº de dias distintos com
   lançamento (não pelo nº de lançamentos, que pode ter mais de um por dia). */
function calcMediaDiaria(lancamentos,campo='horas'){
  const arr=lancamentos||[];
  if(!arr.length) return 0;
  const dias=new Set(arr.map(l=>l.data)).size||1;
  return +(calcAcumulado(arr,campo)/dias).toFixed(2);
}

/* Agrupamento genérico: soma um valor (padrão: campo `horas`) por uma chave
   qualquer, resolvida por `resolverChave(lancamento)`. Toda função de
   agrupamento específica (por mês, ano, pivô, fazenda, operador...) é só
   uma chamada desta — nunca reescreve o laço de soma. */
function agruparPorChave(lancamentos,resolverChave,resolverValor){
  const mapa={};
  (lancamentos||[]).forEach(l=>{
    const chave=resolverChave(l);
    if(chave===null||chave===undefined||chave==='') return;
    const val=resolverValor?resolverValor(l):(Number(l.horas)||0);
    mapa[chave]=(mapa[chave]||0)+val;
  });
  return Object.entries(mapa).map(([chave,valor])=>({chave,valor:+valor.toFixed(2)}));
}

/* Agrupa um campo (padrão `horas`) por mês (chave "YYYY-MM"), ordenado. */
function agruparPorMes(lancamentos,campo='horas'){
  return agruparPorChave(lancamentos,l=>(l.data||'').slice(0,7),l=>Number(l[campo])||0)
    .sort((a,b)=>a.chave.localeCompare(b.chave))
    .map(r=>({mes:r.chave,horas:r.valor}));
}

/* Média mensal = média dos meses com lançamento (não conta meses sem
   nenhum registro). */
function calcMediaMensal(lancamentos,campo='horas'){
  const porMes=agruparPorMes(lancamentos,campo);
  if(!porMes.length) return 0;
  return +(porMes.reduce((s,m)=>s+m.horas,0)/porMes.length).toFixed(2);
}

/* Agrupa um campo (padrão `horas`) por ano (chave "YYYY"). */
function agruparPorAno(lancamentos,campo='horas'){
  return agruparPorChave(lancamentos,l=>(l.data||'').slice(0,4),l=>Number(l[campo])||0)
    .sort((a,b)=>a.chave.localeCompare(b.chave))
    .map(r=>({ano:r.chave,horas:r.valor}));
}

/* Agrupa por safra. Estrutura preparada para uso futuro: hoje não existe
   cadastro de safras, então usa o campo livre `safra` do próprio lançamento
   (preenchido no formulário) — quando o cadastro de Safras existir, basta
   passar os lançamentos já com `safra` resolvida via FK, sem mudar esta
   função. */
function agruparPorSafra(lancamentos,campo='horas'){
  return agruparPorChave(lancamentos,l=>l.safra||'Sem safra definida',l=>Number(l[campo])||0)
    .map(r=>({safra:r.chave,horas:r.valor}));
}

/* Utilização = valor acumulado (padrão `horas`) / possível no período
   (dias do período × 24h), em percentual. */
function calcUtilizacao(lancamentos,dataInicio,dataFim,campo='horas'){
  const horas=calcAcumulado(lancamentos,campo);
  const di=new Date(dataInicio),df=new Date(dataFim);
  const dias=Math.max(1,Math.round((df-di)/86400000)+1);
  const horasPossiveis=dias*24;
  return +Math.min(100,(horas/horasPossiveis)*100).toFixed(1);
}

/* Duração em horas entre dois horários "HH:MM" (parada, aplicação de
   ferti, etc. — qualquer evento com hora inicial/final). Se a hora final
   for menor que a inicial, assume que atravessou a meia-noite (+24h). */
function calcDuracaoHoras(horaInicial,horaFinal){
  if(!horaInicial||!horaFinal) return null;
  const [h1,m1]=horaInicial.split(':').map(Number);
  const [h2,m2]=horaFinal.split(':').map(Number);
  if(!isFinite(h1)||!isFinite(m1)||!isFinite(h2)||!isFinite(m2)) return null;
  let minutos=(h2*60+m2)-(h1*60+m1);
  if(minutos<=0) minutos+=24*60;
  return +(minutos/60).toFixed(2);
}

/* Calibração inversa de lâmina: a partir de um teste (percentual usado +
   lâmina medida naquele percentual), calcula a lâmina de referência a
   100%. É o inverso exato de `calcLamina` — mesma fórmula, direção
   contrária. Usado pelo módulo de Atualização de Lâmina (calibração). */
function calcLaminaBase100(percentualUtilizado,laminaMedida){
  const p=Number(percentualUtilizado),l=Number(laminaMedida);
  if(!isFinite(p)||p<=0||p>100||!isFinite(l)||l<=0) return null;
  return +(l*(p/100)).toFixed(2);
}

/* Diferença absoluta e percentual de variação entre um valor novo e o
   valor anterior — usado para comparar calibrações consecutivas, mas
   genérico o bastante para qualquer "novo valor vs. valor anterior". */
function calcVariacao(valorAnterior,valorNovo){
  if(valorAnterior==null||!isFinite(Number(valorAnterior))||Number(valorAnterior)===0) return {diferenca:null,percentual:null};
  const diferenca=+(Number(valorNovo)-Number(valorAnterior)).toFixed(2);
  const percentual=+((diferenca/Number(valorAnterior))*100).toFixed(1);
  return {diferenca,percentual};
}

/* Janela dos últimos N dias terminando hoje (inclusive) — usado pelo
   Painel Operacional (Ponto 9: "últimos 7 dias" em vez de "hoje"). */
function ultimosDias(n){
  const fim=new Date();
  const inicio=new Date(fim); inicio.setDate(fim.getDate()-(n-1));
  const iso=x=>x.toISOString().slice(0,10);
  return {inicio:iso(inicio),fim:iso(fim)};
}

/* Início (segunda-feira) e fim (domingo) da semana ISO da data informada
   (ou hoje). Usado para "horas na semana". */
function semanaAtual(dataRef){
  const d=dataRef?new Date(dataRef+'T00:00:00'):new Date();
  const diaSemana=(d.getDay()+6)%7; // 0=segunda
  const inicio=new Date(d); inicio.setDate(d.getDate()-diaSemana);
  const fim=new Date(inicio); fim.setDate(inicio.getDate()+6);
  const iso=x=>x.toISOString().slice(0,10);
  return {inicio:iso(inicio),fim:iso(fim)};
}
