-- DetailHub · Etapa 1 · Base de acesso
-- Empresas, cargos, permissões, membros, convites e auditoria.
--
-- Regras de segurança (valem no próprio banco, mesmo que o sistema tenha um erro):
--   1. Cada empresa só enxerga os próprios dados (Row Level Security em todas as tabelas).
--   2. Permissão efetiva de um cargo = permissões dele ∩ permissões efetivas do cargo pai ∩ teto da empresa.
--      Tirar uma permissão de um cargo tira automaticamente de todos os cargos abaixo dele.
--   3. Ninguém libera para outra pessoa uma permissão que não tem.
--   4. Só o dono da plataforma cria empresas, define o teto delas e mexe no cargo de administrador da empresa.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tipos e catálogos
create type public.nivel_cargo as enum ('admin_empresa', 'admin_area', 'equipe');

create table public.modulos (
  codigo text primary key,
  nome   text not null,
  ordem  int  not null
);
insert into public.modulos (codigo, nome, ordem) values
  ('comercial',   'Comercial',       1),
  ('operacional', 'Operacional',     2),
  ('financeiro',  'Financeiro',      3),
  ('equipe',      'Equipe e cargos', 4);

create table public.acoes (
  codigo text primary key,
  nome   text not null,
  ordem  int  not null
);
insert into public.acoes (codigo, nome, ordem) values
  ('ver',      'Ver',            1),
  ('editar',   'Criar e editar', 2),
  ('excluir',  'Excluir',        3),
  ('aprovar',  'Aprovar',        4),
  ('exportar', 'Exportar',       5);

-- ---------------------------------------------------------------- plataforma
create table public.plataforma_admins (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);

create table public.empresas (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null check (length(btrim(nome)) between 2 and 120),
  slug      text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  ativa     boolean not null default true,
  criada_em timestamptz not null default now()
);

-- O que o dono da plataforma libera para cada empresa (plano contratado).
create table public.empresa_teto (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  modulo     text not null references public.modulos (codigo),
  acao       text not null references public.acoes (codigo),
  primary key (empresa_id, modulo, acao)
);

create table public.perfis (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  nome      text,
  email     text,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- cargos e permissões
create table public.cargos (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome       text not null check (length(btrim(nome)) between 2 and 60),
  nivel      public.nivel_cargo not null default 'equipe',
  pai_id     uuid,
  criado_em  timestamptz not null default now(),
  unique (empresa_id, nome),
  unique (id, empresa_id),
  -- o cargo pai é sempre da mesma empresa
  foreign key (pai_id, empresa_id) references public.cargos (id, empresa_id) on delete restrict,
  -- só o administrador da empresa não tem pai; todo outro cargo tem
  check ((nivel = 'admin_empresa') = (pai_id is null)),
  check (pai_id is distinct from id)
);
create unique index cargos_um_admin_por_empresa on public.cargos (empresa_id) where nivel = 'admin_empresa';

create table public.cargo_permissoes (
  cargo_id   uuid not null,
  empresa_id uuid not null,
  modulo     text not null references public.modulos (codigo),
  acao       text not null references public.acoes (codigo),
  primary key (cargo_id, modulo, acao),
  foreign key (cargo_id, empresa_id) references public.cargos (id, empresa_id) on delete cascade
);

create table public.membros (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  cargo_id   uuid not null,
  escopo     text not null default 'todos' check (escopo in ('todos', 'proprios')),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  primary key (empresa_id, user_id),
  foreign key (cargo_id, empresa_id) references public.cargos (id, empresa_id)
);
create index membros_user_idx on public.membros (user_id);

create table public.convites (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas (id) on delete cascade,
  email       text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  cargo_id    uuid not null,
  escopo      text not null default 'todos' check (escopo in ('todos', 'proprios')),
  token_hash  text not null unique,
  expira_em   timestamptz not null default now() + interval '7 days',
  aceito_em   timestamptz,
  criado_por  uuid references auth.users (id) on delete set null,
  criado_em   timestamptz not null default now(),
  foreign key (cargo_id, empresa_id) references public.cargos (id, empresa_id) on delete cascade
);

create table public.auditoria (
  id         bigint generated always as identity primary key,
  empresa_id uuid references public.empresas (id) on delete set null,
  user_id    uuid,
  acao       text not null,
  tabela     text not null,
  registro   jsonb,
  criado_em  timestamptz not null default now()
);
create index auditoria_empresa_idx on public.auditoria (empresa_id, criado_em desc);

-- ---------------------------------------------------------------- funções de permissão
-- Todas são SECURITY DEFINER para ler as tabelas sem cair na própria RLS (evita recursão),
-- e todas usam auth.uid() — o usuário não consegue se passar por outro.

create or replace function public.eh_dono_plataforma()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.plataforma_admins where user_id = auth.uid());
$$;

