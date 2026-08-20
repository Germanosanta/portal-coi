-- ============================================================
-- COI · Carga do histórico Karitel/RDM (Horímetro) para coi.horimetro_lancamentos
-- Rode isto no Supabase (Dashboard → SQL Editor → New query → Run)
-- Pré-requisitos, NESTA ORDEM:
--   1) 006_fix_constraints_versionamento.sql (já rodada, confirmada)
--   2) 007_horimetro_natural_key_area_pivo.sql (chave natural com area_pivo)
--   3) Reimportar supabase/seed/karitel_rdm_import.csv na tabela
--      `horimetro_staging` (Table Editor → horimetro_staging → Insert →
--      Import data from CSV) — mesma tabela já usada para o CSV original
--      de 8.122 linhas, mesmíssimas colunas. Pode importar sem limpar a
--      staging antes: o INSERT abaixo é idempotente (ON CONFLICT DO
--      NOTHING pela chave natural), não duplica nada mesmo se a staging
--      tiver as duas cargas juntas.
-- Idempotente. NÃO faz DROP/DELETE/TRUNCATE. NÃO altera status/atual
-- de nenhum registro existente. NÃO substitui nenhum dos registros já
-- inseridos anteriormente (chave natural garante isso).
-- ============================================================

set search_path to coi, public;

-- 1) Cria os pivôs do histórico Karitel/RDM que ainda não existem em
--    coi.pivos (99 pivôs no CSV; os que já existem são ignorados por
--    on conflict — nunca duplica, nunca sobrescreve os já cadastrados).
insert into pivos (numero)
select distinct pivo::integer
from horimetro_staging
where pivo ~ '^\d+$'
on conflict (numero) do nothing;

-- 2) Migra o histórico da staging para a tabela oficial. area_pivo
--    (coluna "area" na staging) preserva EXATAMENTE o texto de origem —
--    "A", "B", "A+B", "A+B+C+D", variações como "B+A"/"C+B"/"b" etc,
--    sem normalizar nada. A chave natural (agora com area_pivo, migration
--    007) garante: duplicata exata (mesmo pivô+data+h1+h2+area) é
--    ignorada; dois lançamentos com quadrante diferente no mesmo
--    pivô/data/horímetro são preservados como registros distintos.
insert into horimetro_lancamentos
  (grupo_id, versao, atual, status, pivo_id, data, horimetro_inicial,
   horimetro_final, horas, percentual, lamina, cultura, area_pivo,
   observacao, operador, origem, criado_em)
select
  gen_random_uuid(), 1, true, 'ativo',
  p.id,
  s.data::date,
  s.horimetro1::numeric,
  s.horimetro2::numeric,
  nullif(s.horas,'')::numeric,
  nullif(s.percentual,'')::numeric,
  nullif(s.lamina,'')::numeric,
  nullif(s.cultura,''),
  nullif(s.area,''),
  nullif(s.observacao,''),
  nullif(s."user",''),
  'importacao_historica',
  now()
from horimetro_staging s
join pivos p on p.numero = s.pivo::integer
where s.pivo ~ '^\d+$'
on conflict do nothing;

-- 3) Verificação (só SELECT) — rode depois e confira contra o relatório:
--    esperado ~34.494 linhas novas de origem='importacao_historica' com
--    area_pivo <> 'COMPLETO' ou = 'COMPLETO' conforme o CSV, mais os
--    pivôs novos criados no passo 1.
select area_pivo, count(*) from horimetro_lancamentos
  where origem='importacao_historica'
  group by area_pivo order by count(*) desc;
