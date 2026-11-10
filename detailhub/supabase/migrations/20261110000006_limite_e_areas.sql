-- Limite de pessoas por empresa (definido pelo dono) e áreas padrão de acesso.
-- Áreas: Administrador (tudo + equipe), Financeiro (vê e trabalha em tudo), Comercial (só Comercial), Operacional (só Operacional).

alter table public.empresas add column if not exists limite_usuarios int not null default 5 check (limite_usuarios between 1 and 500);

-- Vagas: conta quem não é administrador (ativos + acessos pendentes ainda válidos).
create or replace function public.vagas_da_empresa(p_empresa uuid)
returns table (limite int, usados int, livres int)
language sql stable security definer set search_path = public as $$
  with u as (
    select (select count(*) from public.membros m join public.cargos c on c.id = m.cargo_id
             where m.empresa_id = p_empresa and m.ativo and c.nivel <> 'admin_empresa')
         + (select count(*) from public.convites v join public.cargos c on c.id = v.cargo_id
             where v.empresa_id = p_empresa and v.aceito_em is null and v.expira_em > now() and c.nivel <> 'admin_empresa') as n
  )
  select e.limite_usuarios, u.n::int, greatest(e.limite_usuarios - u.n::int, 0)
    from public.empresas e, u where e.id = p_empresa and public.eh_membro(p_empresa);
$$;
grant execute on function public.vagas_da_empresa(uuid) to authenticated;

create or replace function public.trava_limite() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_livres int; v_nivel public.nivel_cargo;
begin
  select nivel into v_nivel from public.cargos where id = new.cargo_id;
  if v_nivel = 'admin_empresa' then return new; end if;
  if tg_table_name = 'membros' then
    -- só conta quando alguém é reativado ou muda de administrador para outra área
    if not new.ativo then return new; end if;
    if old.ativo and old.cargo_id = new.cargo_id then return new; end if;
    if old.ativo and (select nivel from public.cargos where id = old.cargo_id) <> 'admin_empresa' then return new; end if;
  end if;
  select livres into v_livres from public.vagas_da_empresa(new.empresa_id);
  if coalesce(v_livres, 0) <= 0 and not public.eh_dono_plataforma() then
    raise exception 'A empresa já usa todas as vagas do plano (%). Remova alguém ou fale com o DetailHub para aumentar.', (select limite_usuarios from public.empresas where id = new.empresa_id) using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger convites_limite before insert on public.convites for each row execute function public.trava_limite();
create trigger membros_limite before update on public.membros for each row execute function public.trava_limite();

-- Áreas padrão para empresas novas
create or replace function public.criar_areas_padrao(p_empresa uuid)
returns void language plpgsql security definer set search_path = public as $$
declare adm uuid; v uuid;
begin
  select id into adm from public.cargos where empresa_id = p_empresa and nivel = 'admin_empresa';
  insert into public.cargos (empresa_id, nome, nivel, pai_id) values
    (p_empresa, 'Financeiro', 'equipe', adm), (p_empresa, 'Comercial', 'equipe', adm), (p_empresa, 'Operacional', 'equipe', adm)
  on conflict (empresa_id, nome) do nothing;
  select id into v from public.cargos where empresa_id = p_empresa and nome = 'Financeiro';
  insert into public.cargo_permissoes (cargo_id, empresa_id, modulo, acao)
    select v, p_empresa, m, a from (values ('comercial'),('operacional'),('financeiro')) mm(m) cross join (values ('ver'),('editar'),('exportar')) aa(a)
    union all select v, p_empresa, 'financeiro', a from (values ('excluir'),('aprovar')) aa(a)
  on conflict do nothing;
  select id into v from public.cargos where empresa_id = p_empresa and nome = 'Comercial';
  insert into public.cargo_permissoes (cargo_id, empresa_id, modulo, acao)
    select v, p_empresa, 'comercial', a from (values ('ver'),('editar'),('exportar')) aa(a) on conflict do nothing;
  select id into v from public.cargos where empresa_id = p_empresa and nome = 'Operacional';
  insert into public.cargo_permissoes (cargo_id, empresa_id, modulo, acao)
    select v, p_empresa, 'operacional', a from (values ('ver'),('editar'),('exportar')) aa(a) on conflict do nothing;
end $$;
revoke execute on function public.criar_areas_padrao(uuid) from public, anon, authenticated;

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
  perform public.criar_areas_padrao(v_emp);
  return v_emp;
end $$;
