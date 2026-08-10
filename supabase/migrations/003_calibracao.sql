-- ============================================================
-- COI · Ponto 6 — Calibração de Lâmina (Supabase)
-- Rode isto no Supabase (Dashboard → SQL Editor → New query → Run)
-- Idempotente. Pré-requisito: schema_horimetro.sql já rodado (tabela `pivos`).
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists calibracoes_lancamentos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null,
  versao integer not null default 1,
  atual boolean not null default true,
  status text not null default 'ativo',
  pivo_id uuid not null references pivos(id),
  data date not null,
  hora text,
  lamina_medida numeric not null,
  percentual_utilizado numeric not null,
  lamina_calculada_100 numeric not null,     -- LÂMINA NOVA (a 100%)
  lamina_anterior numeric,                    -- LÂMINA ANTERIOR (snapshot no momento da calibração)
  diferenca_anterior numeric,
  percentual_variacao numeric,
  operador text,
  responsavel_calibracao text,
  metodo_calibracao text default 'Teste de Campo (Coletor)',
  observacoes text,
  origem text not null default 'app',
  criado_em timestamptz not null default now()
);

create index if not exists idx_calibracoes_pivo_atual
  on calibracoes_lancamentos (pivo_id, atual, status);
create index if not exists idx_calibracoes_grupo
  on calibracoes_lancamentos (grupo_id);

alter table calibracoes_lancamentos enable row level security;
drop policy if exists calibracoes_anon_all on calibracoes_lancamentos;
create policy calibracoes_anon_all on calibracoes_lancamentos for all
  using (true) with check (true);
