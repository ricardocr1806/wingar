-- Acesso direto: o dono (ou o administrador) adiciona a pessoa e ela só cria a senha pelo link recebido.

-- Dados do convite para a tela "crie sua senha" (quem tem o código vê para qual e-mail e empresa ele é).
create or replace function public.ver_convite(p_token text)
returns table (email text, empresa text, empresa_slug text, cargo text, expirado boolean, usado boolean, conta_ativa boolean)
language sql stable security definer set search_path = public, extensions as $$
  select c.email, e.nome, e.slug, cg.nome, c.expira_em < now(), c.aceito_em is not null,
         exists (select 1 from auth.users u
                  where lower(u.email) = c.email
                    and (u.last_sign_in_at is not null or coalesce(u.encrypted_password, '') <> ''))
    from public.convites c
    join public.empresas e on e.id = c.empresa_id
    join public.cargos cg on cg.id = c.cargo_id
   where c.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;
revoke execute on function public.ver_convite(text) from public;
grant execute on function public.ver_convite(text) to anon, authenticated;

-- Só o servidor do sistema (chave secreta) usa: achar a conta pelo e-mail.
create or replace function public.usuario_por_email(p_email text)
returns table (id uuid, ja_ativa boolean)
language sql stable security definer set search_path = public as $$
  select u.id, (u.last_sign_in_at is not null or coalesce(u.encrypted_password, '') <> '')
    from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1;
$$;
revoke execute on function public.usuario_por_email(text) from public, anon, authenticated;
grant execute on function public.usuario_por_email(text) to service_role;

-- Convites pendentes com nome de quem vai entrar
alter table public.convites add column if not exists nome text;

create or replace function public.criar_convite(p_empresa uuid, p_email text, p_cargo uuid, p_escopo text default 'todos', p_nome text default null)
returns text language plpgsql security invoker set search_path = public, extensions as $$
declare v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  -- um convite pendente por e-mail e empresa: o novo substitui o anterior
  delete from public.convites where empresa_id = p_empresa and email = lower(btrim(p_email)) and aceito_em is null;
  insert into public.convites (empresa_id, email, nome, cargo_id, escopo, token_hash, criado_por)
  values (p_empresa, lower(btrim(p_email)), nullif(btrim(p_nome), ''), p_cargo, coalesce(p_escopo, 'todos'),
          encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid());
  return v_token;
end $$;
drop function if exists public.criar_convite(uuid, text, uuid, text);
revoke execute on function public.criar_convite(uuid, text, uuid, text, text) from public, anon;
grant execute on function public.criar_convite(uuid, text, uuid, text, text) to authenticated;
