-- Links que o dono gera para mandar ao cliente:
-- 1) link de visualização (vê a plataforma sem login, com validade e podendo ser desativado);
-- 2) convite aberto (sem e-mail definido, uso único): quem abrir cria a conta e entra com o cargo do convite.

-- 2) convite sem e-mail
alter table public.convites alter column email drop not null;
alter table public.convites drop constraint if exists convites_email_check;
alter table public.convites add constraint convites_email_check check (email is null or (email = lower(btrim(email)) and email like '%_@_%'));

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
  if v_conv.expira_em < now() then raise exception 'Este convite expirou. Peça um novo.' using errcode = 'P0001'; end if;
  if v_conv.email is not null and v_conv.email <> v_email then raise exception 'Este convite foi enviado para outro e-mail.' using errcode = '42501'; end if;
  insert into public.membros (empresa_id, user_id, cargo_id, escopo)
  values (v_conv.empresa_id, auth.uid(), v_conv.cargo_id, v_conv.escopo)
  on conflict (empresa_id, user_id) do update set cargo_id = excluded.cargo_id, escopo = excluded.escopo, ativo = true;
  update public.convites set aceito_em = now(), email = coalesce(email, v_email) where id = v_conv.id;
  return v_conv.empresa_id;
end $$;

-- 1) links de visualização
create table public.links_visualizacao (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  token_hash text not null unique,
  expira_em  timestamptz not null,
  ativo      boolean not null default true,
  acessos    int not null default 0,
  ultimo_acesso timestamptz,
  criado_por uuid references auth.users (id) on delete set null,
  criado_em  timestamptz not null default now()
);
alter table public.links_visualizacao enable row level security;
create policy links_dono on public.links_visualizacao for all to authenticated
  using (public.eh_dono_plataforma()) with check (public.eh_dono_plataforma());
grant select, insert, update, delete on public.links_visualizacao to authenticated;
create trigger aud_links after insert or update or delete on public.links_visualizacao for each row execute function public.auditar();

create or replace function public.criar_link_visualizacao(p_empresa uuid, p_dias int default 7)
returns text language plpgsql security invoker set search_path = public, extensions as $$
declare v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  insert into public.links_visualizacao (empresa_id, token_hash, expira_em, criado_por)
  values (p_empresa, encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + make_interval(days => least(greatest(p_dias, 1), 30)), auth.uid());
  return v_token;
end $$;
revoke execute on function public.criar_link_visualizacao(uuid, int) from public, anon;
grant execute on function public.criar_link_visualizacao(uuid, int) to authenticated;

-- Abre o link (sem login): devolve a empresa se o link estiver valendo e conta o acesso.
create or replace function public.abrir_link_visualizacao(p_token text)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_slug text;
begin
  update public.links_visualizacao l set acessos = acessos + 1, ultimo_acesso = now()
    from public.empresas e
   where l.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and l.ativo and l.expira_em > now() and e.id = l.empresa_id and e.ativa
  returning e.slug into v_slug;
  return v_slug;
end $$;
revoke execute on function public.abrir_link_visualizacao(text) from public;
grant execute on function public.abrir_link_visualizacao(text) to anon, authenticated;
