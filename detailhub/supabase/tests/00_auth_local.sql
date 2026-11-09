-- Só para testes locais: imita o que o Supabase já tem pronto (schema auth, auth.uid(), papéis).
-- Não é aplicado no Supabase de verdade.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema extensions;
grant usage on schema auth, extensions, public to anon, authenticated;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  encrypted_password text default '',
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true),
                         (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated;
