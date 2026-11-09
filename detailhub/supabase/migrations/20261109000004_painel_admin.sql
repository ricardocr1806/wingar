-- Painel administrativo do dono da plataforma e lista de usuários de cada empresa.

-- Resumo de todas as empresas (só o dono da plataforma).
create or replace function public.resumo_empresas()
returns table (id uuid, nome text, slug text, ativa boolean, criada_em timestamptz,
               usuarios bigint, usuarios_ativos bigint, pendentes bigint, modulos text[], ultimo_acesso timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_dono_plataforma() then
    raise exception 'Só o dono da plataforma vê o painel.' using errcode = '42501';
  end if;
  return query
  select e.id, e.nome, e.slug, e.ativa, e.criada_em,
         (select count(*) from public.membros m where m.empresa_id = e.id),
         (select count(*) from public.membros m where m.empresa_id = e.id and m.ativo),
         (select count(*) from public.convites c where c.empresa_id = e.id and c.aceito_em is null and c.expira_em > now()),
         (select coalesce(array_agg(t.modulo order by mo.ordem), '{}') from public.empresa_teto t join public.modulos mo on mo.codigo = t.modulo
           where t.empresa_id = e.id and t.acao = 'ver'),
         (select max(u.last_sign_in_at) from public.membros m join auth.users u on u.id = m.user_id where m.empresa_id = e.id)
    from public.empresas e
   order by e.criada_em;
end $$;
revoke execute on function public.resumo_empresas() from public, anon;
grant execute on function public.resumo_empresas() to authenticated;

-- Usuários de uma empresa com cargo e último acesso (dono ou quem administra a equipe).
create or replace function public.usuarios_da_empresa(p_empresa uuid)
returns table (user_id uuid, nome text, email text, cargo_id uuid, cargo text, nivel public.nivel_cargo,
               escopo text, ativo boolean, ultimo_acesso timestamptz, entrou_em timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.tem_permissao(p_empresa, 'equipe', 'ver') then
    raise exception 'Você não tem permissão para ver a equipe desta empresa.' using errcode = '42501';
  end if;
  return query
  select m.user_id, coalesce(p.nome, u.raw_user_meta_data->>'full_name'), u.email::text, m.cargo_id, c.nome, c.nivel,
         m.escopo, m.ativo, u.last_sign_in_at, m.criado_em
    from public.membros m
    join auth.users u on u.id = m.user_id
    left join public.perfis p on p.user_id = m.user_id
    join public.cargos c on c.id = m.cargo_id
   where m.empresa_id = p_empresa
   order by c.nivel, coalesce(p.nome, u.email::text);
end $$;
revoke execute on function public.usuarios_da_empresa(uuid) from public, anon;
grant execute on function public.usuarios_da_empresa(uuid) to authenticated;
