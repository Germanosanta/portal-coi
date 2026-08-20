# Migrations do Portal COI (Supabase)

Este projeto não usa Supabase CLI/build step — as migrations aqui são para
rodar manualmente no **SQL Editor** do painel do Supabase
(https://supabase.com/dashboard → seu projeto → SQL Editor → New query → Run),
na ordem numérica dos arquivos:

1. `migrations/001_horimetro.sql` — tabelas `pivos` + `horimetro_lancamentos`
2. `migrations/002_paradas.sql` — tabela `paradas_lancamentos`
3. `migrations/003_calibracao.sql` — tabela `calibracoes_lancamentos`
4. `migrations/004_planejamento.sql` — tabela `planejamento_lancamentos`
5. `migrations/005_energia.sql` — tabelas `pivos_potencia_tecnica` (ficha técnica
   do motor-bomba por pivô) e `consumo_energia_calculo` (memória de cálculo,
   1 snapshot por lançamento de Horímetro)
6. `migrations/006_fix_constraints_versionamento.sql` — índices únicos que
   impedem duas versões `atual=true` no mesmo `grupo_id` (já rodada e
   confirmada em 20/08/2026)
7. `migrations/007_horimetro_natural_key_area_pivo.sql` — corrige a chave
   natural de importação do Horímetro para incluir `area_pivo` (senão dois
   lançamentos reais do mesmo pivô/dia com quadrante diferente seriam
   tratados como duplicata) — rodar **antes** da 008
8. `migrations/008_horimetro_karitel_rdm_migrate.sql` — migra a staging do
   histórico Karitel/RDM para `horimetro_lancamentos` — rodar **depois** de
   importar `seed/karitel_rdm_import.csv` na tabela `horimetro_staging`

Todas são idempotentes (`create table if not exists`, `on conflict do nothing`)
— rodar de novo não duplica nada.

## Carga do histórico

`seed/horimetro_import.csv` — 8.122 registros reais extraídos de
`base de dados/banco-de-dados-horimetro.xlsx` (23/07/2025–08/08/2026),
normalizados (datas ISO, strings resolvidas). Depois de rodar
`001_horimetro.sql`:

1. No Supabase, Table Editor → tabela `horimetro_staging` → Insert → Import
   data from CSV → selecione `seed/horimetro_import.csv`.
2. Volte ao SQL Editor e rode de novo o bloco final de `001_horimetro.sql`
   (o `INSERT INTO horimetro_lancamentos ... SELECT ... FROM horimetro_staging`)
   — ele já é o mecanismo de migração da staging para a tabela oficial.

Nenhum arquivo original da pasta `base de dados/` foi alterado ou apagado
para gerar este CSV.

## Consumo de Energia — ficha técnica dos pivôs

`seed/pivos_potencia_import.csv` — 108 pivôs (Karitel + RDM) extraídos de
`base de dados/informações pivôs e reservatorios Elavatórias Captacões e
Poços.xlsx`, aba "Infor_Pivos": fazenda, módulo, casa de bomba, marca,
área (ha), vazão (m³/h), potência (CV) e potência (kW, já convertida pela
própria planilha com fator 0,7457). 106 pivôs têm potência; 2 (Pivô 75 e
76 da Karitel) não têm — marcados `DADO_NAO_DISPONIVEL`, não preenchidos
com estimativa. Depois de rodar `005_energia.sql`: importe este CSV na
tabela `pivos_potencia_staging` (mesmo processo do Horímetro) e rode de
novo o bloco de `INSERT INTO pivos_potencia_tecnica ...` do final do
arquivo.

## Estado em 20/08/2026

Confirmado por teste real na API (curl com a chave `anon` do app,
header `Accept-Profile: coi`) que as migrations 001-005 **foram
aplicadas** no projeto real (`hzduodmytbkqjbbyizkb`) — as 7 tabelas
existem em `coi` e respondem SELECT/INSERT/UPDATE/DELETE normalmente,
e o schema `coi` já está na lista "Exposed schemas" da API.

Registros encontrados (20/08/2026): `pivos`=3, `horimetro_lancamentos`=3,
`paradas_lancamentos`=6, `consumo_energia_calculo`=2,
`calibracoes_lancamentos`=0, `planejamento_lancamentos`=0,
`pivos_potencia_tecnica`=0 — ou seja, a carga em massa dos CSVs
(`seed/horimetro_import.csv` com 8.122 linhas e
`seed/pivos_potencia_import.csv` com 108 linhas) **ainda não foi feita**;
só existem alguns lançamentos manuais/pontuais.

**Gap real encontrado nesta auditoria**: a versão das migrations 001-004
de fato aplicada é anterior à correção que adicionou os índices únicos
parciais (`uq_*_grupo_atual`, impedem duas versões "atual=true" no
mesmo `grupo_id`) — testado inserindo uma 2ª linha atual=true no mesmo
grupo em `horimetro_lancamentos`: o banco aceitou (deveria rejeitar).
Corrigido pela migration `006_fix_constraints_versionamento.sql`
(idempotente, não destrutiva — normaliza qualquer violação existente
antes de criar os índices). **Ainda precisa ser rodada manualmente no
SQL Editor** — este ambiente não tem credencial de DDL (`service_role`/
access token/Supabase CLI logado), só a chave `anon` já usada pelo app,
que só faz SELECT/INSERT/UPDATE/DELETE respeitando RLS, nunca DDL.

Testado e confirmado via API real (dados de teste criados e removidos
na mesma sessão, banco não ficou com resíduo): INSERT/versionamento/
soft-delete/consulta de ativos em `horimetro_lancamentos`, e INSERT em
`calibracoes_lancamentos`, `planejamento_lancamentos` e
`pivos_potencia_tecnica` — todas gravam de verdade em `coi.*`.
