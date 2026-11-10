-- Testes de segurança da base de acesso.
-- Cada bloco entra como uma pessoa diferente e confere o que ela consegue ver ou fazer.
\set QUIET on
create schema teste;
grant usage on schema teste to anon, authenticated;
create function teste.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if c is not true then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok   %', msg;
end $$;
create function teste.erro(cmd text, msg text) returns void language plpgsql as $$
begin
  begin execute cmd;
  exception when others then raise notice 'ok   % (bloqueado: %)', msg, sqlerrm; return; end;
  raise exception 'FALHOU (deveria ter sido bloqueado): %', msg;
end $$;
create function teste.linhas(cmd text) returns bigint language plpgsql as $$
declare n bigint; begin execute cmd; get diagnostics n = row_count; return n; end $$;
grant execute on all functions in schema teste to anon, authenticated;

-- pessoas
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000d0d0', 'dono@detailhub.com.br'),
  ('00000000-0000-0000-0000-0000000000a1', 'admin@wingard.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'financeiro@wingard.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'vendedor@wingard.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'assistente@wingard.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'admin@outra.test'),
  ('00000000-0000-0000-0000-0000000000ff', 'curioso@qualquer.test');
insert into public.plataforma_admins (user_id) values ('00000000-0000-0000-0000-00000000d0d0');
\set dono      '00000000-0000-0000-0000-00000000d0d0'
\set adm_a     '00000000-0000-0000-0000-0000000000a1'
\set fin_a     '00000000-0000-0000-0000-0000000000a2'
\set vend_a    '00000000-0000-0000-0000-0000000000a3'
\set assist_a  '00000000-0000-0000-0000-0000000000a4'
\set adm_b     '00000000-0000-0000-0000-0000000000b1'
\set curioso   '00000000-0000-0000-0000-0000000000ff'

select teste.ok((select count(*) from public.perfis) = 7, 'perfil criado sozinho para cada cadastro');

-- ============ dono da plataforma cria as empresas
select set_config('request.jwt.claim.sub', :'dono', false); set role authenticated;
select public.criar_empresa('Wingard Proteção Automotiva', 'wingard') as emp_a \gset
select public.criar_empresa('Outra Estética', 'outra') as emp_b \gset
select id as cargo_adm_a from public.cargos where empresa_id = :'emp_a' and nivel = 'admin_empresa' \gset
select id as cargo_adm_b from public.cargos where empresa_id = :'emp_b' and nivel = 'admin_empresa' \gset
select public.criar_convite(:'emp_a', 'Admin@Wingard.test ', :'cargo_adm_a') as conv_adm_a \gset
select public.criar_convite(:'emp_b', 'admin@outra.test', :'cargo_adm_b') as conv_adm_b \gset
select teste.ok((select count(*) from public.convites where token_hash = :'conv_adm_a') = 0, 'o código do convite não fica salvo no banco, só o hash');

-- ============ administradores aceitam os convites
reset role; select set_config('request.jwt.claim.sub', :'adm_a', false); set role authenticated;
select teste.ok(public.aceitar_convite(:'conv_adm_a') = :'emp_a'::uuid, 'administrador da Wingard aceitou o convite');
select teste.erro(format('select public.aceitar_convite(%L)', :'conv_adm_a'), 'convite não pode ser usado duas vezes');
select teste.erro(format('select public.aceitar_convite(%L)', :'conv_adm_b'), 'convite enviado para outro e-mail não funciona');
select teste.erro(format('select public.aceitar_convite(%L)', 'codigo-inventado'), 'convite inventado não funciona');
reset role; select set_config('request.jwt.claim.sub', :'adm_b', false); set role authenticated;
select public.aceitar_convite(:'conv_adm_b');

