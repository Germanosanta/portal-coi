-- ============================================================
-- COI · Módulo Consumo de Energia (Supabase)
-- Rode isto no Supabase (Dashboard → SQL Editor → New query → Run)
-- Idempotente. Pré-requisito: schema_horimetro.sql já rodado (tabela `pivos`).
-- ============================================================

create extension if not exists pgcrypto;

-- Correção (auditoria 19/08/2026): search_path para coi — ver 001_horimetro.sql.
set search_path to coi, public;

-- ── Ficha técnica do conjunto motor-bomba por pivô ─────────────────
-- Fonte: BASE DE DADOS/informações pivôs e reservatorios Elavatórias
-- Captacões e Poços.xlsx, aba "Infor_Pivos". Um pivô = uma potência
-- resolvida na planilha de origem (quando existente); NÃO inventa
-- potência para pivô sem dado (fica null, `fonte='DADO_NAO_DISPONIVEL'`).
create table if not exists pivos_potencia_tecnica (
  id uuid primary key default gen_random_uuid(),
  pivo_id uuid not null unique references pivos(id),
  fazenda text,
  modulo text,
  casa_bomba text,           -- código do reservatório/estrutura que abastece (ex.: "R0", "RM4") — rastreabilidade, não usado no cálculo
  marca text,                -- marca do pivô (Valley/Lindsay/Bauer) — informativo
  area_ha numeric,
  vazao_m3h numeric,
  potencia_cv numeric,       -- valor original da planilha (CV = cavalo-vapor)
  fator_conversao numeric not null default 0.7457,  -- CV→kW: o MESMO fator já embutido nas fórmulas da planilha de origem (conferido: potencia_kw / potencia_cv = 0.7457 em toda a amostra) — não é uma equivalência universal fixa (o CV metrico "oficial" é 0.7355 kW; a planilha usa 0.7457, que é o fator do HP imperial — reproduzido fielmente, não corrigido, e documentado aqui)
  potencia_kw numeric,       -- potencia_cv * fator_conversao, já calculado na origem
  fonte text not null default 'planilha_tecnica',   -- 'planilha_tecnica' | 'DADO_NAO_DISPONIVEL' | 'manual'
  criado_em timestamptz not null default now()
);

create index if not exists idx_potencia_pivo on pivos_potencia_tecnica (pivo_id);

-- Staging para a importação da planilha (108 linhas: 106 com potência, 2
-- sem — pivôs 75 e 76 da Karitel, "DADO_NAO_DISPONIVEL")
create table if not exists pivos_potencia_staging (
  fazenda text, modulo text, casa_bomba text, marca text, pivo_numero text,
  area_ha text, vazao_m3h text, potencia_cv text, potencia_kw text, fonte text
);

insert into pivos (numero)
select distinct pivo_numero::integer
from pivos_potencia_staging
where pivo_numero ~ '^\d+$'
on conflict (numero) do nothing;

insert into pivos_potencia_tecnica
  (pivo_id, fazenda, modulo, casa_bomba, marca, area_ha, vazao_m3h, potencia_cv, potencia_kw, fonte)
select
  p.id, s.fazenda, s.modulo, s.casa_bomba, s.marca,
  nullif(s.area_ha,'')::numeric, nullif(s.vazao_m3h,'')::numeric,
  nullif(s.potencia_cv,'')::numeric, nullif(s.potencia_kw,'')::numeric,
  s.fonte
from pivos_potencia_staging s
join pivos p on p.numero = s.pivo_numero::integer
where s.pivo_numero ~ '^\d+$'
on conflict (pivo_id) do update set
  fazenda=excluded.fazenda, modulo=excluded.modulo, casa_bomba=excluded.casa_bomba,
  marca=excluded.marca, area_ha=excluded.area_ha, vazao_m3h=excluded.vazao_m3h,
  potencia_cv=excluded.potencia_cv, potencia_kw=excluded.potencia_kw, fonte=excluded.fonte;

-- ── Memória de cálculo do consumo estimado, 1 linha por lançamento de
--    Horímetro (irrigação executada) — nunca recalcula silenciosamente
--    um histórico antigo: se a potência do pivô mudar, os cálculos JÁ
--    GRAVADOS aqui preservam o valor usado na época; só novos
--    lançamentos usam o novo valor. ──────────────────────────────────
create table if not exists consumo_energia_calculo (
  id uuid primary key default gen_random_uuid(),
  horimetro_grupo_id uuid not null,     -- referência lógica ao lançamento de horimetro_lancamentos.grupo_id
  pivo_id uuid not null references pivos(id),
  data date not null,
  horas numeric not null,
  potencia_cv numeric,
  fator_conversao numeric,
  potencia_kw numeric,
  rendimento numeric,                    -- null = não disponível, não inventado
  energia_kwh numeric,                   -- null quando potencia_kw for null (DADO NÃO DISPONÍVEL)
  origem_potencia text,                  -- 'planilha_tecnica' | 'DADO_NAO_DISPONIVEL' | 'manual'
  criado_em timestamptz not null default now()
);

create index if not exists idx_consumo_pivo on consumo_energia_calculo (pivo_id, data);
create unique index if not exists uq_consumo_horimetro on consumo_energia_calculo (horimetro_grupo_id);

alter table pivos_potencia_tecnica enable row level security;
alter table consumo_energia_calculo enable row level security;
drop policy if exists potencia_anon_all on pivos_potencia_tecnica;
create policy potencia_anon_all on pivos_potencia_tecnica for all using (true) with check (true);
drop policy if exists consumo_anon_all on consumo_energia_calculo;
create policy consumo_anon_all on consumo_energia_calculo for all using (true) with check (true);

grant usage on schema coi to anon, authenticated;
grant select, insert, update, delete on all tables in schema coi to anon, authenticated;
alter default privileges in schema coi
  grant select, insert, update, delete on tables to anon, authenticated;
