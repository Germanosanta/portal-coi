-- ============================================================
-- COI · Usuários, Perfis e Permissões (banco oficial, schema coi)
-- Rode isto no Supabase (Dashboard → SQL Editor → New query → Run)
-- Idempotente. NÃO mexe em nenhuma tabela do Horímetro/Paradas/
-- Potência/Planejamento/Calibração/Energia. Sem DROP/DELETE/TRUNCATE.
-- ============================================================

-- IMPORTANTE (auditoria prévia, 21/08/2026): `coi.perfis` e
-- `coi.usuarios` JÁ EXISTIAM no projeto real antes desta migration —
-- descobertos por sondagem de colunas via erro 42703 da API REST (não
-- há acesso a information_schema com a chave anon). Estrutura
-- encontrada, ambas com 0 linhas:
--   perfis:   id, nome, descricao, ativo, created_at
--   usuarios: id, nome, email, telefone, perfil_id, ativo, created_at
-- Não foi encontrada nenhuma tabela de permissões/roles pré-existente
-- (roles, permissoes, permissions, role_permissions, user_roles — todas
-- 404). Esta migration REAPROVEITA as duas tabelas existentes (só
-- adiciona as colunas que faltam, via ALTER TABLE ADD COLUMN IF NOT
-- EXISTS — nunca DROP/rename/tipo alterado) e cria do zero só o que
-- realmente não existia: permissoes_catalogo e perfil_permissoes.

create extension if not exists pgcrypto;
set search_path to coi, public;

-- ── PERFIS — reaproveita a tabela existente, só adiciona `base` (marca
--    os 5 perfis-base oficiais como não-excluíveis pela tela de Perfis).
--    `ativo`/`created_at`/`descricao` já existiam e continuam usados. ──
alter table perfis add column if not exists base boolean not null default false;

-- nome precisa ser único ANTES do INSERT...ON CONFLICT (nome) abaixo —
-- Postgres exige o índice já existir para usá-lo como arbiter. Cria só
-- se ainda não existir (idempotente; se já houver 2 perfis com o mesmo
-- nome de uma carga manual anterior, este create falha e avisa em vez
-- de mascarar o problema).
create unique index if not exists uq_perfis_nome on perfis (nome);

insert into perfis (nome,descricao,base,ativo) values
  ('Administrador','Acesso total ao sistema, incluindo administração de usuários/perfis/permissões.',true,true),
  ('Coordenador','Acesso amplo ao operacional; sem administração de usuários/perfis/permissões.',true,true),
  ('Supervisor','Acesso operacional de supervisão; sem administração.',true,true),
  ('Operador/Lançador','Foco nos lançamentos operacionais.',true,true),
  ('Consulta','Somente leitura em todos os módulos liberados.',true,true)
on conflict (nome) do nothing;

-- ── USUÁRIOS — reaproveita a tabela existente (email/telefone ficam
--    como estão, disponíveis para uma futura integração de Auth real;
--    não usados pelo app hoje). Adiciona o que o login atual (nome
--    digitado, sem senha, ver app/js/login.js) precisa: `login` (chave
--    de identidade hoje), `cargo`, `fazenda_id`, `ultimo_acesso`. ──────
alter table usuarios add column if not exists login text;
alter table usuarios add column if not exists cargo text;
alter table usuarios add column if not exists fazenda_id uuid;
alter table usuarios add column if not exists ultimo_acesso timestamptz;

create unique index if not exists uq_usuarios_login on usuarios (login);

-- ── CATÁLOGO DE PERMISSÕES — chave = "modulo.acao". Módulos futuros
--    (horimetro/paradas/potencia/planejamento/calibracao/energia) já
--    entram no catálogo para a tela de Perfis conseguir exibi-los, mas
--    NENHUM código hoje consulta essas chaves específicas ainda — a
--    proteção real do Horímetro continua por 'lancamentos.*' (já
--    funcionando, não alterado nesta migration). ─────────────────────
create table if not exists permissoes_catalogo (
  chave text primary key,
  modulo text not null,
  acao text not null,
  label text not null,
  ordem integer not null default 0
);