-- ============ administrador da Wingard monta a equipe
reset role; select set_config('request.jwt.claim.sub', :'adm_a', false); set role authenticated;
insert into public.cargos (empresa_id, nome, nivel, pai_id) values (:'emp_a', 'Gerente financeiro', 'admin_area', :'cargo_adm_a') returning id as cargo_fin \gset
insert into public.cargos (empresa_id, nome, nivel, pai_id) values (:'emp_a', 'Vendedor', 'equipe', :'cargo_adm_a') returning id as cargo_vend \gset
insert into public.cargo_permissoes (cargo_id, empresa_id, modulo, acao)
  select :'cargo_fin', :'emp_a', m, a from (values ('financeiro','ver'),('financeiro','editar'),('financeiro','excluir'),('financeiro','aprovar'),('financeiro','exportar'),
                                                    ('comercial','ver'),('operacional','ver'),('equipe','ver'),('equipe','editar')) v(m, a);
insert into public.cargo_permissoes (cargo_id, empresa_id, modulo, acao) values (:'cargo_vend', :'emp_a', 'comercial', 'ver'), (:'cargo_vend', :'emp_a', 'comercial', 'editar');
select public.criar_convite(:'emp_a', 'financeiro@wingard.test', :'cargo_fin') as conv_fin \gset
select public.criar_convite(:'emp_a', 'vendedor@wingard.test', :'cargo_vend', 'proprios') as conv_vend \gset
select teste.erro(format('select public.criar_convite(%L, %L, %L)', :'emp_a', 'outro@x.test', :'cargo_adm_a'), 'administrador da empresa não convida outro administrador (só o dono da plataforma)');
select teste.ok(teste.linhas(format('delete from public.cargo_permissoes where cargo_id = %L', :'cargo_adm_a')) = 0, 'administrador da empresa não altera as próprias permissões de administrador');
select teste.erro(format('update public.cargos set nivel = %L where id = %L', 'admin_area', :'cargo_vend'), 'ninguém muda o nível de um cargo, só o dono da plataforma');

reset role; select set_config('request.jwt.claim.sub', :'fin_a', false); set role authenticated;
select public.aceitar_convite(:'conv_fin');
reset role; select set_config('request.jwt.claim.sub', :'vend_a', false); set role authenticated;
select public.aceitar_convite(:'conv_vend');

-- ============ isolamento entre empresas
reset role; select set_config('request.jwt.claim.sub', :'adm_b', false); set role authenticated;
select teste.ok((select count(*) from public.empresas) = 1, 'administrador da Outra Estética só enxerga a própria empresa');
select teste.ok((select count(*) from public.empresas where id = :'emp_a') = 0, 'Outra Estética não vê a Wingard');
select teste.ok((select count(*) from public.cargos where empresa_id = :'emp_a') = 0, 'Outra Estética não vê os cargos da Wingard');
select teste.ok((select count(*) from public.membros where empresa_id = :'emp_a') = 0, 'Outra Estética não vê a equipe da Wingard');
select teste.ok((select count(*) from public.perfis where email like '%wingard%') = 0, 'Outra Estética não vê nome nem e-mail de quem trabalha na Wingard');
select teste.ok((select count(*) from public.auditoria where empresa_id = :'emp_a') = 0, 'Outra Estética não vê o histórico da Wingard');
select teste.ok(not public.tem_permissao(:'emp_a', 'comercial', 'ver'), 'administrador de outra empresa não tem permissão nenhuma na Wingard');
select teste.erro(format('insert into public.cargos (empresa_id, nome, nivel, pai_id) values (%L, %L, %L, %L)', :'emp_a', 'Infiltrado', 'equipe', :'cargo_adm_b'), 'não dá para criar cargo na empresa dos outros');
select teste.ok(teste.linhas(format('update public.empresas set nome = %L where id = %L', 'Hackeada', :'emp_a')) = 0, 'não dá para alterar a empresa dos outros');

reset role; select set_config('request.jwt.claim.sub', :'curioso', false); set role authenticated;
select teste.ok((select count(*) from public.empresas) = 0, 'quem criou conta sem convite não vê empresa nenhuma');
select teste.ok((select count(*) from public.cargos) + (select count(*) from public.membros) + (select count(*) from public.perfis where user_id <> auth.uid()) = 0, 'quem não tem convite não vê cargos, equipe nem outras pessoas');
select teste.erro($$select public.criar_empresa('Pirata', 'pirata')$$, 'só o dono da plataforma cria empresas');

reset role; set role anon;
select teste.erro('select count(*) from public.empresas', 'visitante sem login não lê nada');
reset role;

