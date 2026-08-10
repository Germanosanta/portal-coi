# Migrations do Portal COI (Supabase)

Este projeto não usa Supabase CLI/build step — as migrations aqui são para
rodar manualmente no **SQL Editor** do painel do Supabase
(https://supabase.com/dashboard → seu projeto → SQL Editor → New query → Run),
na ordem numérica dos arquivos:

1. `migrations/001_horimetro.sql` — tabelas `pivos` + `horimetro_lancamentos`
2. `migrations/002_paradas.sql` — tabela `paradas_lancamentos`
3. `migrations/003_calibracao.sql` — tabela `calibracoes_lancamentos`
4. `migrations/004_planejamento.sql` — tabela `planejamento_lancamentos`

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

## Estado em 09/08/2026

Nenhuma destas migrations foi confirmada como aplicada no projeto Supabase
real — este ambiente de desenvolvimento não tem credencial de DDL
(`service_role`/access token), só a chave `anon` já usada pelo app
(`app/js/config/supabase.js`). Aplicar é uma ação manual, no painel do
Supabase, pela pessoa responsável pelo projeto.
