-- Configurações salvas por assunto: metas (Comercial), padrões de planilha (Financeiro), equipe e tempos (Operacional).
create or replace function interno.pode_registro(p_empresa uuid, p_colecao text, p_id text, p_acao text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_colecao = 'config' and p_id = 'metas' then
      public.tem_permissao(p_empresa, 'comercial', p_acao)
      or (p_acao = 'ver' and (public.tem_permissao(p_empresa, 'operacional', 'ver') or public.tem_permissao(p_empresa, 'financeiro', 'ver')))
    when p_colecao = 'config' and p_id = 'modelos_pagar' then public.tem_permissao(p_empresa, 'financeiro', p_acao)
    else interno.pode_registro(p_empresa, p_colecao, p_acao)
  end;
$$;
revoke execute on function interno.pode_registro(uuid, text, text, text) from public, anon;
grant execute on function interno.pode_registro(uuid, text, text, text) to authenticated;

drop policy reg_ler on public.registros;
drop policy reg_criar on public.registros;
drop policy reg_alterar on public.registros;
create policy reg_ler     on public.registros for select to authenticated using (interno.pode_registro(empresa_id, colecao, id, 'ver'));
create policy reg_criar   on public.registros for insert to authenticated with check (interno.pode_registro(empresa_id, colecao, id, 'editar'));
create policy reg_alterar on public.registros for update to authenticated
  using (interno.pode_registro(empresa_id, colecao, id, 'editar')) with check (interno.pode_registro(empresa_id, colecao, id, 'editar'));
