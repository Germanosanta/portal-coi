-- ============================================================
-- COI · Migração Fertirrigação + Falha/Indicador para o Supabase
-- Rode isto no Supabase (Dashboard → SQL Editor → New query → Run)
-- Idempotente: pode rodar mais de uma vez sem duplicar nada.
--
-- Motivo (auditoria de sincronização, 2026-09-21): os módulos
-- Fertirrigação e Falha/Indicador ainda gravavam só em localStorage
-- (por navegador/dispositivo) — igual ao Horímetro/Paradas antes da
-- Fase 14/15, mas sem terem sido migrados junto. Um lançamento feito
-- num dispositivo não aparecia em nenhum outro. Esta migração cria as
-- tabelas equivalentes a `horimetro_lancamentos`/`paradas_lancamentos`
-- (mesmo padrão grupo_id/versao/atual/status de histórico permanente).
--
-- Produto (Fertirrigação) e Falha (Indicador) continuam vindo do
-- cadastro local (js/cadastro.js) — não têm tabela própria no Supabase
-- ainda (mesmo caso de fazendas/setores/etc.), então são gravados aqui
-- como texto (nome/categoria/motivo), não como FK. Isso evita duplicar
-- também o cadastro de Produtos/Falhas nesta migração — se um dia esses
-- cadastros também migrarem para o Supabase, dá pra acrescentar as FKs
-- depois sem quebrar o histórico já gravado como texto.
-- ============================================================

set search_path to coi, public;
create extension if not exists pgcrypto;

-- ── FERTIRRIGAÇÃO ────────────────────────────────────────────────
create table if not exists ferti_lancamentos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null,
  versao integer not null default 1,
  atual boolean not null default true,
  status text not null default 'ativo',
  pivo_id uuid not null references pivos(id),
  data date not null,
  hora_inicial text not null,
  hora_final text not null,
  tempo_aplicacao_horas numeric,
  produto_nome text,
  produto_categoria text,
  cultura text,
  safra text,
  quantidade_aplicada numeric,
  concentracao numeric,
  volume_agua numeric,
  vazao numeric,
  operador text,
  observacao text,
  origem text not null default 'app',
  criado_em timestamptz not null default now()
);

create index if not exists idx_ferti_pivo_atual on ferti_lancamentos (pivo_id, atual, status);
create index if not exists idx_ferti_grupo on ferti_lancamentos (grupo_id);
create index if not exists idx_ferti_data on ferti_lancamentos (data);
create unique index if not exists uq_ferti_grupo_atual on ferti_lancamentos (grupo_id) where atual = true;

alter table ferti_lancamentos enable row level security;
drop policy if exists ferti_anon_all on ferti_lancamentos;
drop policy if exists ferti_authenticated_all on ferti_lancamentos;
create policy ferti_authenticated_all on ferti_lancamentos
  for all using (auth.role()='authenticated') with check (auth.role()='authenticated');

-- ── FALHA / INDICADOR (ocorrências) ─────────────────────────────
create table if not exists indicador_ocorrencias (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null,
  versao integer not null default 1,
  atual boolean not null default true,
  status text not null default 'ativo',
  pivo_id uuid not null references pivos(id),
  data date not null,
  falha_categoria text,
  falha_motivo text,
  observacao text,
  origem text not null default 'app',
  criado_em timestamptz not null default now()
);

create index if not exists idx_indicador_pivo_atual on indicador_ocorrencias (pivo_id, atual, status);
create index if not exists idx_indicador_grupo on indicador_ocorrencias (grupo_id);
create index if not exists idx_indicador_data on indicador_ocorrencias (data);
create unique index if not exists uq_indicador_grupo_atual on indicador_ocorrencias (grupo_id) where atual = true;

alter table indicador_ocorrencias enable row level security;
drop policy if exists indicador_anon_all on indicador_ocorrencias;
drop policy if exists indicador_authenticated_all on indicador_ocorrencias;
create policy indicador_authenticated_all on indicador_ocorrencias
  for all using (auth.role()='authenticated') with check (auth.role()='authenticated');

grant usage on schema coi to authenticated;
grant select, insert, update, delete on ferti_lancamentos, indicador_ocorrencias to authenticated;

-- TESTAR: logado, abrir Lançamentos → Fertirrigação/Falha e registrar um
-- lançamento de teste em um navegador; abrir em outro navegador/dispositivo
-- (ou aba anônima logada) e confirmar que o mesmo lançamento aparece —
-- essa é a prova de que a dessincronia foi corrigida.
