import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { destinoSeguro } from '@/lib/nav';

// Volta do e-mail de confirmação, da recuperação de senha e do login com Google.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = destinoSeguro(url.searchParams.get('next'));
  if (code) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL('/entrar?erro=link', url.origin));
}