-- Permissão efetiva de um cargo, subindo a cadeia de cargos pais.
create or replace function public.cargo_tem(p_cargo uuid, p_modulo text, p_acao text)
returns boolean language sql stable security definer set search_path = public as $$
  with recursive cadeia as (
    select c.id, c.pai_id, c.empresa_id, 1 as nivel from public.cargos c where c.id = p_cargo
    union all
    select c.id, c.pai_id, c.empresa_id, k.nivel + 1
      from public.cargos c join cadeia k on c.id = k.pai_id
     where k.nivel < 10
  )
  select exists (select 1 from cadeia)
     and not exists (
       select 1 from cadeia k
        where not exists (select 1 from public.cargo_permissoes cp
                           where cp.cargo_id = k.id and cp.modulo = p_modulo and cp.acao = p_acao))
     and exists (
       select 1 from public.empresa_teto t
        where t.empresa_id = (select empresa_id from cadeia limit 1)
          and t.modulo = p_modulo and t.acao = p_acao);
$$;

create or replace function public.eh_membro(p_empresa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.eh_dono_plataforma() or exists (
    select 1 from public.membros m join public.empresas e on e.id = m.empresa_id
     where m.empresa_id = p_empresa and m.user_id = auth.uid() and m.ativo and e.ativa);
$$;

create or replace function public.tem_permissao(p_empresa uuid, p_modulo text, p_acao text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.eh_dono_plataforma() or exists (
    select 1 from public.membros m join public.empresas e on e.id = m.empresa_id
     where m.empresa_id = p_empresa and m.user_id = auth.uid() and m.ativo and e.ativa
       and public.cargo_tem(m.cargo_id, p_modulo, p_acao));
$$;

-- O usuário atual tem todas as permissões efetivas deste cargo? (regra "ninguém dá o que não tem")
create or replace function public.cargo_contido(p_cargo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.eh_dono_plataforma() or not exists (
    select 1
      from public.cargos c cross join public.modulos mo cross join public.acoes ac
     where c.id = p_cargo
       and public.cargo_tem(c.id, mo.codigo, ac.codigo)
       and not public.tem_permissao(c.empresa_id, mo.codigo, ac.codigo));
$$;

create or replace function public.nivel_do_cargo(p_cargo uuid)
returns public.nivel_cargo language sql stable security definer set search_path = public as $$
  select nivel from public.cargos where id = p_cargo;
$$;

-- Pode administrar a equipe desta empresa (criar cargos, convidar, mudar cargos)?
create or replace function public.gere_equipe(p_empresa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.tem_permissao(p_empresa, 'equipe', 'editar');
$$;

-- Permissões efetivas do usuário atual numa empresa (para montar o menu e esconder botões).
create or replace function public.minhas_permissoes(p_empresa uuid)
returns table (modulo text, acao text) language sql stable security definer set search_path = public as $$
  select mo.codigo, ac.codigo
    from public.modulos mo cross join public.acoes ac
   where public.tem_permissao(p_empresa, mo.codigo, ac.codigo)
     and (public.eh_dono_plataforma() or exists (
           select 1 from public.empresa_teto t
            where t.empresa_id = p_empresa and t.modulo = mo.codigo and t.acao = ac.codigo));
$$;

-- ---------------------------------------------------------------- RLS
alter table public.modulos           enable row level security;
alter table public.acoes             enable row level security;
alter table public.plataforma_admins enable row level security;
alter table public.empresas          enable row level security;
alter table public.empresa_teto      enable row level security;
alter table public.perfis            enable row level security;
alter table public.cargos            enable row level security;
alter table public.cargo_permissoes  enable row level security;
alter table public.membros           enable row level security;
alter table public.convites          enable row level security;
alter table public.auditoria         enable row level security;

create policy modulos_ler on public.modulos for select to authenticated using (true);
create policy acoes_ler   on public.acoes   for select to authenticated using (true);

create policy plataforma_admins_ler on public.plataforma_admins for select to authenticated
  using (user_id = auth.uid() or public.eh_dono_plataforma());

-- empresas: membro vê a sua; só o dono da plataforma cria, altera ou exclui
create policy empresas_ler      on public.empresas for select to authenticated using (public.eh_membro(id));
create policy empresas_criar    on public.empresas for insert to authenticated with check (public.eh_dono_plataforma());
create policy empresas_alterar  on public.empresas for update to authenticated using (public.eh_dono_plataforma()) with check (public.eh_dono_plataforma());
create policy empresas_excluir  on public.empresas for delete to authenticated using (public.eh_dono_plataforma());

create policy teto_ler     on public.empresa_teto for select to authenticated using (public.eh_membro(empresa_id));
create policy teto_criar   on public.empresa_teto for insert to authenticated with check (public.eh_dono_plataforma());
create policy teto_excluir on public.empresa_teto for delete to authenticated using (public.eh_dono_plataforma());

-- perfis: cada um vê o próprio e o de quem trabalha na mesma empresa
create policy perfis_ler on public.perfis for select to authenticated using (
  user_id = auth.uid() or public.eh_dono_plataforma() or exists (
    select 1 from public.membros a join public.membros b on a.empresa_id = b.empresa_id
     where a.user_id = auth.uid() and a.ativo and b.user_id = perfis.user_id));
create policy perfis_criar   on public.perfis for insert to authenticated with check (user_id = auth.uid());
create policy perfis_alterar on public.perfis for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- cargos: o cargo de administrador da empresa só o dono da plataforma mexe
create policy cargos_ler on public.cargos for select to authenticated using (public.eh_membro(empresa_id));
create policy cargos_criar on public.cargos for insert to authenticated with check (
  public.eh_dono_plataforma() or (nivel <> 'admin_empresa' and public.gere_equipe(empresa_id)));
create policy cargos_alterar on public.cargos for update to authenticated
  using (public.eh_dono_plataforma() or (nivel <> 'admin_empresa' and public.gere_equipe(empresa_id)))
  with check (public.eh_dono_plataforma() or (nivel <> 'admin_empresa' and public.gere_equipe(empresa_id) and public.cargo_contido(id)));
create policy cargos_excluir on public.cargos for delete to authenticated using (
  public.eh_dono_plataforma() or (nivel <> 'admin_empresa' and public.gere_equipe(empresa_id) and public.cargo_contido(id)));

-- permissões: só libera ou tira o que você mesmo tem
create policy cperm_ler on public.cargo_permissoes for select to authenticated using (public.eh_membro(empresa_id));
create policy cperm_criar on public.cargo_permissoes for insert to authenticated with check (
  public.eh_dono_plataforma() or (
    public.nivel_do_cargo(cargo_id) <> 'admin_empresa'
    and public.gere_equipe(empresa_id)
    and public.tem_permissao(empresa_id, modulo, acao)));
create policy cperm_excluir on public.cargo_permissoes for delete to authenticated using (
  public.eh_dono_plataforma() or (
    public.nivel_do_cargo(cargo_id) <> 'admin_empresa'
    and public.gere_equipe(empresa_id)
    and public.tem_permissao(empresa_id, modulo, acao)));

-- membros: ninguém muda o próprio cargo, e só atribui cargo que caiba nas próprias permissões
create policy membros_ler on public.membros for select to authenticated using (public.eh_membro(empresa_id));
create policy membros_criar on public.membros for insert to authenticated with check (
  public.eh_dono_plataforma() or (
    user_id <> auth.uid()
    and public.gere_equipe(empresa_id)
    and public.nivel_do_cargo(cargo_id) <> 'admin_empresa'
    and public.cargo_contido(cargo_id)));
create policy membros_alterar on public.membros for update to authenticated
  using (public.eh_dono_plataforma() or (
    user_id <> auth.uid() and public.gere_equipe(empresa_id)
    and public.nivel_do_cargo(cargo_id) <> 'admin_empresa' and public.cargo_contido(cargo_id)))
  with check (public.eh_dono_plataforma() or (
    user_id <> auth.uid() and public.gere_equipe(empresa_id)
    and public.nivel_do_cargo(cargo_id) <> 'admin_empresa' and public.cargo_contido(cargo_id)));
create policy membros_excluir on public.membros for delete to authenticated using (
  public.eh_dono_plataforma() or (
    user_id <> auth.uid() and public.gere_equipe(empresa_id)
    and public.nivel_do_cargo(cargo_id) <> 'admin_empresa' and public.cargo_contido(cargo_id)));

-- convites: mesmas regras de quem pode atribuir o cargo
create policy convites_ler on public.convites for select to authenticated using (public.gere_equipe(empresa_id));
create policy convites_criar on public.convites for insert to authenticated with check (
  public.eh_dono_plataforma() or (
    public.gere_equipe(empresa_id)
    and public.nivel_do_cargo(cargo_id) <> 'admin_empresa'
    and public.cargo_contido(cargo_id)));
create policy convites_excluir on public.convites for delete to authenticated using (public.gere_equipe(empresa_id));

create policy auditoria_ler on public.auditoria for select to authenticated using (
  public.eh_dono_plataforma() or (empresa_id is not null and public.tem_permissao(empresa_id, 'equipe', 'ver')));

-- ---------------------------------------------------------------- travas extras
-- Fora o dono da plataforma, ninguém muda o nível nem o cargo pai de um cargo existente.
create or replace function public.trava_cargo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_dono_plataforma()
     and (new.nivel is distinct from old.nivel or new.pai_id is distinct from old.pai_id
          or new.empresa_id is distinct from old.empresa_id) then
    raise exception 'Só o dono da plataforma muda o nível ou o cargo pai de um cargo.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger cargos_trava before update on public.cargos for each row execute function public.trava_cargo();

-- Membro e convite não mudam de empresa.
create or replace function public.trava_empresa() returns trigger
language plpgsql as $$
begin
  if new.empresa_id is distinct from old.empresa_id then
    raise exception 'Não é permitido mudar o registro de empresa.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger membros_trava before update on public.membros for each row execute function public.trava_empresa();

-- ---------------------------------------------------------------- auditoria automática
create or replace function public.auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_reg jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_emp uuid;
begin
  v_emp := case when tg_table_name = 'empresas' then (v_reg->>'id')::uuid else (v_reg->>'empresa_id')::uuid end;
  if tg_table_name = 'convites' then v_reg := v_reg - 'token_hash'; end if;
  insert into public.auditoria (empresa_id, user_id, acao, tabela, registro)
  values (case when tg_op = 'DELETE' and tg_table_name = 'empresas' then null else v_emp end,
          auth.uid(), lower(tg_op), tg_table_name, v_reg);
  return null;
end $$;

create trigger aud_empresas    after insert or update or delete on public.empresas         for each row execute function public.auditar();
create trigger aud_teto        after insert or delete           on public.empresa_teto     for each row execute function public.auditar();
create trigger aud_cargos      after insert or update or delete on public.cargos           for each row execute function public.auditar();
create trigger aud_cperm       after insert or delete           on public.cargo_permissoes for each row execute function public.auditar();
create trigger aud_membros     after insert or update or delete on public.membros          for each row execute function public.auditar();
create trigger aud_convites    after insert or update or delete on public.convites         for each row execute function public.auditar();

-- ---------------------------------------------------------------- ações do sistema
-- Dono da plataforma cria uma empresa já com o teto completo e o cargo de Administrador.
create or replace function public.criar_empresa(p_nome text, p_slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_emp uuid; v_cargo uuid;
begin
  if not public.eh_dono_plataforma() then
    raise exception 'Só o dono da plataforma cria empresas.' using errcode = '42501';
  end if;
  insert into public.empresas (nome, slug) values (btrim(p_nome), lower(btrim(p_slug))) returning id into v_emp;
  insert into public.empresa_teto (empresa_id, modulo, acao)
    select v_emp, mo.codigo, ac.codigo from public.modulos mo cross join public.acoes ac;
  insert into public.cargos (empresa_id, nome, nivel) values (v_emp, 'Administrador', 'admin_empresa') returning id into v_cargo;
  insert into public.cargo_permissoes (cargo_id, empresa_id, modulo, acao)
    select v_cargo, v_emp, mo.codigo, ac.codigo from public.modulos mo cross join public.acoes ac;
  return v_emp;
end $$;

-- Cria um convite e devolve o código (só aparece uma vez; no banco fica só o hash).
create or replace function public.criar_convite(p_empresa uuid, p_email text, p_cargo uuid, p_escopo text default 'todos')
returns text language plpgsql security invoker set search_path = public, extensions as $$
declare v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  insert into public.convites (empresa_id, email, cargo_id, escopo, token_hash, criado_por)
  values (p_empresa, lower(btrim(p_email)), p_cargo, coalesce(p_escopo, 'todos'),
          encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid());
  return v_token;
end $$;

-- Quem recebeu o convite entra na empresa. O e-mail da conta precisa ser o do convite.
create or replace function public.aceitar_convite(p_token text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_conv public.convites; v_email text;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para aceitar o convite.' using errcode = '42501'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  select * into v_conv from public.convites
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if not found then raise exception 'Convite inválido.' using errcode = 'P0002'; end if;
  if v_conv.aceito_em is not null then raise exception 'Este convite já foi usado.' using errcode = 'P0001'; end if;
  if v_conv.expira_em < now() then raise exception 'Este convite expirou. Peça um novo ao administrador.' using errcode = 'P0001'; end if;
  if v_conv.email <> v_email then raise exception 'Este convite foi enviado para outro e-mail.' using errcode = '42501'; end if;
  insert into public.membros (empresa_id, user_id, cargo_id, escopo)
  values (v_conv.empresa_id, auth.uid(), v_conv.cargo_id, v_conv.escopo)
  on conflict (empresa_id, user_id) do update set cargo_id = excluded.cargo_id, escopo = excluded.escopo, ativo = true;
  update public.convites set aceito_em = now() where id = v_conv.id;
  return v_conv.empresa_id;
end $$;

-- Cria o perfil automaticamente quando alguém se cadastra (e-mail/senha ou Google).
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (user_id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), lower(new.email))
  on conflict (user_id) do nothing;
  return new;
end $$;
create trigger ao_criar_usuario after insert on auth.users for each row execute function public.novo_usuario();

-- ---------------------------------------------------------------- privilégios
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function
  public.eh_dono_plataforma(), public.eh_membro(uuid), public.tem_permissao(uuid, text, text),
  public.minhas_permissoes(uuid), public.criar_empresa(text, text),
  public.criar_convite(uuid, text, uuid, text), public.aceitar_convite(text)
  to authenticated;
-- Funções usadas dentro das políticas também precisam poder ser chamadas
grant execute on function
  public.cargo_tem(uuid, text, text), public.cargo_contido(uuid), public.nivel_do_cargo(uuid), public.gere_equipe(uuid)
  to authenticated;
revoke insert, update, delete on public.auditoria, public.modulos, public.acoes, public.plataforma_admins from authenticated;