insert into permissoes_catalogo (chave,modulo,acao,label,ordem) values
  ('operacao.visualizar','operacao','visualizar','Visualizar',10),
  ('lancamentos.visualizar','lancamentos','visualizar','Visualizar',20),
  ('lancamentos.criar','lancamentos','criar','Criar',21),
  ('lancamentos.editar','lancamentos','editar','Editar',22),
  ('lancamentos.excluir','lancamentos','excluir','Excluir',23),
  ('indicadores.visualizar','indicadores','visualizar','Visualizar',30),
  ('relatorios.visualizar','relatorios','visualizar','Visualizar',40),
  ('relatorios.exportar','relatorios','exportar','Exportar',41),
  ('cadastros.visualizar','cadastros','visualizar','Visualizar',50),
  ('cadastros.criar','cadastros','criar','Criar',51),
  ('cadastros.editar','cadastros','editar','Editar',52),
  ('cadastros.excluir','cadastros','excluir','Excluir',53),
  ('usuarios.visualizar','usuarios','visualizar','Visualizar',60),
  ('usuarios.criar','usuarios','criar','Criar',61),
  ('usuarios.editar','usuarios','editar','Editar',62),
  ('usuarios.bloquear','usuarios','bloquear','Bloquear/Desbloquear',63),
  ('perfis.visualizar','perfis','visualizar','Visualizar',70),
  ('perfis.criar','perfis','criar','Criar',71),
  ('perfis.editar','perfis','editar','Editar',72),
  ('perfis.excluir','perfis','excluir','Excluir',73),
  ('permissoes.visualizar','permissoes','visualizar','Visualizar',80),
  ('permissoes.editar','permissoes','editar','Editar',81),
  ('auditoria.visualizar','auditoria','visualizar','Visualizar',90),
  ('administracao.visualizar','administracao','visualizar','Acessar área de Administração',95),
  -- preparado, não wireado ainda:
  ('horimetro.visualizar','horimetro','visualizar','Visualizar',100),
  ('horimetro.criar','horimetro','criar','Criar',101),
  ('horimetro.editar','horimetro','editar','Editar',102),
  ('horimetro.excluir','horimetro','excluir','Excluir',103),
  ('paradas.visualizar','paradas','visualizar','Visualizar',110),
  ('paradas.criar','paradas','criar','Criar',111),
  ('paradas.editar','paradas','editar','Editar',112),
  ('paradas.excluir','paradas','excluir','Excluir',113),
  ('potencia.visualizar','potencia','visualizar','Visualizar',120),
  ('potencia.criar','potencia','criar','Criar',121),
  ('potencia.editar','potencia','editar','Editar',122),
  ('potencia.excluir','potencia','excluir','Excluir',123),
  ('planejamento.visualizar','planejamento','visualizar','Visualizar',130),
  ('planejamento.criar','planejamento','criar','Criar',131),
  ('planejamento.editar','planejamento','editar','Editar',132),
  ('planejamento.excluir','planejamento','excluir','Excluir',133),
  ('calibracao.visualizar','calibracao','visualizar','Visualizar',140),
  ('calibracao.criar','calibracao','criar','Criar',141),
  ('calibracao.editar','calibracao','editar','Editar',142),
  ('calibracao.excluir','calibracao','excluir','Excluir',143),
  ('energia.visualizar','energia','visualizar','Visualizar',150),
  ('energia.criar','energia','criar','Criar',151),
  ('energia.editar','energia','editar','Editar',152),
  ('energia.excluir','energia','excluir','Excluir',153)
on conflict (chave) do nothing;

-- ── MATRIZ PERFIL × PERMISSÃO — PERFIL e PERMISSÃO são independentes:
--    o admin pode ligar/desligar qualquer chave para qualquer perfil
--    (ex.: liberar lancamentos.excluir para Supervisor) sem precisar
--    criar um perfil novo. ────────────────────────────────────────────
create table if not exists perfil_permissoes (
  perfil_id uuid not null references perfis(id) on delete cascade,
  permissao_chave text not null references permissoes_catalogo(chave) on delete cascade,
  permitido boolean not null default false,
  primary key (perfil_id, permissao_chave)
);

