-- ============================================================
-- COI · Ponto 2 — Integração total do Banco de Horímetros
-- Rode isto no Supabase (Dashboard → SQL Editor → New query → Run)
-- Idempotente: pode rodar mais de uma vez sem duplicar nada.
-- ============================================================

create extension if not exists pgcrypto;

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