-- ============ vendedor: só o Comercial
select set_config('request.jwt.claim.sub', :'vend_a', false); set role authenticated;
select teste.ok(public.tem_permissao(:'emp_a', 'comercial', 'editar'), 'vendedor pode criar e editar no Comercial');
select teste.ok(not public.tem_permissao(:'emp_a', 'financeiro', 'ver'), 'vendedor não vê o Financeiro');
select teste.ok(not public.tem_permissao(:'emp_a', 'operacional', 'ver'), 'vendedor não vê o Operacional');
select teste.ok((select count(*) from public.minhas_permissoes(:'emp_a')) = 2, 'menu do vendedor mostra só o que ele pode usar');
select teste.ok((select escopo from public.membros where user_id = auth.uid()) = 'proprios', 'vendedor configurado para ver só os próprios atendimentos');
select teste.erro(format('insert into public.cargos (empresa_id, nome, nivel, pai_id) values (%L, %L, %L, %L)', :'emp_a', 'Chefe', 'equipe', :'cargo_adm_a'), 'vendedor não cria cargos');
select teste.ok(teste.linhas(format('update public.membros set cargo_id = %L where user_id = auth.uid()', :'cargo_fin')) = 0, 'vendedor não se promove sozinho');
select teste.ok((select count(*) from public.auditoria) = 0, 'vendedor não lê o histórico de alterações');

-- ============ gerente financeiro: administra só a área dele
reset role; select set_config('request.jwt.claim.sub', :'fin_a', false); set role authenticated;
select teste.ok(public.tem_permissao(:'emp_a', 'financeiro', 'aprovar'), 'gerente financeiro aprova no Financeiro');
select teste.ok(not public.tem_permissao(:'emp_a', 'comercial', 'editar'), 'gerente financeiro só vê o Comercial, não edita');
select teste.erro(format('select public.criar_convite(%L, %L, %L)', :'emp_a', 'novo@x.test', :'cargo_vend'), 'gerente financeiro não convida vendedor (o cargo tem permissão que ele não tem)');
insert into public.cargos (empresa_id, nome, nivel, pai_id) values (:'emp_a', 'Assistente financeiro', 'equipe', :'cargo_fin') returning id as cargo_assist \gset
insert into public.cargo_permissoes (cargo_id, empresa_id, modulo, acao) values (:'cargo_assist', :'emp_a', 'financeiro', 'ver'), (:'cargo_assist', :'emp_a', 'financeiro', 'editar');
select teste.ok(true, 'gerente financeiro criou o cargo de Assistente financeiro');
select teste.erro(format('insert into public.cargo_permissoes (cargo_id, empresa_id, modulo, acao) values (%L, %L, %L, %L)', :'cargo_assist', :'emp_a', 'comercial', 'editar'), 'gerente financeiro não libera o que não tem (editar no Comercial)');
select public.criar_convite(:'emp_a', 'assistente@wingard.test', :'cargo_assist') as conv_assist \gset
select teste.ok(teste.linhas(format('update public.membros set cargo_id = %L where user_id = auth.uid()', :'cargo_adm_a')) = 0, 'gerente financeiro não muda o próprio cargo');
select teste.ok((select count(*) from public.auditoria where empresa_id = :'emp_a') > 0, 'gerente financeiro vê o histórico da Wingard');

reset role; select set_config('request.jwt.claim.sub', :'assist_a', false); set role authenticated;
select public.aceitar_convite(:'conv_assist');
select teste.ok(public.tem_permissao(:'emp_a', 'financeiro', 'editar'), 'assistente financeiro entrou e edita no Financeiro');

-- ============ tirar permissão de cima tira de todos abaixo
reset role; select set_config('request.jwt.claim.sub', :'adm_a', false); set role authenticated;
delete from public.cargo_permissoes where cargo_id = :'cargo_fin' and modulo = 'financeiro' and acao = 'editar';
reset role; select set_config('request.jwt.claim.sub', :'assist_a', false); set role authenticated;
select teste.ok(not public.tem_permissao(:'emp_a', 'financeiro', 'editar'), 'administrador tirou "editar" do gerente financeiro e o assistente perdeu junto');
select teste.ok(public.tem_permissao(:'emp_a', 'financeiro', 'ver'), 'assistente continua vendo o Financeiro');