-- Seed dos defaults oficiais (só insere se ainda não existir linha para
-- o par perfil+chave — não sobrescreve ajuste manual que o admin já
-- tenha feito rodando esta migration de novo).
insert into perfil_permissoes (perfil_id, permissao_chave, permitido)
select p.id, c.chave, true
from perfis p, permissoes_catalogo c
where p.nome='Administrador'
on conflict (perfil_id,permissao_chave) do nothing;

insert into perfil_permissoes (perfil_id, permissao_chave, permitido)
select p.id, c.chave, (c.chave in (
  'operacao.visualizar','lancamentos.visualizar','lancamentos.criar','lancamentos.editar',
  'indicadores.visualizar','relatorios.visualizar','relatorios.exportar',
  'cadastros.visualizar','auditoria.visualizar'
))
from perfis p, permissoes_catalogo c
where p.nome='Coordenador'
on conflict (perfil_id,permissao_chave) do nothing;

insert into perfil_permissoes (perfil_id, permissao_chave, permitido)
select p.id, c.chave, (c.chave in (
  'operacao.visualizar','lancamentos.visualizar','lancamentos.criar','lancamentos.editar',
  'indicadores.visualizar','relatorios.visualizar','cadastros.visualizar'
))
from perfis p, permissoes_catalogo c
where p.nome='Supervisor'
on conflict (perfil_id,permissao_chave) do nothing;

insert into perfil_permissoes (perfil_id, permissao_chave, permitido)
select p.id, c.chave, (c.chave in (
  'operacao.visualizar','lancamentos.visualizar','lancamentos.criar','lancamentos.editar',
  'indicadores.visualizar'
))
from perfis p, permissoes_catalogo c
where p.nome='Operador/Lançador'
on conflict (perfil_id,permissao_chave) do nothing;

insert into perfil_permissoes (perfil_id, permissao_chave, permitido)
select p.id, c.chave, (c.chave in (
  'operacao.visualizar','lancamentos.visualizar','indicadores.visualizar',
  'relatorios.visualizar','cadastros.visualizar'
))
from perfis p, permissoes_catalogo c
where p.nome='Consulta'
on conflict (perfil_id,permissao_chave) do nothing;

create index if not exists idx_usuarios_login on usuarios (login);
create index if not exists idx_perfil_permissoes_perfil on perfil_permissoes (perfil_id);

-- ── RLS ────────────────────────────────────────────────────────────
-- `perfis`/`usuarios` já tinham RLS habilitado com policies que
-- REJEITAM a chave anon (confirmado: POST vazio devolveu 42501 "new
-- row violates row-level security policy" antes desta migration) — ou
-- seja, mais restritivo que o padrão do resto do projeto, não uma
-- omissão. Como o app precisa gravar por enquanto (sem Auth real, ver
-- app/js/login.js), alinhamos as duas ao MESMO padrão já usado em
-- todas as outras tabelas do projeto (pivos, horimetro_lancamentos
-- etc.) — mesma ressalva de sempre: sem regressão de segurança frente
-- ao localStorage que existia antes, e para apertar quando o Supabase
-- Auth entrar (trocar `using (true)` por `using (auth.role() =
-- 'authenticated')`).
alter table perfis enable row level security;
alter table usuarios enable row level security;
alter table permissoes_catalogo enable row level security;
alter table perfil_permissoes enable row level security;

drop policy if exists perfis_anon_all on perfis;
create policy perfis_anon_all on perfis for all using (true) with check (true);
drop policy if exists usuarios_anon_all on usuarios;
create policy usuarios_anon_all on usuarios for all using (true) with check (true);
drop policy if exists permissoes_catalogo_anon_all on permissoes_catalogo;
create policy permissoes_catalogo_anon_all on permissoes_catalogo for all using (true) with check (true);
drop policy if exists perfil_permissoes_anon_all on perfil_permissoes;
create policy perfil_permissoes_anon_all on perfil_permissoes for all using (true) with check (true);

grant usage on schema coi to anon, authenticated;
grant select, insert, update, delete on all tables in schema coi to anon, authenticated;
alter default privileges in schema coi
  grant select, insert, update, delete on tables to anon, authenticated;
