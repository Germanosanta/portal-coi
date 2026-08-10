-- ============================================================
-- COI · Ponto 5 — Planejamento / Feito·Não Feito (Supabase)
-- Rode isto no Supabase (Dashboard → SQL Editor → New query → Run)
-- Idempotente. Pré-requisito: schema_horimetro.sql já rodado (tabela `pivos`).
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists planejamento_lancamentos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null,
  versao integer not null default 1,
  atual boolean not null default true,
  status text not null default 'ativo',
  pivo_id uuid not null references pivos(id),
  data date not null,
  percentual numeric not null,
  cultura text,
  area_pivo text default 'COMPLETO',
  observacao text,
  nao_feito boolean not null default false,     -- Ponto 5 — FEITO é derivado (existe Horímetro na mesma data/pivô)
  motivo_nao_feito text,
  origem text not null default 'app',
  criado_em timestamptz not null default now()
);

create index if not exists idx_planejamento_pivo_atual
  on planejamento_lancamentos (pivo_id, atual, status);
create index if not exists idx_planejamento_grupo
  on planejamento_lancamentos (grupo_id);
create index if not exists idx_planejamento_data
  on planejamento_lancamentos (data);

alter table planejamento_lancamentos enable row level security;
drop policy if exists planejamento_anon_all on planejamento_lancamentos;
create policy planejamento_anon_all on planejamento_lancamentos for all
  using (true) with check (true);
