-- Move as funções auxiliares de permissão para um schema interno, que não é exposto pela API.
-- Assim ninguém consegue chamá-las direto pela internet para sondar cargos de outra empresa.
-- As políticas de segurança continuam usando as mesmas funções (ALTER ... SET SCHEMA mantém o vínculo).

create schema if not exists interno;
revoke all on schema interno from public;
grant usage on schema interno to authenticated;

alter function public.cargo_tem(uuid, text, text) set schema interno;
alter function public.cargo_contido(uuid)         set schema interno;
alter function public.nivel_do_cargo(uuid)        set schema interno;

create or replace function interno.cargo_contido(p_cargo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.eh_dono_plataforma() or not exists (
    select 1
      from public.cargos c cross join public.modulos mo cross join public.acoes ac
     where c.id = p_cargo
       and interno.cargo_tem(c.id, mo.codigo, ac.codigo)
       and not public.tem_permissao(c.empresa_id, mo.codigo, ac.codigo));
$$;

create or replace function public.tem_permissao(p_empresa uuid, p_modulo text, p_acao text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.eh_dono_plataforma() or exists (
    select 1 from public.membros m join public.empresas e on e.id = m.empresa_id
     where m.empresa_id = p_empresa and m.user_id = auth.uid() and m.ativo and e.ativa
       and interno.cargo_tem(m.cargo_id, p_modulo, p_acao));
$$;

alter function public.trava_empresa() set search_path = public;

revoke execute on all functions in schema interno from public, anon;
grant execute on all functions in schema interno to authenticated;
