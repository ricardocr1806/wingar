import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { paginaDaEmpresa, temSistema } from '@/lib/pagina-empresa';

// Link que o dono manda para o cliente ver a plataforma sem login. Vence e pode ser desativado no painel.
export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = await supabaseServer();
  const { data: slug } = await sb.rpc('abrir_link_visualizacao', { p_token: token });
  const html = typeof slug === 'string' && temSistema(slug) ? paginaDaEmpresa(slug, slug.replace(/-/g, ' ').replace(/\b\p{L}/gu, (c) => c.toUpperCase())) : undefined;
  if (!html) return new NextResponse(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link indisponível · DetailHub</title><body style="font:16px system-ui;background:#0E1117;color:#E9ECF2;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px;text-align:center"><div><h1 style="font-size:22px">Este link não está mais disponível</h1><p style="color:#A3ABBB">Ele venceu ou foi desativado. Peça um novo para quem te enviou.</p></div>',
    { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' } });
  const ADMIN_VITRINE: Record<string, { nome: string; cargo: string }> = { wingard: { nome: 'Weslen', cargo: 'Administrador' } };
  const vitrine = ADMIN_VITRINE[slug as string] ?? { nome: 'Administrador', cargo: 'Administrador' };
  const pagina = html.replace('<!--DH_ACESSO-->', `<script>window.DH_VITRINE=${JSON.stringify(vitrine).replace(/</g, '\\u003c')}</script>`);
  return new NextResponse(pagina, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex', 'referrer-policy': 'no-referrer' } });
}