-- ============ teto da empresa definido pelo dono da plataforma
reset role; select set_config('request.jwt.claim.sub', :'dono', false); set role authenticated;
delete from public.empresa_teto where empresa_id = :'emp_a' and modulo = 'financeiro' and acao = 'excluir';
reset role; select set_config('request.jwt.claim.sub', :'adm_a', false); set role authenticated;
select teste.ok(not public.tem_permissao(:'emp_a', 'financeiro', 'excluir'), 'dono da plataforma tirou "excluir" do Financeiro: nem o administrador da Wingard tem mais');
select teste.ok(public.tem_permissao(:'emp_a', 'financeiro', 'ver'), 'o resto do Financeiro continua liberado');
select teste.erro(format('insert into public.empresa_teto values (%L, %L, %L)', :'emp_a', 'financeiro', 'excluir'), 'administrador da empresa não aumenta o próprio teto');
select teste.ok((select count(*) from public.auditoria where tabela = 'empresa_teto' and acao = 'delete') = 1, 'a mudança de teto ficou registrada no histórico');

-- ============ empresa desativada (ex.: falta de pagamento)
reset role; select set_config('request.jwt.claim.sub', :'dono', false); set role authenticated;
update public.empresas set ativa = false where id = :'emp_a';
reset role; select set_config('request.jwt.claim.sub', :'vend_a', false); set role authenticated;
select teste.ok((select count(*) from public.empresas) = 0 and not public.tem_permissao(:'emp_a', 'comercial', 'ver'), 'empresa desativada: a equipe perde o acesso na hora');
reset role; select set_config('request.jwt.claim.sub', :'dono', false); set role authenticated;
select teste.ok((select count(*) from public.empresas) = 2, 'dono da plataforma continua vendo todas as empresas');
reset role;

-- ============ acesso direto (tela "crie sua senha")
select set_config('request.jwt.claim.sub', :'dono', false); set role authenticated;
select public.criar_convite(:'emp_a', 'Novo@Wingard.test', :'cargo_vend', 'todos', 'Pessoa Nova') as conv_novo \gset
select public.criar_convite(:'emp_a', 'novo@wingard.test', :'cargo_vend', 'todos', 'Pessoa Nova') as conv_novo2 \gset
select teste.ok((select count(*) from public.convites where email = 'novo@wingard.test' and aceito_em is null) = 1, 'convidar de novo o mesmo e-mail substitui o convite antigo');
reset role; set role anon;
select teste.ok((select empresa from public.ver_convite(:'conv_novo2')) = 'Wingard Proteção Automotiva', 'quem tem o link vê para qual empresa é o acesso, mesmo sem login');
select teste.ok((select count(*) from public.ver_convite('codigo-inventado')) = 0, 'código inventado não mostra nada');
select teste.ok((select conta_ativa from public.ver_convite(:'conv_fin')) = false, 'conta sem senha aparece como não ativada');
select teste.erro($$select * from public.usuario_por_email('admin@wingard.test')$$, 'visitante não consegue procurar contas por e-mail');
reset role; select set_config('request.jwt.claim.sub', :'vend_a', false); set role authenticated;
select teste.erro($$select * from public.usuario_por_email('admin@wingard.test')$$, 'usuário logado também não procura contas por e-mail (só o servidor)');
reset role;

-- ============ painel do dono
select set_config('request.jwt.claim.sub', :'dono', false); set role authenticated;
select teste.ok((select count(*) from public.resumo_empresas()) = 2, 'dono vê o resumo de todas as empresas no painel');
select teste.ok((select usuarios from public.resumo_empresas() where slug = 'wingard') = 4, 'painel conta os usuários da Wingard');
select teste.ok((select count(*) from public.usuarios_da_empresa(:'emp_a')) = 4, 'dono vê a lista de usuários da Wingard');
reset role; select set_config('request.jwt.claim.sub', :'adm_b', false); set role authenticated;
select teste.erro('select * from public.resumo_empresas()', 'administrador de empresa não vê o painel da plataforma');
select teste.erro(format('select * from public.usuarios_da_empresa(%L)', :'emp_a'), 'administrador de outra empresa não vê os usuários da Wingard');
reset role; select set_config('request.jwt.claim.sub', :'vend_a', false); set role authenticated;
select teste.erro(format('select * from public.usuarios_da_empresa(%L)', :'emp_a'), 'vendedor não vê a lista de usuários (sem permissão de equipe)');
reset role;

