# Documentação Técnica

Referência de todos os serviços, estrutura de dados, validações, cálculos, auditoria, importação e dashboards. Para a visão geral de pastas/camadas, ver `ARQUITETURA.md`.

---

## `js/services/calculos.js` — funções puras de cálculo

Nenhuma acessa DOM ou storage; todas recebem os dados como parâmetro.

| Função | O que faz |
|---|---|
| `calcHoras(h1,h2)` | Horas = h2 - h1 (horímetro) |
| `calcLamina(percentual,laminaBase100)` | Lâmina aplicada num percentual: `base/(percentual/100)` |
| `calcLaminaBase100(percentualUtilizado,laminaMedida)` | Inverso do anterior — calibração: `medida × (percentual/100)` |
| `calcVariacao(valorAnterior,valorNovo)` | `{diferenca, percentual}` entre dois valores |
| `calcDuracaoHoras(horaInicial,horaFinal)` | Duração entre dois horários "HH:MM" (Paradas, Fertirrigação, Calibração usa hora simples) — assume +24h se final < inicial |
| `calcAcumulado(lista,campo='horas')` | Soma de um campo numérico |
| `calcMediaDiaria(lista,campo)` | Acumulado ÷ nº de dias distintos |
| `calcMediaMensal(lista,campo)` | Média dos meses com lançamento |
| `calcUtilizacao(lista,dataIni,dataFim,campo)` | % do valor acumulado sobre o total possível no período (dias×24h) |
| `agruparPorChave(lista,resolverChave,resolverValor)` | Agrupamento genérico — base de todos os `agruparPorX` e `xPor Y` dos serviços |
| `agruparPorMes/Ano/Safra(lista,campo)` | Agrupamentos de tempo, construídos sobre `agruparPorChave` |
| `semanaAtual(dataRef)` | `{inicio,fim}` da semana (segunda a domingo) de uma data |

## `js/services/validacoes.js` — predicados e validadores

| Item | Uso |
|---|---|
| `horimetroInicialValido`, `horasValidas`, `percentualValido`, `dataEhFutura`, `temposValidos` | Predicados atômicos — usados tanto na validação final quanto no feedback ao vivo das telas (nunca duas implementações da mesma regra) |
| `validarHorimetroLancamento(dados,contexto)` | Regras do Horímetro (inclui redução de horímetro acumulado e duplicado) |
| `validarParada(dados)` | Regras de Parada |
| `validarFertirrigacao(dados)` | Regras de Fertirrigação |

Todo validador retorna `{valido, erros[]}`. A sentinela `'DATA_FUTURA'` em `erros` sinaliza a tela para pedir confirmação (`confirm()`) em vez de bloquear — exceto Planejamento, cujas datas futuras são esperadas (ver abaixo).

---

## Serviços transacionais

Todos seguem o mesmo modelo de registro:

```
{ id, grupoId, versao, atual, status, ...camposDoDominio, criadoEm }
```

`grupoId` é estável entre versões (= `id` da versão 1). Editar cria uma linha nova com `versao+1`, marca a antiga `atual:false` — nunca apaga. Excluir marca `status:'excluido'` — o registro nunca sai do array salvo. `xAtivos()` é sempre `atual && status==='ativo'`.

### `horimetro.js` — chave `coi_horimetro_lancamentos`
Campos: `pivoId, data, horaInicio, horimetroInicial, horimetroFinal, horas, percentual, lamina, pressao, horasOciosas, cultura, areaPivo, operador, observacao, safra`.
Funções-chave: `horimetroCriar/Atualizar/Excluir`, `horimetroUltimoDoPivo`, `horimetroPorPivo/Fazenda/CasaBomba`, `horimetroConsultar(filtros)`, `horimetroEvolucaoAcumulada`, `horimetroResumoPivo`.
Regra especial: `horimetroInicial` de um novo lançamento não pode ser menor que o `horimetroFinal` do último lançamento ativo do mesmo pivô (não retroceder o odômetro do equipamento).

### `indicador.js` — chave `coi_indicador_ocorrencias`
Campos: `pivoId, falhaId (FK cadastro Falhas), data, observacao`.
Funções-chave: `indicadorCriar/Atualizar/Excluir`, `indicadorPorPivo/Fazenda/CasaBomba`, `indicadorMTBF(pivoId)` (dias entre falhas, `null` se <2 ocorrências), `indicadorMTTR(pivoId)` (delegado a Paradas — ver abaixo), `indicadorDisponibilidade/Utilizacao/Eficiencia(dataIni,dataFim)`, `indicadorHorasHoje/Semana/Mes/Safra/PorPivo/Fazenda/CasaBomba/Operador` (todos sobre dados de Horímetro), `indicadorDistribuicaoCategoria`, `indicadorEvolucaoMensal(nMeses)`.
**Nota de integração:** desde a Etapa 4, `indicadorMTTR`/`indicadorTempoParado` leem de `paradaAtivas()` — o campo antigo `tempoParadoHoras` na própria ocorrência de indicador foi removido (duplicava a mesma informação).

### `parada.js` — chave `coi_paradas`
Campos: `pivoId, falhaId (FK Falhas), data, horaInicial, horaFinal, tempoParadoHoras (calc), operador, tecnicoId (FK Técnicos), tipoParada ('Programada'|'Não Programada'), observacao`.
Funções-chave: `paradaCriar/Atualizar/Excluir`, `paradaPorPivo/Fazenda/CasaBomba`, `paradaConsultar(filtros)`, `paradasHoje/Semana/Mes`, `paradaTempoMedio`, `paradaRankingFalhas/Pivos`, `paradaPorCategoria`, `paradaEvolucaoMensal`, `paradaResumoPivo`.

