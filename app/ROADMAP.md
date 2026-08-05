# Roadmap — Sistema de Horímetros para Pivôs de Irrigação

## Situação atual (v3.x)

Reconstrução completa do sistema em HTML/CSS/JavaScript puro (sem Node.js, sem frameworks), com persistência local (`localStorage`) e arquitetura em camadas (`js/services/*.js` para regras de negócio, telas só consumindo os serviços). Concluído até aqui:

| Etapa | Módulo | Status |
|---|---|---|
| 1 | Estrutura e correção dos dados de referência | ✅ Concluída |
| 2 | Interface, Dashboard e Horímetros completos | ✅ Concluída |
| 3 | Indicadores (falhas, MTBF/MTTR, disponibilidade) | ✅ Concluída |
| 4 | Paradas operacionais | ✅ Concluída |
| 5 | Fertirrigação | ✅ Concluída |
| 6 | Importação de Planejamento (Excel/CSV) | ✅ Concluída |
| 7 | Atualização de Lâmina (calibração) | ✅ Concluída |
| 8 | Validação geral, otimização, documentação técnica | ✅ Concluída |
| — | Redesign completo de interface (UI/UX) | ⏳ Planejado, aguardando autorização explícita |

Serviços já existentes: `horimetro.js`, `indicador.js`, `parada.js`, `fertirrigacao.js`, `planejamento.js`, `importacao.js`, `calibracao.js` — mais o motor genérico de Cadastros (`cadastro.js`, 15 entidades) e o serviço de Auditoria (`audit.js`). Documentação de arquitetura/técnica/design system produzida na Etapa 8: ver `ARQUITETURA.md`, `DOCUMENTACAO_TECNICA.md`, `DESIGN_SYSTEM.md`, `CHANGELOG.md`.

Este roadmap trata das versões **depois** da Etapa 8 e do redesign — ou seja, o que vem depois do sistema estar funcionalmente completo e com a interface definitiva.

---

## Versão 4.0 — Integração com Firebase

Objetivo: substituir o `localStorage` por persistência real na nuvem, sem alterar as regras de negócio já construídas (cada serviço muda só a função que lê/grava — `horimetroTodos`/`horimetroSalvarTudo` e equivalentes — o resto do serviço permanece igual).

- **Integração com Firebase** — inicialização do projeto (Firestore, Auth, Storage), mantendo a mesma estrutura de `services/` já validada.
- **Autenticação de usuários** — login real (hoje o app não tem autenticação nenhuma), substituindo o placeholder `coi_user` usado pela Auditoria.
- **Firestore** — cada serviço (`coi_horimetro_lancamentos`, `coi_paradas`, `coi_ferti`, `coi_planejamento`, `coi_calibracoes`, `cad_*`, `coi_audit`) vira uma coleção; o padrão de versionamento permanente (grupoId/versao/atual) já usado no localStorage se traduz diretamente para documentos Firestore.
- **Backup automático** — nativo do Firestore/Firebase, sem trabalho adicional de aplicação.
- **Sincronização entre dispositivos** — consequência direta de sair do `localStorage` (que é por navegador/máquina) para um banco central.
- **Controle de permissões por perfil** — a estrutura de auditoria já registra `usuario_id`/`operacao`/`timestamp`; falta o conceito de perfil (ex.: Operador, Técnico, Gestor, Administrador) e regras de acesso por tela/ação.
- **Registro de logs de acesso** — login/logout, tentativas falhas — complementar à auditoria de dados que já existe.

### Mapeamento de pontos de troca (localStorage → Firebase)

Levantado na Etapa 8 (documentação, nenhum código Firebase implementado). Toda leitura/escrita passa hoje por `lsGet`/`lsSet` (`js/storage.js`) — a troca de backend se resume a reimplementar essas duas funções por serviço, sem tocar nas regras de negócio:

