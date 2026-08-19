-- ============================================================
-- COI · Ponto 4 — Paradas operacionais (Supabase)
-- Rode isto no Supabase (Dashboard → SQL Editor → New query → Run)
-- Idempotente: pode rodar mais de uma vez sem duplicar nada.
-- Pré-requisito: schema_horimetro.sql já rodado (usa a tabela `pivos`).
-- ============================================================

create extension if not exists pgcrypto;

-- Correção (auditoria 19/08/2026): search_path para coi — mesma causa raiz
-- documentada em 001_horimetro.sql (tabelas nasciam em `public`, código lê
-- `.schema('coi')`). `pivos` já deve existir em `coi` (001 roda antes).
set search_path to coi, public;

create table if not exists paradas_lancamentos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null,
  versao integer not null default 1,
  atual boolean not null default true,
  status text not null default 'ativo',           -- 'ativo' | 'excluido'
  pivo_id uuid not null references pivos(id),
  data date not null,
  hora_inicial text not null,
  hora_final text not null,
  tempo_parado_horas numeric,
  motivo text,                                     -- categoria/motivo (taxonomia de Falhas, texto livre por ora)
  tipo_parada text default 'Não Programada',
  operador text,
  tecnico text,
  observacao text,
  origem text not null default 'app',              -- 'app' | 'importacao_historica'
  criado_em timestamptz not null default now()
);

create index if not exists idx_paradas_pivo_atual
  on paradas_lancamentos (pivo_id, atual, status);
create index if not exists idx_paradas_grupo
  on paradas_lancamentos (grupo_id);
create index if not exists idx_paradas_data
  on paradas_lancamentos (data);

create unique index if not exists uq_paradas_grupo_atual
  on paradas_lancamentos (grupo_id) where atual = true;

-- Idempotência da carga histórica (INTERVALO DE TEMPO-Paradas.xlsx):
-- mesmo pivô+data+hora inicial+hora final nunca duplica.
create unique index if not exists uq_paradas_import_natural
  on paradas_lancamentos (pivo_id, data, hora_inicial, hora_final)
  where origem = 'importacao_historica';

-- ── STAGING para a carga do histórico real (aba "Controle" de
--    INTERVALO DE TEMPO-Paradas.xlsx: DATA INICIAL/PIVÔ/PARADA/RETORNO/
--    TEMPO/MOTIVO/DATA FINAL) — importe o CSV convertido aqui e rode o
--    INSERT abaixo. Ainda não convertido nesta rodada (arquivo maior,
--    ver relatório) — staging já criada para quando estiver pronto. ──
create table if not exists paradas_staging (
  data_inicial text, pivo text, parada text, retorno text,
  tempo text, motivo text, data_final text
);

insert into pivos (numero)
select distinct pivo::integer
from paradas_staging
where pivo ~ '^\d+$'
on conflict (numero) do nothing;

insert into paradas_lancamentos
  (grupo_id, versao, atual, status, pivo_id, data, hora_inicial, hora_final,
   tempo_parado_horas, motivo, origem)
select
  gen_random_uuid(), 1, true, 'ativo',
  p.id,
  s.data_inicial::date,
  s.parada, s.retorno,
  nullif(s.tempo,'')::numeric,
  nullif(s.motivo,''),
  'importacao_historica'
from paradas_staging s
join pivos p on p.numero = s.pivo::integer
where s.pivo ~ '^\d+$'
on conflict do nothing;

-- ── RLS (mesma ressalva do schema_horimetro.sql: app ainda sem
--    autenticação real — apertar para `auth.role() = 'authenticated'`
--    quando o Supabase Auth entrar). ──────────────────────────────────
alter table paradas_lancamentos enable row level security;
drop policy if exists paradas_anon_all on paradas_lancamentos;
create policy paradas_anon_all on paradas_lancamentos for all
  using (true) with check (true);

grant usage on schema coi to anon, authenticated;
grant select, insert, update, delete on all tables in schema coi to anon, authenticated;
alter default privileges in schema coi
  grant select, insert, update, delete on tables to anon, authenticated;
