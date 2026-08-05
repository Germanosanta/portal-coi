# Arquitetura — Sistema de Horímetros para Pivôs de Irrigação

## Stack

HTML5 + CSS3 + JavaScript puro (ES2017+). Sem Node.js, sem framework, sem bundler/build step. Toda a aplicação roda a partir de `index.html` carregando scripts clássicos (`<script src="...">`, em ordem de dependência).

**Única dependência externa do projeto:** SheetJS (`xlsx`), via CDN, exclusivamente para ler arquivos `.xlsx`/`.xls` binários na Importação de Planejamento (não é viável parsear esse formato em JS puro). Nenhum outro módulo depende de bibliotecas externas.

## Estrutura de pastas

```
index.html              Marcação de todas as páginas + <script> na ordem de carga
css/styles.css          Todo o CSS (design system atual — ver DESIGN_SYSTEM.md)
assets/                 Logo e identidade visual
img/                    Reservado para ícones/imagens (redesign)
data/                   JSON estáticos (base ETL histórica + sementes de cadastro)
firebase/               Placeholders para a futura integração (v4.0 do ROADMAP.md)
js/
  format.js             Helpers de formatação (fmt, fmtD, fmtP, today, gId, v, clrEl...)
  storage.js            Única camada de acesso ao localStorage (lsGet/lsSet, com cache)
  audit.js              Auditoria genérica (auditLog/auditAll/renderAudit)
  charts.js             Primitivas de gráfico (barH, lineChart, donut, gauge, kpi, emEl, badge)
  filters.js            Filtros/paginação da base ETL (páginas Irrig/Ferti/Itv/Hor/Dados)
  cadastro.js           Motor genérico de CRUD (CAD_ENTITIES) + cadPatchRecord
  render.js             Renderização de todos os dashboards (goPage + renderX)
  dashboard.js          Widget "Operação em Tempo Real" do Dashboard Executivo
  lanc.js               Controllers de tela dos módulos de lançamento (lhm/lhf/lp/lft/lc)
  importacao-ui.js       Controllers de tela da Importação (imp) e do Planejamento (planUI)
  nav.js                Navegação, tema, sidebar, busca global, notificações, toasts
  export.js             Exportação CSV
  data-loader.js        Carrega data/*.json → globais D/EXE_D/ITV_D/HOR_D/FERTI_D/FAL_D/...
  main.js               Bootstrap (DOMContentLoaded → initApp)
  services/
    calculos.js          Funções puras de cálculo (sem DOM, sem storage)
    validacoes.js        Predicados e validadores (sem DOM, sem storage)
    horimetro.js          CRUD + consultas de lançamentos de Horímetro
    indicador.js          CRUD + consultas de ocorrências de Falha/Indicador
    parada.js             CRUD + consultas de Paradas operacionais
    fertirrigacao.js      CRUD + consultas de Fertirrigação
    planejamento.js        CRUD + consultas de Planejamento (o que deve ser irrigado)
    importacao.js         Parsing/validação/pré-visualização/efetivação de arquivos
    calibracao.js          CRUD + consultas de Calibração de Lâmina
```

## Camadas e responsabilidades

1. **Dados de referência (`data/*.json` + `data-loader.js`)** — snapshot ETL histórico (`D`, `EXE_D`, `ITV_D`, `HOR_D`, `FERTI_D`, `FAL_D`) e sementes iniciais de cadastro (`CULTURAS_ALL`, `AREAS_ALL`, `LAMINA_PIVOS_SEED`). É **só leitura em runtime** — nunca é regravado; o que muda a partir daqui vira sempre um registro real via `services/`.
2. **Cadastros (`cadastro.js`)** — motor único de CRUD (`CAD_ENTITIES`) para as 15 entidades cadastráveis (Fazendas, Setores, Culturas, Casas de Bomba, Bombas, Motores, Painéis, Sensores, Operadores, Técnicos, Pivôs, Falhas, Categorias de Produto, Unidades de Medida, Produtos). Armazenamento em `localStorage['cad_<entidade>']`.
3. **Serviços transacionais (`js/services/*.js`, exceto calculos/validacoes)** — um serviço por domínio operacional (Horímetro, Indicadores, Paradas, Fertirrigação, Planejamento, Calibração). Cada um:
   - é o **único** ponto que lê/grava sua própria chave de `localStorage`;
   - usa o mesmo modelo de **histórico permanente**: `id` (da versão), `grupoId` (estável entre versões), `versao` (inteiro), `atual` (bool), `status` (`'ativo'`/`'excluido'` — soft-delete, nunca remove do storage);
   - grava em auditoria (`auditLog`) toda inclusão/alteração/exclusão;
   - expõe consultas (`xPorPivo`, `xPorFazenda`, `xConsultar`) reutilizáveis pelo futuro módulo de Relatórios.
4. **Cálculo e validação (`services/calculos.js`, `services/validacoes.js`)** — funções puras (sem DOM, sem storage) compartilhadas por todos os serviços acima. Nenhuma fórmula (duração entre horários, percentual válido, agrupamento por chave/mês/ano/safra) é reescrita em mais de um lugar.
5. **Telas (`render.js`, `lanc.js`, `importacao-ui.js`, `nav.js`)** — só orquestram: leem o formulário, chamam a função do serviço certo, mostram o resultado. Nenhuma tela acessa `localStorage` diretamente nem recalcula uma regra que já existe em `services/`.

## Fluxo de navegação

`goPage(id)` (em `render.js`) troca a página ativa e chama a função `renderX()` correspondente, que sempre recalcula do zero a partir dos serviços — não existe cache de tela nem necessidade de "avisar" outras páginas quando um dado muda: a próxima vez que a página for aberta, ela já lê o estado atual.

## Módulos de lançamento (tela "Lançamentos")

Uma única página (`page-lanc`) com 7 abas, cada uma com seu próprio controller em `js/lanc.js`, todas seguindo o mesmo padrão (cascata Fazenda→Pivô, cálculo ao vivo, salvar/editar/excluir/ver versões, histórico filtrável):

| Aba | Controller | Serviço |
|---|---|---|
| Horímetro | `lhm` | `horimetro.js` |
| Falha / Indicador | `lhf` | `indicador.js` |
| Parada | `lp` | `parada.js` |
| Fertirrigação | `lft` | `fertirrigacao.js` |
| Calibração de Lâmina | `lc` | `calibracao.js` |
| Histórico | `lhm` (aba própria) | `horimetro.js` |
| Auditoria | — | `audit.js` |

## Padrões de arquitetura que devem ser preservados

- **Uma responsabilidade, um dono**: cada dado tem exatamente um serviço responsável por gravá-lo. Fazenda/Casa de Bomba de um lançamento nunca são redigitadas — são sempre derivadas do Pivô selecionado (FK).
- **Categoria/Motivo/Submotivo/Prioridade/Criticidade** (Falhas) e **Produto/Categoria/Unidade** (Fertirrigação) vêm sempre do cadastro correspondente — nunca há lista fixa no código para esses conceitos.
- **Histórico permanente**: Horímetro, Paradas, Fertirrigação, Planejamento e Calibração nunca sobrescrevem um registro — sempre versão nova. Cadastros (`cadastro.js`) usam edição direta (não versionada) por serem dados de configuração, não histórico operacional.
- **`cadPatchRecord`**: quando um serviço precisa atualizar um campo de um cadastro como efeito colateral (ex.: Calibração atualizando `laminaBase100` do Pivô), ele passa por essa função — nunca grava direto na chave `cad_*`.
- **Sem dependência externa** além do SheetJS, já justificado acima.
