import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { APRESENTACAO } from '@/generated/apresentacao';

// Versão de apresentação de uma empresa (ex.: wingard.detailhub.com.br). Só para quem é da empresa ou o dono.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('empresa') ?? '';
  const html = APRESENTACAO[slug];
  if (!html) return new NextResponse('Não encontrado', { status: 404 });
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/entrar?next=/', req.url));
  const { data: emp } = await sb.from('empresas').select('id').eq('slug', slug).eq('ativa', true).maybeSingle();
  if (!emp) return new NextResponse('Você não tem acesso a esta empresa.', { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' } });
}
