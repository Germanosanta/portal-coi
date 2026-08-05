# Design System — Baseline Atual (v2.0)

Este documento registra o design system **hoje**, como insumo para a futura fase de redesign. Nenhuma tela ou regra visual foi alterada na Etapa 8 — este é um levantamento, não uma proposta. Fonte: `css/styles.css`.

## Paleta de cores

**Marca** (`--brand-50`…`--brand-900`): verde, de `#e8f5f0` a `#084d30`. Cor de ação principal: `--brand-600` (`#168f60`).

**Neutros** (`--n0`…`--n950`): escala de cinza/azul-acinzentado de `#ffffff` a `#060d1a`, usada para texto, bordas e fundos.

**Semânticas**: `success` (verde `#16a34a`), `warning` (âmbar `#d97706`), `danger` (vermelho `#dc2626`), `info` (azul `#2563eb`), mais `purple`, `sky`, `amber` como cores de destaque adicionais para categorização (ex. KPIs). Cada semântica tem variante `-l` (fundo claro) e `-d` (texto escuro/contraste).

**Tokens de UI** (`--bg-app/surface/surface2/surface3`, `--border`, `--border-strong`, `--text-primary/secondary/tertiary/inverse`) são redefinidos inteiramente em `[data-theme="dark"]` — todo componente deve usar os tokens, nunca a cor bruta, para funcionar nos dois temas (já é a prática consistente no CSS atual).

**Sidebar** tem seu próprio conjunto de tokens (`--sb-*`), sempre escuro (verde-petróleo), independente do tema claro/escuro do restante da aplicação — decisão visual deliberada, não um esquecimento.

## Tipografia

Fonte única: **Inter** (Google Fonts, `@import`), pesos 300–900. `html{font-size:13.5px}` como base — todo o restante do sistema usa `px` relativos a essa base (não `rem` de 16px), efetivamente uma UI compacta/densa por design (adequado a telas de operação com muitas tabelas/KPIs).

Escala observada: 8px (rótulos de seção) → 9–11px (labels, badges, hints) → 12–13px (corpo, inputs, tabela) → 14–15px (títulos de modal/gauge) → 18px (título de página) → 24px (valor de KPI).

## Espaçamento e forma

Sem uma escala de espaçamento nomeada (tokens `--space-*`) — os valores usam `rem`/`px` diretos por componente (`.75rem`, `1.1rem`, etc.), consistentes por convenção mas não centralizados. Raio de borda: `--radius-sm:6px`, `--radius:10px`, `--radius-lg:14px`, `--radius-xl:20px` (modais). Sombras em 5 níveis (`--shadow-xs` a `--shadow-xl`). Transições padronizadas: `--ease` (.18s) para a maioria das interações, `--ease-spring` para abertura de modal.

## Componentes existentes

- **Botões** (`.btn`): variantes `primary/secondary/ghost/danger/success`, tamanhos `xs/(padrão)/lg`, mais `.btn-icon` quadrado.
- **Cards** (`.card` com `-header/-body/-footer`), **KPI cards** (`.kpi`, 7 variantes de cor via `.kpi-{teal,green,blue,amber,red,purple,sky,gray}`, com accent-bar, ícone, barra de progresso opcional).
- **Grids de layout** utilitários: `.g2/.g3/.g4/.g21/.g12/.g13` (não são um grid system genérico configurável — cada combinação é uma classe fixa).
- **Tabelas** (`.table`, com header sticky, hover de linha, variante `.table-striped`).
- **Badges/pills** (`.badge` + `.b-{success,warning,danger,info,brand,purple,sky,neutral}`).
- **Gráficos** primitivos, todos desenhados em CSS/SVG puro (sem lib de charts): barra horizontal (`.bar-h`), donut (`.donut-*`), gauge (`.gauge-*`), heatmap (`.hm-*`), barra de consolidação empilhada (`.cons-bar/.cons-seg`).
- **Formulário** (`.field`, `.input/.select/.textarea`, estados `.error/.success`, `.input-calc` para campos calculados somente-leitura).
- **Tabs** (`.tabs/.tab-btn/.tab-panel`).
- **Modal** (`.modal-overlay/.modal`, com `backdrop-filter` e animação spring).
- **Toast** (`.toast-container/.toast`, variantes `ok/err/warn/info`).
- **Tooltip** (`.tooltip-wrap/.tooltip-box`).
- **Filtros** (`.filter-bar/.filter-field`), **paginação** (`.pag/.pag-btn`).
- **Empty state** (`.empty-state`), **status indicator** (`.status-indicator` + `.si-{ok,warn,err,gray}`).
- **Barra superior**: busca global (`.tb-search/.gs-*`) e painel de notificações (`.tb-notif/.notif-*`), ambos com resultados dinâmicos.
- **Sidebar**: navegável, recolhível, com seções, item ativo, badge numérico, submenu (`.nav-sub`), item de rodapé.

## Ícones

SVG inline (stroke-based, `stroke-width` entre 1.85 e 2.5, sem preenchimento) — sem biblioteca de ícones externa; cada ícone é escrito diretamente no HTML/JS que o usa.

## Temas

Claro (padrão) e escuro (`[data-theme="dark"]`, alternado via `nav.js`, persistido em storage). Cobertura completa dos tokens de UI — nenhum componente hardcoda cor fora do tema, com a única exceção proposital da sidebar (sempre escura).

## Responsividade

Breakpoints: `1024px` (grids 3/4 colunas colapsam para 2), `768px` (sidebar vira off-canvas, grids colapsam para 1 coluna, KPIs para 2 colunas), `420px` (KPIs para 1 coluna). Padrão mobile-first não é usado — é desktop-first com sobrescritas em `max-width`.

## Padrões de interação

- Estado ativo de página via classe `.page.active` (uma única página visível por vez, sem router de URL).
- Feedback de ação sempre via toast (nunca `alert()`, exceto confirmações destrutivas que usam `confirm()` nativo).
- Cálculos ao vivo em formulário usam `.input-calc` (visualmente diferenciado, somente leitura).
- Estado vazio de listas/tabelas sempre via `.empty-state`, nunca uma tabela em branco sem explicação.

## Achados do levantamento — candidatos para o redesign

Seletores CSS auditados na Etapa 8 e confirmados **sem nenhuma referência** em HTML/JS (nem literal nem construída dinamicamente): `form-grid`, `form-row-2/3/4`, `tooltip-wrap`/`tooltip-box`, `etl-step*`, `cons-bar`/`cons-seg`, `btn-lg`, `btn-success`, `b-sky`, `si-err`/`si-gray`/`si-warn` (parcialmente — alguns usados, outros não conforme o serviço), `table-striped`, `nav-sub*`/`has-sub`, `gauge-val`, `input-calc` (usado só via `#lh-...`, não pela classe genérica em outras telas), `loading-dot`, `field-error`, `filter-actions`, `tb-status-dot`, `g12`, `g13`.

**Decisão desta etapa**: mantidos no CSS sem remoção — excluir classes exigiria também revisar se alguma tela as reintroduz em edições futuras, e o escopo da Etapa 8 proíbe alterar telas/identidade visual. Ficam registrados aqui como **entrada direta para a próxima fase** (Design System novo + redesign): cada um deve ser recriado com intenção (ex. tooltip e tabela zebrada são padrões desejáveis) ou descartado deliberadamente, não apenas apagado por estar sem uso hoje.

## O que este documento não é

Não é uma proposta de novo Design System — isso é o objeto da próxima fase, já aprovada conceitualmente pelo usuário mas **não iniciada**, aguardando um protótipo completo para aprovação antes de qualquer alteração de tela.
