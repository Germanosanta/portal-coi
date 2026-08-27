-- Fase 21 (Prompt 7) — RLS: fecha acesso anônimo em todo o schema coi.
--
-- NÃO EXECUTADO POR MIM. Este ambiente não tem SQL Editor/CLI de banco/
-- service_role — só chamadas REST via chave anon/JWT de sessão. Rode
-- este arquivo manualmente em: painel do Supabase → projeto
-- hzduodmytbkqjbbyizkb → SQL Editor → colar e Run.
--
-- Rode em blocos (cada "-- BLOCO N" é independente) e teste entre um e
-- outro, conforme o relatório da tarefa. Se algo quebrar, o comando de
-- reversão está comentado logo abaixo de cada bloco.
--
-- Contexto: hoje TODAS as tabelas coi.* têm policy `_anon_all` com
-- `using(true) with check(true)` + grant explícito a `anon` — ou seja,
-- a própria chave pública embutida no frontend consegue ler/gravar
-- tudo, com ou sem login. Isso é aceitável enquanto não havia Auth real;
-- agora que signInWithPassword() funciona, não deve mais ficar assim.

-- ── Helper: identifica se o usuário da sessão é Administrador ativo.
-- Usado só nas 4 tabelas de controle (perfis/permissões), pra escrita.
-- SELECT nessas tabelas continua liberado a qualquer autenticado (é o
-- que o app já precisa pra resolver o próprio perfil/permissões no
-- login de QUALQUER usuário, não só do admin).
create or replace function coi.is_admin() returns boolean
language sql stable security definer as $$
  select exists(
    select 1 from coi.usuarios u
    join coi.perfis p on p.id = u.perfil_id
    where u.id = auth.uid() and p.nome = 'Administrador' and p.ativo = true and u.ativo = true
  );
$$;

-- BLOCO 1 — tabelas de controle (usuarios/perfis/permissoes_catalogo/
-- perfil_permissoes). Leitura para qualquer autenticado (necessário pro
-- próprio app resolver perfil/permissões no boot); escrita só admin.
drop policy if exists usuarios_anon_all on coi.usuarios;
create policy usuarios_select_authenticated on coi.usuarios
  for select using (auth.role()='authenticated');
create policy usuarios_write_admin on coi.usuarios
  for insert with check (coi.is_admin());
create policy usuarios_update_admin on coi.usuarios
  for update using (coi.is_admin()) with check (coi.is_admin());
create policy usuarios_delete_admin on coi.usuarios
  for delete using (coi.is_admin());
-- reverter: drop policy usuarios_select_authenticated, usuarios_write_admin,
--   usuarios_update_admin, usuarios_delete_admin on coi.usuarios;
--   create policy usuarios_anon_all on coi.usuarios for all using(true) with check(true);

drop policy if exists perfis_anon_all on coi.perfis;
create policy perfis_select_authenticated on coi.perfis
  for select using (auth.role()='authenticated');
create policy perfis_write_admin on coi.perfis
  for insert with check (coi.is_admin());
create policy perfis_update_admin on coi.perfis
  for update using (coi.is_admin()) with check (coi.is_admin());
create policy perfis_delete_admin on coi.perfis
  for delete using (coi.is_admin());

drop policy if exists permissoes_catalogo_anon_all on coi.permissoes_catalogo;
create policy permissoes_catalogo_select_authenticated on coi.permissoes_catalogo
  for select using (auth.role()='authenticated');
create policy permissoes_catalogo_write_admin on coi.permissoes_catalogo
  for insert with check (coi.is_admin());
create policy permissoes_catalogo_update_admin on coi.permissoes_catalogo
  for update using (coi.is_admin()) with check (coi.is_admin());
create policy permissoes_catalogo_delete_admin on coi.permissoes_catalogo
  for delete using (coi.is_admin());

drop policy if exists perfil_permissoes_anon_all on coi.perfil_permissoes;
create policy perfil_permissoes_select_authenticated on coi.perfil_permissoes
  for select using (auth.role()='authenticated');
create policy perfil_permissoes_write_admin on coi.perfil_permissoes
  for insert with check (coi.is_admin());
create policy perfil_permissoes_update_admin on coi.perfil_permissoes
  for update using (coi.is_admin()) with check (coi.is_admin());
create policy perfil_permissoes_delete_admin on coi.perfil_permissoes
  for delete using (coi.is_admin());