| Chave localStorage hoje | Dono (serviço) | Equivalente Firestore |
|---|---|---|
| `coi_horimetro_lancamentos` | `horimetro.js` | coleção `horimetros` (doc por versão, campo `grupoId` indexado) |
| `coi_indicador_ocorrencias` | `indicador.js` | coleção `indicadores` |
| `coi_paradas` | `parada.js` | coleção `paradas` |
| `coi_ferti` | `fertirrigacao.js` | coleção `fertirrigacao` |
| `coi_planejamento` | `planejamento.js` | coleção `planejamento` |
| `coi_calibracoes` | `calibracao.js` | coleção `calibracoes` |
| `cad_fazendas`, `cad_pivos`, ... (15 chaves) | `cadastro.js` (`CAD_ENTITIES`) | uma coleção por entidade, ou subcoleções sob `cadastros/{entidade}` |
| `coi_audit` | `audit.js` | coleção `auditoria` (sem limite de 500 — paginar por data) |
| `coi_theme`, `coi_sidebar_collapsed` | `nav.js` (preferência local de UI) | permanece local (não é dado de negócio) ou vira campo do perfil do usuário |

**Autenticação**: hoje `auditLog` grava sempre `usuario:'Operador Local'` — vira `firebase.auth().currentUser`. **Permissões**: nenhuma tela hoje restringe ação por papel — precisa de um conceito de perfil ainda não modelado. **Sincronização/backup**: automáticos ao adotar Firestore, sem trabalho de aplicação além da migração das funções de acesso.

## Versão 5.0 — Evolução do aplicativo de lançamentos

Depende da v4.0 para os itens que envolvem múltiplos usuários/dispositivos (favoritos, assinatura, anexos).

- **Exportação avançada para Excel e PDF** — os módulos de Horímetro/Paradas/Fertirrigação/Indicadores/Planejamento já têm consultas reutilizáveis (`horimetroConsultar`, `paradaConsultar`, `fertiConsultar`, `planejamentoConsultar`) preparadas exatamente para isso — a exportação em si ainda é só CSV.
- **Relatórios personalizados** — combinar essas consultas com filtros escolhidos pelo usuário.
- **Dashboards configuráveis pelo usuário** — escolher quais KPIs/gráficos aparecem e em que ordem.
- **Filtros salvos** — persistir combinações de filtro usadas com frequência.
- **Favoritos** — pivôs, relatórios ou telas marcados para acesso rápido.
- **Pesquisa global avançada** — evoluir a busca rápida do topbar (hoje só por página/pivô) para cobrir produtos, falhas, operadores etc.
- **Histórico completo de alterações** — já existe por módulo (versionamento + auditoria); esta etapa é sobre uma visão unificada entre todos os módulos.
- **Assinatura digital dos lançamentos** — confirmação formal de quem validou um registro, útil para auditoria externa.
- **Anexos de fotos e documentos** — evidências junto a lançamentos de Paradas/Indicadores (foto do defeito, nota fiscal do produto etc.) — depende do Firebase Storage (v4.0).
- **Melhorias de desempenho e otimização** — revisão geral após a base de dados crescer em produção.

## Versão 6.0 — Aplicativo PWA e uso offline

- **Aplicativo PWA** — manifest + service worker, instalável no celular/tablet do operador de campo.
- **Funcionamento offline** — crítico para quem lança dados no pivô sem sinal.
- **Sincronização automática quando houver conexão** — fila de alterações locais que sobe para o Firestore assim que a rede voltar.
- **Cache inteligente** — dos dados de referência (cadastros, catálogo de falhas/produtos) para uso offline.
- **Melhor desempenho em dispositivos móveis** — revisão de UI/gráficos para telas pequenas e conexões ruins.
- **Notificações de lembretes** — lançamentos pendentes (ex.: pivô operando há N horas sem novo horímetro registrado).
- **Melhorias de usabilidade e acessibilidade** — revisão de contraste, tamanho de toque, leitura por teclado/leitor de tela.

---

## Fora de escopo por enquanto

- Integração com o sistema "Chamados SC" — explicitamente adiada desde o início do projeto (v3.0).
- Qualquer dependência de Node.js ou framework de build — mantido HTML/CSS/JS puro em todas as versões acima; a única exceção já aceita no projeto é a biblioteca SheetJS (via CDN, só para leitura de Excel).