-- ============ links para o cliente
select set_config('request.jwt.claim.sub', :'dono', false); set role authenticated;
update public.empresas set ativa = true where slug = 'wingard';
select public.criar_link_visualizacao(:'emp_a', 7) as link_ver \gset
select public.criar_convite(:'emp_a', null, :'cargo_adm_a') as conv_aberto \gset
reset role; set role anon;
select teste.ok(public.abrir_link_visualizacao(:'link_ver') = 'wingard', 'link de visualização abre a Wingard sem login');
select teste.ok(public.abrir_link_visualizacao('inventado') is null, 'link inventado não abre nada');
select teste.erro('select count(*) from public.links_visualizacao', 'visitante não lista os links');
reset role; select set_config('request.jwt.claim.sub', :'adm_a', false); set role authenticated;
select teste.ok((select count(*) from public.links_visualizacao) = 0, 'administrador da empresa não vê os links do dono');
select teste.erro(format('select public.criar_link_visualizacao(%L)', :'emp_a'), 'administrador da empresa não cria link de visualização');
reset role; select set_config('request.jwt.claim.sub', :'dono', false); set role authenticated;
update public.links_visualizacao set ativo = false;
reset role; set role anon;
select teste.ok(public.abrir_link_visualizacao(:'link_ver') is null, 'link desativado pelo dono para de funcionar');
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'novo.admin@wingard.test');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false); set role authenticated;
select teste.ok(public.aceitar_convite(:'conv_aberto') = :'emp_a'::uuid, 'convite aberto: quem abriu virou administrador da Wingard');
select teste.ok(public.tem_permissao(:'emp_a', 'equipe', 'editar'), 'o novo administrador já pode montar a equipe');
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c2', 'outro@x.test');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false); set role authenticated;
select teste.erro(format('select public.aceitar_convite(%L)', :'conv_aberto'), 'convite aberto só pode ser usado uma vez');
reset role;

-- ============ limite de pessoas e áreas padrão
select set_config('request.jwt.claim.sub', :'dono', false); set role authenticated;
select public.criar_empresa('Quantum Estética', 'quantum') as emp_q \gset
select teste.ok((select count(*) from public.cargos where empresa_id = :'emp_q') = 4, 'empresa nova já nasce com Administrador, Financeiro, Comercial e Operacional');
update public.empresas set limite_usuarios = 2 where id = :'emp_q';
select id as cargo_com_q from public.cargos where empresa_id = :'emp_q' and nome = 'Comercial' \gset
select id as cargo_adm_q from public.cargos where empresa_id = :'emp_q' and nivel = 'admin_empresa' \gset
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'adm@quantum.test');
insert into public.membros (empresa_id, user_id, cargo_id) values (:'emp_q', '00000000-0000-0000-0000-0000000000d1', :'cargo_adm_q');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false); set role authenticated;
select public.criar_convite(:'emp_q', 'a@quantum.test', :'cargo_com_q');
select public.criar_convite(:'emp_q', 'b@quantum.test', :'cargo_com_q');
select teste.ok((select livres from public.vagas_da_empresa(:'emp_q')) = 0, 'contador de vagas: 2 de 2 usadas');
select teste.erro(format('select public.criar_convite(%L, %L, %L)', :'emp_q', 'c@quantum.test', :'cargo_com_q'), 'administrador não passa do limite de pessoas do plano');
reset role; select set_config('request.jwt.claim.sub', :'dono', false); set role authenticated;
select teste.ok(public.criar_convite(:'emp_q', 'outro.adm@quantum.test', :'cargo_adm_q') is not null, 'administradores não contam no limite (o dono adiciona mesmo com as vagas cheias)');
reset role;
