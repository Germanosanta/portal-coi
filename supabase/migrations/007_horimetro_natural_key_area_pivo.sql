-- ============================================================
-- COI · Correção — chave natural de importação do Horímetro precisa
-- considerar area_pivo (quadrante), senão perde registros de verdade
-- Rode isto no Supabase (Dashboard → SQL Editor → New query → Run)
-- Idempotente e NÃO destrutivo: só troca um índice, não mexe em dado.
-- ============================================================

-- Contexto (auditoria 20/08/2026, geração do histórico Karitel/RDM):
-- o índice uq_horimetro_import_natural (001_horimetro.sql) é
-- (pivo_id, data, horimetro_inicial, horimetro_final) — não inclui
-- area_pivo. Ao gerar o CSV histórico de Karitel/RDM (quadrantes A/B/
-- C/D, ex.: pivô 1 operando "A" num lançamento e "A+B" noutro no MESMO
-- dia com a MESMA leitura de horímetro, coisa real da fonte), achamos
-- 54 grupos onde dois lançamentos DIFERENTES (quadrantes diferentes)
-- compartilham pivô+data+horímetro inicial+final. Com o índice atual,
-- o segundo desses 54 seria descartado pelo ON CONFLICT DO NOTHING —
-- perda silenciosa de dado real, exatamente o que não pode acontecer.
-- Corrigido incluindo area_pivo na chave. Não afeta a carga já feita
-- via banco-de-dados-horimetro.xlsx (lá area_pivo é sempre 'COMPLETO',
-- e ela não tinha nenhuma duplicata pivo+data+h1+h2 pra começo de
-- conversa — confirmado por teste).

set search_path to coi, public;

drop index if exists uq_horimetro_import_natural;

create unique index if not exists uq_horimetro_import_natural
  on horimetro_lancamentos (pivo_id, data, horimetro_inicial, horimetro_final, area_pivo)
  where origem = 'importacao_historica';
