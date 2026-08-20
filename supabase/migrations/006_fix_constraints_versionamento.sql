-- ============================================================
-- COI · Correção — constraint de versionamento ausente no banco real
-- Rode isto no Supabase (Dashboard → SQL Editor → New query → Run)
-- Idempotente e NÃO destrutivo: não apaga tabela nem dado nenhum.
-- ============================================================

-- Contexto (auditoria 20/08/2026): confirmado por teste real na API que
-- a versão das migrations 001-004 efetivamente aplicada no projeto é
-- ANTERIOR à correção que adicionou os índices únicos parciais
-- `uq_*_grupo_atual` (impedem duas versões "atual=true" no mesmo
-- grupo_id) — inserir uma 2ª linha atual=true no mesmo grupo foi aceito
-- pelo banco (HTTP 201), quando deveria ser rejeitado. Este arquivo
-- cria só o que está faltando, sem re-rodar o resto das migrations.

set search_path to coi, public;

-- ── PARTE 1 — DIAGNÓSTICO (rode e leia antes de seguir) ─────────────
-- Só SELECT, nada é alterado aqui. Se todas as 4 consultas abaixo
-- devolverem zero linhas, não há violação hoje e o Passo 2 (mais
-- abaixo) não vai alterar nenhuma linha — só criará os índices.
select grupo_id, count(*) from horimetro_lancamentos
  where atual=true group by grupo_id having count(*)>1;
select grupo_id, count(*) from paradas_lancamentos
  where atual=true group by grupo_id having count(*)>1;
select grupo_id, count(*) from calibracoes_lancamentos
  where atual=true group by grupo_id having count(*)>1;
select grupo_id, count(*) from planejamento_lancamentos
  where atual=true group by grupo_id having count(*)>1;

-- Índices já existentes hoje nestas 4 tabelas (para conferir o que a
-- PARTE 2 abaixo ainda precisa criar — os uq_*_grupo_atual não devem
-- aparecer aqui se a correção ainda não foi aplicada).
select tablename, indexname, indexdef from pg_indexes
  where schemaname='coi'
    and tablename in ('horimetro_lancamentos','paradas_lancamentos','calibracoes_lancamentos','planejamento_lancamentos')
  order by tablename, indexname;

-- ── PARTE 2 — CORREÇÃO ───────────────────────────────────────────────
-- Passo 1: normaliza qualquer violação já existente ANTES de criar o
--    índice único (senão o CREATE UNIQUE INDEX falha) — para cada
--    grupo_id com mais de uma linha atual=true, mantém atual=true só na
--    versão mais alta e marca as demais como atual=false. Não apaga
--    nada, não mexe em status/soft-delete, só corrige a flag `atual`
--    para refletir a regra de negócio (só a versão mais recente é a
--    vigente). Se não houver nenhuma violação, estes UPDATEs não afetam
--    nenhuma linha (idempotente).
update horimetro_lancamentos t set atual=false
where atual=true and versao < (
  select max(versao) from horimetro_lancamentos t2 where t2.grupo_id=t.grupo_id and t2.atual=true
);

update paradas_lancamentos t set atual=false
where atual=true and versao < (
  select max(versao) from paradas_lancamentos t2 where t2.grupo_id=t.grupo_id and t2.atual=true
);

update calibracoes_lancamentos t set atual=false
where atual=true and versao < (
  select max(versao) from calibracoes_lancamentos t2 where t2.grupo_id=t.grupo_id and t2.atual=true
);

update planejamento_lancamentos t set atual=false
where atual=true and versao < (
  select max(versao) from planejamento_lancamentos t2 where t2.grupo_id=t.grupo_id and t2.atual=true
);

-- ── Passo 2: cria os índices únicos parciais que realmente faltam ────
create unique index if not exists uq_horimetro_grupo_atual
  on horimetro_lancamentos (grupo_id) where atual = true;

create unique index if not exists uq_paradas_grupo_atual
  on paradas_lancamentos (grupo_id) where atual = true;

create unique index if not exists uq_calibracoes_grupo_atual
  on calibracoes_lancamentos (grupo_id) where atual = true;

create unique index if not exists uq_planejamento_grupo_atual
  on planejamento_lancamentos (grupo_id) where atual = true;

-- ── Passo 3: reconfirma grants (idempotente, mesma lista de 001) ────
grant usage on schema coi to anon, authenticated;
grant select, insert, update, delete on all tables in schema coi to anon, authenticated;
alter default privileges in schema coi
  grant select, insert, update, delete on tables to anon, authenticated;