-- TESTAR: logar como Carlos Santos, abrir Administração → Perfis/
-- Permissões deve continuar carregando e editável. Deslogado, GET
-- /rest/v1/usuarios com só a chave anon deve voltar 401/vazio (nunca
-- os dados reais).

-- BLOCO 2 — Horímetro + Pivôs (dependência direta do único módulo
-- liberado). Fica "for all authenticated": o app só faz SELECT/INSERT/
-- UPDATE (exclusão é lógica, via UPDATE status='excluido') — nunca um
-- DELETE real, então não há necessidade de política de DELETE separada
-- aqui; manter "for all" é suficiente e não abre nada que o app use.
drop policy if exists horimetro_anon_all on coi.horimetro_lancamentos;
create policy horimetro_authenticated_all on coi.horimetro_lancamentos
  for all using (auth.role()='authenticated') with check (auth.role()='authenticated');
-- reverter: create policy horimetro_anon_all on coi.horimetro_lancamentos for all using(true) with check(true);

drop policy if exists pivos_anon_all on coi.pivos;
create policy pivos_authenticated_all on coi.pivos
  for all using (auth.role()='authenticated') with check (auth.role()='authenticated');

-- TESTAR: logado, abrir Horímetro → Histórico deve mostrar os 42.616;
-- lançar um registro novo de teste (e depois excluir logicamente esse
-- MESMO registro de teste, nunca um histórico real); deslogado, GET
-- /rest/v1/horimetro_lancamentos e /rest/v1/pivos com só a chave anon
-- devem voltar vazio/erro.

-- BLOCO 3 — demais tabelas (módulos hoje bloqueados na UI, mas cuja
-- LEITURA o Dashboard/Home usa para os KPIs agregados: paradaAtivas(),
-- calibracaoAtivas(), planejamentoConsultar(), fertiAtivos() são todos
-- chamados por app/js/dashboard.js na tela Home, que continua liberada).
-- Por isso aqui também é "authenticated", não "admin-only": travar mais
-- que isso quebraria a Home hoje. Nenhuma tela hoje ainda grava nessas
-- tabelas (as únicas telas de escrita ficam nas páginas bloqueadas
-- 'opdash'/'lanc'-outras-abas/'dados', inacessíveis pelo guard de nav.js),
-- então isso já fecha o anon sem quebrar nada existente.
drop policy if exists paradas_anon_all on coi.paradas_lancamentos;
create policy paradas_authenticated_all on coi.paradas_lancamentos
  for all using (auth.role()='authenticated') with check (auth.role()='authenticated');

drop policy if exists calibracoes_anon_all on coi.calibracoes_lancamentos;
create policy calibracoes_authenticated_all on coi.calibracoes_lancamentos
  for all using (auth.role()='authenticated') with check (auth.role()='authenticated');

drop policy if exists planejamento_anon_all on coi.planejamento_lancamentos;
create policy planejamento_authenticated_all on coi.planejamento_lancamentos
  for all using (auth.role()='authenticated') with check (auth.role()='authenticated');

drop policy if exists potencia_anon_all on coi.pivos_potencia_tecnica;
create policy potencia_authenticated_all on coi.pivos_potencia_tecnica
  for all using (auth.role()='authenticated') with check (auth.role()='authenticated');

drop policy if exists consumo_anon_all on coi.consumo_energia_calculo;
create policy consumo_authenticated_all on coi.consumo_energia_calculo
  for all using (auth.role()='authenticated') with check (auth.role()='authenticated');

-- TESTAR: logado, abrir Home/Dashboard → KPIs de Paradas/Calibração/
-- Planejamento/Energia devem continuar aparecendo normalmente (mesmos
-- números de antes). Deslogado, GET /rest/v1/paradas_lancamentos (e as
-- outras 4) com só a chave anon devem voltar vazio/erro.

-- BLOCO 4 (opcional, fazer por último) — revogar o GRANT direto a
-- `anon` que hoje existe em paralelo às policies (grant explícito feito
-- nas migrations 001/003/004/005/009). Sem isso, mesmo com as policies
-- acima, o anon ainda TEM permissão de tabela (só não passa pela
-- policy) — redundante, mas mais correto revogar de vez:
revoke select, insert, update, delete on all tables in schema coi from anon;
-- reverter: grant select, insert, update, delete on all tables in schema coi to anon;
