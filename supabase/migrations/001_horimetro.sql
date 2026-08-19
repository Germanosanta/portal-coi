-- ============================================================
-- COI · Ponto 2 — Integração total do Banco de Horímetros
-- Rode isto no Supabase (Dashboard → SQL Editor → New query → Run)
-- Idempotente: pode rodar mais de uma vez sem duplicar nada.
-- ============================================================

create extension if not exists pgcrypto;

-- ── SCHEMA `coi` ───────────────────────────────────────────────────
-- BUG CORRIGIDO (auditoria de 19/08/2026): esta migration criava as
-- tabelas sem qualificar schema, então elas nasciam em `public` — mas
-- TODO o código do app (js/services/horimetro.js e demais) lê/grava em
-- `window.coiDB.schema('coi')`. Resultado real, confirmado via consulta
-- direta à API REST do projeto: as tabelas nunca existiram em `coi`
-- (erro PGRST205 em toda tabela testada). Corrigido criando o schema
-- explicitamente e apontando o search_path desta sessão de SQL para
-- ele — nada muda para quem já tinha rodado a versão antiga apontando
-- para `public`, pois os `create table if not exists` abaixo, agora
-- com o search_path em `coi`, criam do zero lá.
create schema if not exists coi;
set search_path to coi, public;

-- ── PIVÔS (mínimo necessário para o Horímetro funcionar; o cadastro
--    completo de fazenda/casa de bomba/status vem numa etapa própria de
--    Cadastros, não inventado aqui) ────────────────────────────────────
create table if not exists pivos (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique,
  fazenda_id uuid null,
  lamina_base100 numeric null,
  status text not null default 'Ativo',
  criado_em timestamptz not null default now()
);

-- ── HORÍMETRO — histórico permanente (mesmo modelo já usado no
--    localStorage: grupo_id/versao/atual/status; nunca sobrescreve) ───
create table if not exists horimetro_lancamentos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null,
  versao integer not null default 1,
  atual boolean not null default true,
  status text not null default 'ativo',           -- 'ativo' | 'excluido'
  pivo_id uuid not null references pivos(id),
  data date not null,
  hora_inicio text,
  horimetro_inicial numeric not null,
  horimetro_final numeric not null,
  horas numeric,
  percentual numeric,
  lamina numeric,
  pressao numeric,
  horas_ociosas numeric,
  cultura text,
  area_pivo text,
  operador text,
  observacao text,
  safra text,
  origem text not null default 'app',              -- 'app' | 'importacao_historica'
  criado_em timestamptz not null default now()
);

create index if not exists idx_horimetro_pivo_atual
  on horimetro_lancamentos (pivo_id, atual, status);
create index if not exists idx_horimetro_grupo
  on horimetro_lancamentos (grupo_id);

-- Correção de consistência (auditoria 19/08/2026): impede, a nível de
-- banco, que um mesmo grupo_id tenha duas versões marcadas atual=true
-- ao mesmo tempo — antes disso dependia só da ordem de UPDATE/INSERT em
-- horimetroAtualizar() no JS; se o INSERT da nova versão falhasse depois
-- do UPDATE já ter marcado a antiga como atual=false, o código já
-- reverte isso manualmente (ver horimetro.js), mas esta constraint é a
-- garantia definitiva contra qualquer outra via de escrita (SQL Editor,
-- outra rotina) deixar dois "atuais" no mesmo grupo.
create unique index if not exists uq_horimetro_grupo_atual
  on horimetro_lancamentos (grupo_id) where atual = true;

-- Impede duplicar o MESMO registro histórico se a importação for rodada
-- de novo (idempotência exigida) — só vale para a carga original.
create unique index if not exists uq_horimetro_import_natural
  on horimetro_lancamentos (pivo_id, data, horimetro_inicial, horimetro_final)
  where origem = 'importacao_historica';

-- ── STAGING para a carga do arquivo banco-de-dados-horimetro.xlsx
--    (8.122 registros reais, 23/07/2025–08/08/2026) — importe o CSV
--    aqui pelo Table Editor do Supabase ("Insert" → "Import data from CSV"),
--    depois rode o INSERT abaixo para migrar para as tabelas oficiais. ─
create table if not exists horimetro_staging (
  "user" text, "dataHoraRegistro" text, id text, data text, pivo text,
  cultura text, area text, percentual text, lamina text,
  horimetro1 text, horimetro2 text, horas text, observacao text
);

-- 1) Cria os pivôs que aparecem no histórico e ainda não existem
insert into pivos (numero)
select distinct pivo::integer
from horimetro_staging
where pivo ~ '^\d+$'
on conflict (numero) do nothing;

-- 2) Migra o histórico da staging para a tabela oficial (idempotente:
--    ON CONFLICT no índice único acima ignora o que já foi importado)
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
  coalesce(to_timestamp(s."dataHoraRegistro", 'MM/DD/YYYY, HH12:MI AM'), now())
from horimetro_staging s
join pivos p on p.numero = s.pivo::integer
where s.pivo ~ '^\d+$'
on conflict do nothing;

-- ── RLS ────────────────────────────────────────────────────────────
-- O app hoje NÃO tem autenticação real (login.js só pede um nome, sem
-- senha validada) — é o mesmo nível de segurança que o localStorage já
-- tinha (qualquer um com acesso ao navegador lê/edita tudo). Abrir estas
-- duas tabelas para a chave "anon" NÃO é uma regressão de segurança
-- frente ao que existe hoje — mas também não é definitivo: quando o
-- Supabase Auth entrar (v4.0 do ROADMAP.md), troque estas policies por
-- `using (auth.role() = 'authenticated')`.
alter table pivos enable row level security;
alter table horimetro_lancamentos enable row level security;

drop policy if exists pivos_anon_all on pivos;
create policy pivos_anon_all on pivos for all
  using (true) with check (true);

drop policy if exists horimetro_anon_all on horimetro_lancamentos;
create policy horimetro_anon_all on horimetro_lancamentos for all
  using (true) with check (true);

-- ── GRANTS — obrigatório para schema fora de `public`: o PostgREST só
--    enxerga um schema custom se (a) o role usado pela API key tiver
--    USAGE nele e SELECT/INSERT/UPDATE/DELETE nas tabelas, e (b) o
--    schema estiver na lista "Exposed schemas" do projeto (AÇÃO MANUAL,
--    não dá para fazer por SQL: Dashboard → Project Settings → API →
--    "Exposed schemas" → adicionar `coi` e salvar). Sem isso, mesmo com
--    RLS e policy corretas, a API responde 404/PGRST205 igual a uma
--    tabela inexistente.
grant usage on schema coi to anon, authenticated;
grant select, insert, update, delete on all tables in schema coi to anon, authenticated;
alter default privileges in schema coi
  grant select, insert, update, delete on tables to anon, authenticated;
