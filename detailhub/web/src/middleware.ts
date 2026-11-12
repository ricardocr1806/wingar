import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_DOMAIN, SUPABASE_KEY, SUPABASE_URL } from './lib/supabase/config';

const PROTEGIDAS = ['/app', '/plataforma'];

export async function middleware(req: NextRequest) {
  // As rotas /api conferem a sessão por conta própria: pular aqui deixa cada pedido mais leve.
  if (req.nextUrl.pathname.startsWith('/api/')) return NextResponse.next();
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookieOptions: COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : undefined,
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        lista.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await sb.auth.getUser();
  const p = req.nextUrl.pathname;
  // Endereço próprio da empresa (ex.: wingard.detailhub.com.br): a página inicial é a versão de apresentação dela.
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const sub = host.endsWith('.detailhub.com.br') ? host.slice(0, -'.detailhub.com.br'.length) : '';
  if (sub && sub !== 'www' && p === '/') {
    if (!data.user) {
      const url = req.nextUrl.clone(); url.pathname = '/entrar'; url.search = '?next=/';
      return NextResponse.redirect(url);
    }
    // o slug vai no caminho: a reescrita no Cloudflare perde a query string
    const url = req.nextUrl.clone(); url.pathname = `/apresentacao/${encodeURIComponent(sub)}`; url.search = '';
    return NextResponse.rewrite(url, { headers: res.headers });
  }
  if (!data.user && PROTEGIDAS.some((x) => p === x || p.startsWith(x + '/'))) {
    const url = req.nextUrl.clone();
    url.pathname = '/entrar';
    url.search = `?next=${encodeURIComponent(p + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
};
