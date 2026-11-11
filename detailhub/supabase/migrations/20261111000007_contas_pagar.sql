-- Financeiro · Contas a pagar (primeiro módulo salvo de verdade no banco).
create table public.contas_pagar (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas (id) on delete cascade,
  descricao     text not null check (length(btrim(descricao)) between 1 and 200),
  fornecedor    text not null default '—' check (length(fornecedor) <= 200),
  centro_custo  text not null check (length(btrim(centro_custo)) between 1 and 60),
  vencimento    date not null,
  valor         numeric(14,2) not null check (valor > 0 and valor < 100000000),
  pago          boolean not null default false,
  pago_em       date,
  origem        text,
  criado_por    uuid references auth.users (id) on delete set null default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index contas_pagar_empresa_venc on public.contas_pagar (empresa_id, vencimento);
alter table public.contas_pagar enable row level security;

create policy cp_ler     on public.contas_pagar for select to authenticated using (public.tem_permissao(empresa_id, 'financeiro', 'ver'));
create policy cp_criar   on public.contas_pagar for insert to authenticated with check (public.tem_permissao(empresa_id, 'financeiro', 'editar'));
create policy cp_alterar on public.contas_pagar for update to authenticated
  using (public.tem_permissao(empresa_id, 'financeiro', 'editar')) with check (public.tem_permissao(empresa_id, 'financeiro', 'editar'));
create policy cp_excluir on public.contas_pagar for delete to authenticated using (public.tem_permissao(empresa_id, 'financeiro', 'excluir'));
grant select, insert, update, delete on public.contas_pagar to authenticated;

create or replace function public.contas_pagar_atualizado() returns trigger language plpgsql as $$
begin
  if new.empresa_id is distinct from old.empresa_id then
    raise exception 'Não é permitido mudar a conta de empresa.' using errcode = '42501';
  end if;
  new.atualizado_em := now();
  new.pago_em := case when new.pago then coalesce(new.pago_em, current_date) else null end;
  return new;
end $$;
create trigger contas_pagar_atualizado before update on public.contas_pagar for each row execute function public.contas_pagar_atualizado();
create trigger aud_contas_pagar after insert or update or delete on public.contas_pagar for each row execute function public.auditar();
