-- Tudo o que a equipe lança no sistema (atendimentos, clientes, catálogo, equipe, tempos ideais)
-- fica salvo aqui, por empresa. Assim uma atualização do sistema nunca apaga o que o cliente lançou.
create table public.registros (
  empresa_id     uuid not null references public.empresas (id) on delete cascade,
  colecao        text not null check (colecao in ('atendimentos', 'clientes', 'catalogo', 'config')),
  id             text not null check (length(id) between 1 and 80),
  dados          jsonb,
  excluido       boolean not null default false,
  atualizado_em  timestamptz not null default clock_timestamp(),
  atualizado_por uuid references auth.users (id) on delete set null default auth.uid(),
  primary key (empresa_id, colecao, id),
  check (excluido or dados is not null),
  check (dados is null or pg_column_size(dados) < 2000000)
);
create index registros_recentes on public.registros (empresa_id, atualizado_em);

-- Quem vê / altera cada coleção (as áreas do cargo continuam valendo).
create or replace function interno.pode_registro(p_empresa uuid, p_colecao text, p_acao text)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_colecao
    when 'config'   then public.tem_permissao(p_empresa, 'operacional', p_acao)
    when 'catalogo' then public.tem_permissao(p_empresa, 'comercial', p_acao)
                      or (p_acao = 'ver' and (public.tem_permissao(p_empresa, 'operacional', 'ver') or public.tem_permissao(p_empresa, 'financeiro', 'ver')))
    else public.tem_permissao(p_empresa, 'comercial', p_acao)
      or public.tem_permissao(p_empresa, 'operacional', p_acao)
      or public.tem_permissao(p_empresa, 'financeiro', p_acao)
  end;
$$;
revoke execute on function interno.pode_registro(uuid, text, text) from public, anon;
grant execute on function interno.pode_registro(uuid, text, text) to authenticated;

alter table public.registros enable row level security;
create policy reg_ler     on public.registros for select to authenticated using (interno.pode_registro(empresa_id, colecao, 'ver'));
create policy reg_criar   on public.registros for insert to authenticated with check (interno.pode_registro(empresa_id, colecao, 'editar'));
create policy reg_alterar on public.registros for update to authenticated
  using (interno.pode_registro(empresa_id, colecao, 'editar')) with check (interno.pode_registro(empresa_id, colecao, 'editar'));
grant select, insert, update on public.registros to authenticated;

create or replace function public.registros_atualizado() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and (new.empresa_id, new.colecao, new.id) is distinct from (old.empresa_id, old.colecao, old.id) then
    raise exception 'Não é permitido mover o registro.' using errcode = '42501';
  end if;
  new.atualizado_em := clock_timestamp();
  new.atualizado_por := auth.uid();
  return new;
end $$;
create trigger registros_atualizado before insert or update on public.registros for each row execute function public.registros_atualizado();
