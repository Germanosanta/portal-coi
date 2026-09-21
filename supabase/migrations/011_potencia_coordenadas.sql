-- ============================================================
-- COI · Adiciona coordenadas geográficas à ficha técnica dos pivôs
-- Rode isto no Supabase (Dashboard → SQL Editor → New query → Run)
-- Idempotente e não destrutivo: só adiciona colunas, não mexe em dado
-- existente. Pré-requisito: 005_energia.sql já rodado.
-- ============================================================

set search_path to coi, public;

-- Fonte: BASE DE DADOS/informações pivôs e reservatorios Elavatórias
-- Captacões e Poços.xlsx — colunas "Latitude"/"Longitude" da mesma
-- planilha que já alimenta vazão/potência nesta tabela.
alter table pivos_potencia_tecnica add column if not exists latitude numeric;
alter table pivos_potencia_tecnica add column if not exists longitude numeric;

-- Staging já existe (005_energia.sql); só adiciona as 2 colunas novas
-- pro Table Editor conseguir importar o CSV com Latitude/Longitude.
alter table pivos_potencia_staging add column if not exists latitude text;
alter table pivos_potencia_staging add column if not exists longitude text;

-- Mesmo merge do 005_energia.sql, agora carregando também latitude/
-- longitude — ON CONFLICT (pivo_id) DO UPDATE cobre tanto quem já
-- tinha ficha técnica (só acrescenta coordenadas) quanto pivô novo.
insert into pivos (numero)
select distinct pivo_numero::integer
from pivos_potencia_staging
where pivo_numero ~ '^\d+$'
on conflict (numero) do nothing;

insert into pivos_potencia_tecnica
  (pivo_id, fazenda, modulo, casa_bomba, marca, area_ha, vazao_m3h,
   potencia_cv, potencia_kw, fonte, latitude, longitude)
select
  p.id, s.fazenda, s.modulo, s.casa_bomba, s.marca,
  nullif(s.area_ha,'')::numeric, nullif(s.vazao_m3h,'')::numeric,
  nullif(s.potencia_cv,'')::numeric, nullif(s.potencia_kw,'')::numeric,
  s.fonte,
  nullif(s.latitude,'')::numeric, nullif(s.longitude,'')::numeric
from pivos_potencia_staging s
join pivos p on p.numero = s.pivo_numero::integer
where s.pivo_numero ~ '^\d+$'
on conflict (pivo_id) do update set
  fazenda=excluded.fazenda, modulo=excluded.modulo, casa_bomba=excluded.casa_bomba,
  marca=excluded.marca, area_ha=excluded.area_ha, vazao_m3h=excluded.vazao_m3h,
  potencia_cv=excluded.potencia_cv, potencia_kw=excluded.potencia_kw, fonte=excluded.fonte,
  latitude=excluded.latitude, longitude=excluded.longitude;
