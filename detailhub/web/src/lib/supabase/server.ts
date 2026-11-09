import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { COOKIE_DOMAIN, SUPABASE_KEY, SUPABASE_URL } from './config';

/** Cliente do Supabase com a sessão de quem está acessando. Todas as regras de RLS valem. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookieOptions: COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : undefined,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (lista) => {
        try { lista.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* chamado de um Server Component: o middleware renova a sessão */ }
      },
    },
  });
}

export async function usuarioAtual() {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  return { sb, user: data.user };
}
