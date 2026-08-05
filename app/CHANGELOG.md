# Changelog

Histórico das etapas de reconstrução do sistema (vanilla HTML/CSS/JS, sem Node/framework/build). Cada etapa foi implementada, validada e reportada individualmente, com autorização explícita do responsável antes de iniciar a seguinte.

## Etapa 1 — Estrutura base
- Criada a estrutura de pastas (`css/`, `js/`, `assets/`, `img/`, `firebase/`, `data/`).
- `index.html` único, com marcação de todas as páginas e carregamento de scripts clássicos em ordem de dependência.
- Análise comparativa do sistema legado (`front-sistema-de-lancamentos.onrender.com`) — recuperada a fórmula real de lâmina (`lamina(%) = laminaBase100/(percentual/100)`), a tabela de calibração de 106 pivôs (`data/lamina_pivos.json`) e a taxonomia Categoria→Motivo de Falhas, usadas como referência funcional (layout e código não reaproveitados).

## Etapa 2 — Interface e Dashboard
- Sidebar recolhível, barra superior, tema claro/escuro, layout responsivo, KPIs, notificações, breadcrumb, pesquisa rápida.
- Introduzida a camada `services/` (`horimetro.js`, `calculos.js`, `validacoes.js`) — decisão arquitetural que se manteve para todos os módulos seguintes: nenhuma tela acessa `localStorage` diretamente.
- Módulo de Horímetros completo: histórico permanente (`grupoId`/`versao`/`atual`/`status`), impedimento de retrocesso do horímetro, linha do tempo por pivô.

## Etapa 3 — Indicadores
- Módulo de Indicadores: MTBF, disponibilidade/utilização/eficiência, horas por dia/semana/mês/safra/pivô/fazenda/casa de bomba/operador.
- Cadastro configurável de Falhas (categoria/motivo/submotivo/prioridade/criticidade) — substituiu listas fixas em código.
- Dashboards e gráficos passaram a consumir exclusivamente dados reais de Horímetro (sem simulação quando há dado real).

## Etapa 4 — Paradas Operacionais
- `services/parada.js`: CRUD completo, cálculo automático de tempo parado/disponibilidade, histórico e ranking por pivô.
- Integração: registrar uma parada atualiza Indicadores/Dashboard/Auditoria automaticamente, sem recálculo manual.
- Campo `tempoParadoHoras` do Indicador removido (duplicava a mesma informação agora vinda de Paradas); Indicadores passou a delegar MTTR/tempo parado a `parada.js`.

## Etapa 5 — Fertirrigação
- `services/fertirrigacao.js`, com os novos cadastros reutilizáveis Categoria de Produto, Unidade de Medida e Produto (mesmo motor genérico de CRUD).
- Cálculos, histórico, dashboard e gráficos seguindo o mesmo padrão de Paradas.

## Etapa 6 — Importação de Planejamento
- `services/importacao.js`: arquitetura extensível por formato (`IMPORT_PARSERS`: csv/xlsx/xls), única dependência externa do projeto (SheetJS, via CDN, só para binários .xlsx/.xls).
- Tela de pré-visualização com validação linha a linha contra os cadastros reais (pivôs, fazendas, casas de bomba, culturas, operadores, áreas), contagem de válidos/erros/avisos, correção antes de efetivar.
- Efetivação delega 100% da gravação a `planejamento.js` — a importação nunca grava direto.

## Etapa 7 — Atualização de Lâmina (Calibração)
- `services/calibracao.js`: CRUD com histórico permanente, cálculo de lâmina equivalente a 100% (`calcLaminaBase100`, reintroduzida após ter sido removida como prematura na Etapa 2), diferença e % de variação (`calcVariacao`, nova).
- Integração via `cadPatchRecord`: uma calibração aprovada atualiza `laminaBase100` do Pivô automaticamente, só quando é a versão mais recente.
- `calcTempoParado` renomeada para `calcDuracaoHoras` e `paradaTemposValidos` para `temposValidos`, para reuso entre Paradas e Fertirrigação sem duplicar a fórmula.

## Documentação intermediária
- `ROADMAP.md` criado, planejando v4.0 (Firebase: Auth/Firestore/backup/sync/permissões/logs), v5.0 (exportações avançadas/relatórios/dashboards configuráveis/filtros salvos/favoritos/busca global/histórico de alterações/assinatura digital/anexos/performance) e v6.0 (PWA/offline/sync/cache/performance mobile/lembretes/acessibilidade).

## Etapa 8 — Validação Geral, Otimização e Documentação Técnica
- **Auditoria**: varredura completa de IDs/funções/constantes duplicadas, listeners duplicados, código morto, arquivos/imports/scripts sem uso. Sem novos módulos de negócio (fora do escopo desta etapa).
- **Bugs corrigidos** (ambos usavam chaves legadas nunca escritas pelos serviços reais):
  - `renderCfg()` — contagem de "Lançamentos locais" ficava travada em zero; passou a ler `horimetroAtivos()/paradaAtivas()/fertiAtivos()/indicadorAtivos()/planejamentoAtivos()/calibracaoAtivas()`.
  - `confirmClear()` — botão "Limpar lançamentos locais" não apagava dado real nenhum; passou a limpar as chaves reais dos 6 serviços via `LANCAMENTOS_KEYS()`, com registro em auditoria.
- **Arquivos removidos**: `js/auth.js`, `js/security.js`, `js/relatorios.js` — stubs de comentário do Módulo 1, nunca referenciados em nenhum `<script>` do `index.html`.
- **`js/data-loader.js` reescrito**: removidos 5 fetches e globais nunca consumidos em runtime (`cmap.json`, `statuses_f.json`, `causas_itv.json`, `pivos_all.json`, `ultimos_horimetros.json`). Os arquivos JSON permanecem em `data/` (sem controle de versão no projeto para recuperá-los caso a remoção fosse revertida).
- **`js/storage.js` reescrito**: removida a estrutura legada `K`/`gdb`/`sdb`; adicionado cache em memória (`_lsCache`) em `lsGet`, invalidado em `lsSet` — reduz `JSON.parse` repetido em laços de agregação sobre a mesma chave.
- **Documentação criada**: `ARQUITETURA.md`, `DOCUMENTACAO_TECNICA.md`, `DESIGN_SYSTEM.md` (baseline atual, sem alterar nenhuma tela), `CHANGELOG.md` (este arquivo); `ROADMAP.md` atualizado com o status desta etapa.
- **Preparação para Firebase**: apenas documentada (nenhum código Firebase implementado) — ver seção correspondente em `DOCUMENTACAO_TECNICA.md`/`ROADMAP.md`.
- **Não realizado nesta etapa, por decisão explícita**: qualquer alteração de CSS/layout/identidade visual. O levantamento de seletores CSS não utilizados (~30 classes, ex. `form-grid`, `tooltip-wrap`, `etl-step*`) foi documentado em `DESIGN_SYSTEM.md` como candidato para a fase de redesign, e não removido nem refatorado.
