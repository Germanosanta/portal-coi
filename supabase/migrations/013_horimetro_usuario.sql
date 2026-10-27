-- ============================================================
-- COI · Horímetro — rastreia QUEM lançou (usuário da sessão)
-- Rode isto no Supabase (Dashboard → SQL Editor → New query → Run)
-- Idempotente: pode rodar mais de uma vez sem duplicar nada.
--
-- Motivo: o campo "Operador" é texto livre (digitado à mão, pode ficar
-- em branco ou divergir do nome real de quem estava logado). O pedido
-- foi para a exportação do Histórico de Horímetro trazer o ID de quem
-- de fato lançou cada registro — isso só existe pegando o usuário da
-- sessão Supabase Auth no momento da gravação, não o campo Operador.
-- Lançamentos antigos (antes desta migration) ficam com usuario_id/
-- usuario_nome nulos — não tem como reconstruir isso retroativamente.
-- ============================================================

set search_path to coi, public;

alter table horimetro_lancamentos
  add column if not exists usuario_id uuid references auth.users(id),
  add column if not exists usuario_nome text;

create index if not exists idx_horimetro_usuario on horimetro_lancamentos (usuario_id);
