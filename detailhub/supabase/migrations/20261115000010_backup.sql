-- Cópia completa do banco para o backup diário (feito por um Worker do Cloudflare e guardado no R2).
-- Pega todas as tabelas do schema public (inclusive as que forem criadas no futuro) e as contas de acesso.
-- Só a chave de serviço (service_role) pode chamar: nenhum usuário do sistema consegue.
create or replace function public.backup_completo()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t record; parte jsonb; tabelas jsonb := '{}'::jsonb;
begin
  for t in select tablename from pg_tables where schemaname = 'public' order by tablename loop
    execute format('select coalesce(jsonb_agg(x), ''[]''::jsonb) from public.%I x', t.tablename) into parte;
    tabelas := tabelas || jsonb_build_object(t.tablename, parte);
  end loop;
  return jsonb_build_object(
    'formato', 'detailhub-backup-1',
    'gerado_em', now(),
    'tabelas', tabelas,
    'usuarios', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', u.id, 'email', u.email, 'encrypted_password', u.encrypted_password,
        'email_confirmed_at', u.email_confirmed_at, 'raw_user_meta_data', u.raw_user_meta_data)), '[]'::jsonb)
      from auth.users u));
end $$;
revoke all on function public.backup_completo() from public, anon, authenticated;
grant execute on function public.backup_completo() to service_role;