### `fertirrigacao.js` — chave `coi_ferti`
Campos: `pivoId, produtoId (FK Produtos), cultura, safra, data, horaInicial, horaFinal, tempoAplicacaoHoras (calc), quantidadeAplicada, concentracao, volumeAgua, vazao, operador, observacao`.
Funções-chave: `fertiCriar/Atualizar/Excluir`, `fertiPorPivo/Fazenda/CasaBomba`, `fertiConsultar(filtros)`, `fertiProdutosMaisUtilizados`, `fertiPorPivoResumo/FazendaResumo/Cultura/SafraResumo/Operador`, `fertiResumoPivo`.

### `planejamento.js` — chave `coi_planejamento`
Campos: `pivoId, data, percentual, cultura, areaPivo, observacao`. **Diferença de regra:** data futura é esperada (é um plano) — não usa o gate `dataEhFutura` dos demais serviços.
Funções-chave: `planejamentoCriar/Atualizar/Excluir`, `planejamentoPorPivo/Fazenda`, `planejamentoConsultar(filtros)`, `planejamentoResumo(dataIni,dataFim)` — cruza com `horimetroConsultar` (mesmo pivô+data = "feito") para Planejado × Executado real.

### `calibracao.js` — chave `coi_calibracoes`
Campos: `pivoId, data, hora, operador, responsavelCalibracao (FK Técnicos), laminaMedida, percentualUtilizado, laminaCalculada100 (calc), diferencaAnterior, percentualVariacao, metodoCalibracao, observacoes`.
Ao salvar, chama `cadPatchRecord('pivos', pivoId, {laminaBase100: novoValor})` — mas só se esta continuar sendo a calibração mais recente do pivô (editar/excluir uma calibração antiga não sobrescreve um valor já superado por uma mais nova).
Funções-chave: `calibracaoCriar/Atualizar/Excluir`, `calibracaoPorPivo/Fazenda`, `calibracaoUltimaDoPivo`, `calibracaoUltimas(n)`, `calibracaoPivosSemCalibracao`, `calibracaoVencidas(diasValidade=180)` (estrutura preparada — não há regra oficial de validade ainda), `calibracaoEvolucaoPivo`.

### `importacao.js` — sem chave própria (nunca grava direto)
`IMPORT_PARSERS = {csv, xlsx, xls}` — registro extensível por extensão de arquivo. Fluxo: `importacaoParsearArquivo` → `importacaoValidarColunas` → `importacaoPreVisualizar` (valida cada linha contra os cadastros reais: Pivôs, Culturas, Fazendas, Casas de Bomba, Operadores, Áreas) → usuário corrige linhas inválidas na tela (`importacaoRevalidarLinha`) → `importacaoCommitar` chama `planejamentoCriar`/`Atualizar` linha a linha (nunca duplica a validação/gravação do Planejamento).

---

## Cadastros (`cadastro.js`)

Motor único (`CAD_ENTITIES`) para 15 entidades: `fazendas, setores, culturas, casasBomba, bombas, motores, paineis, sensores, operadores, tecnicos, pivos, falhas, categoriasProduto, unidadesMedida, produtos`. Cada entidade declara `label`, `labelField` e `fields[]` (tipo, obrigatório, `unique` ou `uniqueWith:[...]` para duplicidade composta, `ref` para FK). Funções genéricas: `cadAll/cadSaveAll/cadPatchRecord/cadLookupLabel/cadValidate/cadOpenForm/cadSubmitForm/cadDelete/cadRenderList/cadSort`. Seed inicial em `cadSeedIfEmpty()` (fazendas, pivôs a partir do ETL, culturas, catálogo de falhas do sistema legado, unidades/categorias/produtos de fertirrigação) — usa `cadEnsureDefaults` para reconciliar sem duplicar quando a lista mestre ganha itens novos.

## Auditoria (`audit.js`)

Chave `coi_audit` (máx. 500 eventos). `auditLog(tela,operacao,detalhe)` grava `{data,hora,usuario,tela,operacao,detalhe}` e já atualiza a tela de Auditoria. `usuario` hoje é sempre "Operador Local" (não há autenticação — ver ROADMAP.md v4.0).

## Dashboards

| Página | Dados reais (local) | Dados ETL (histórico, só leitura) |
|---|---|---|
| Dashboard Executivo | "Operação em Tempo Real" (`dashboard.js`) | "Analítico Consolidado" (`renderExec`) |
| Planejado × Executado | "Planejamento" (`renderPlanejamentoLocal` + `planUI`) | "Analítico Consolidado" (`renderIrrig`) |
| Fertirrigação | "Fertirrigação Operacional" (`renderFertiOperacional`) | "Analítico Consolidado" (`renderFerti`) |
| Horímetro | "Lançamentos Locais" + "Calibração de Lâmina" (`renderHorLocal`/`renderCalibracaoLocal`) | ETL (`renderHor`) |
| Indicadores | "Indicadores Operacionais" + "Paradas Operacionais" (`renderFalLocal`/`renderParadasLocal`) | "Analítico Consolidado" (`renderFal`) |
| Banco de Dados | Aba "Importar Planejamento" | Abas Executado/Paradas/Horímetro/Indicadores/Fertirrigação (ETL) |

Todas as seções "dados reais" chamam só os serviços — nenhum cálculo é feito na própria tela.
