/* ── SERVICES / VALIDAÇÕES ─────────────────────────────────────────
   Validações de integridade do lançamento de Horímetro. Os predicados
   abaixo (`horimetroInicialValido`, `horasValidas`, `percentualValido`,
   `dataEhFutura`) existem para a tela usar o MESMO critério no feedback
   ao vivo (js/lanc.js) que é usado na validação final ao salvar — nunca
   duas implementações da mesma regra em lugares diferentes.

   `validarHorimetroLancamento` retorna sempre `{valido, erros[]}` — a
   tela só decide COMO mostrar o erro (toast, hint inline), nunca SE é
   erro.
   ──────────────────────────────────────────────────────────────── */

function horimetroInicialValido(h1){
  const a=Number(h1);
  return isFinite(a)&&a>=0;
}
function horasValidas(h1,h2){
  const a=Number(h1),b=Number(h2);
  return isFinite(a)&&isFinite(b)&&b>a;
}
function percentualValido(pct){
  const p=Number(pct);
  return isFinite(p)&&p>0&&p<=100;
}
function dataEhFutura(data){
  return !!data&&data>today();
}

function validarHorimetroLancamento(dados,contexto){
  const erros=[];

  if(!dados.pivoId) erros.push('Selecione um pivô.');
  if(!dados.data) erros.push('Informe a data do lançamento.');
  if(dados.percentual===''||dados.percentual===null||dados.percentual===undefined) erros.push('Informe o percentual.');
  if(dados.horimetroInicial===''||dados.horimetroInicial===null||dados.horimetroInicial===undefined) erros.push('Informe o horímetro inicial.');
  if(dados.horimetroFinal===''||dados.horimetroFinal===null||dados.horimetroFinal===undefined) erros.push('Informe o horímetro final.');
  if(erros.length) return {valido:false,erros};

  const h1=dados.horimetroInicial, h2=dados.horimetroFinal;

  if(!horimetroInicialValido(h1)) erros.push('Horímetro inicial deve ser um número maior ou igual a 0.');
  if(!isFinite(Number(h2))||Number(h2)<0) erros.push('Horímetro final deve ser um número maior ou igual a 0.');
  if(!percentualValido(dados.percentual)) erros.push('Percentual deve ser um número entre 1 e 100.');

  // Horas negativas / horímetro reduzido dentro do próprio lançamento
  if(horimetroInicialValido(h1)&&isFinite(Number(h2))&&!horasValidas(h1,h2)) erros.push('Horímetro final deve ser maior que o horímetro inicial.');

  // Redução do horímetro acumulado do equipamento (comparado ao histórico)
  if(horimetroInicialValido(h1)&&contexto&&contexto.ultimoHorimetroFinal!=null&&Number(h1)<contexto.ultimoHorimetroFinal){
    erros.push(`Horímetro inicial (${h1}) não pode ser menor que o último horímetro registrado para este pivô (${contexto.ultimoHorimetroFinal}).`);
  }

  // Data futura (só bloqueia se não autorizada explicitamente)
  if(dataEhFutura(dados.data)&&!dados.dataFuturaAutorizada) erros.push('DATA_FUTURA'); // sentinela: a tela decide se pede confirmação

  // Registro duplicado (mesmo pivô + mesma data + mesmos horímetros, ativo)
  if(contexto&&contexto.duplicado) erros.push('Já existe um lançamento idêntico (mesmo pivô, data e horímetros) registrado.');

  return {valido:erros.length===0,erros};
}

/* Par hora inicial/final válido para qualquer evento com duração (parada,
   aplicação de ferti...) — só exige que ambas existam e sejam diferentes;
   a duração em si é calculada por `calcDuracaoHoras`. */
function temposValidos(horaInicial,horaFinal){
  return !!horaInicial&&!!horaFinal&&horaInicial!==horaFinal;
}

function validarParada(dados){
  const erros=[];
  if(!dados.pivoId) erros.push('Selecione um pivô.');
  if(!dados.falhaId) erros.push('Selecione categoria e motivo.');
  if(!dados.data) erros.push('Informe a data.');
  if(!dados.horaInicial) erros.push('Informe a hora inicial.');
  if(!dados.horaFinal) erros.push('Informe a hora final.');
  if(erros.length) return {valido:false,erros};

  if(!temposValidos(dados.horaInicial,dados.horaFinal)) erros.push('Hora inicial e final não podem ser iguais.');
  if(dataEhFutura(dados.data)&&!dados.dataFuturaAutorizada) erros.push('DATA_FUTURA');

  return {valido:erros.length===0,erros};
}

function validarFertirrigacao(dados){
  const erros=[];
  if(!dados.pivoId) erros.push('Selecione um pivô.');
  if(!dados.produtoId) erros.push('Selecione o produto.');
  if(!dados.cultura) erros.push('Selecione a cultura.');
  if(!dados.data) erros.push('Informe a data.');
  if(!dados.horaInicial) erros.push('Informe a hora inicial.');
  if(!dados.horaFinal) erros.push('Informe a hora final.');
  if(dados.quantidadeAplicada===''||dados.quantidadeAplicada===null||dados.quantidadeAplicada===undefined) erros.push('Informe a quantidade aplicada.');
  if(erros.length) return {valido:false,erros};

  if(!temposValidos(dados.horaInicial,dados.horaFinal)) erros.push('Hora inicial e final não podem ser iguais.');
  if(!(Number(dados.quantidadeAplicada)>0)) erros.push('Quantidade aplicada deve ser maior que 0.');
  if(dataEhFutura(dados.data)&&!dados.dataFuturaAutorizada) erros.push('DATA_FUTURA');

  return {valido:erros.length===0,erros};
}
