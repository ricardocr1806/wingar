import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { APRESENTACAO } from '@/generated/apresentacao';

// Sistema da empresa (ex.: wingard.detailhub.com.br) para quem é da empresa ou para o dono.
// Mostra só as áreas que o cargo da pessoa libera; o administrador vê o atalho de Configurações.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('empresa') ?? '';
  const html = APRESENTACAO[slug];
  if (!html) return new NextResponse('Não encontrado', { status: 404 });
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(`/entrar?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`, req.url));
  const { data: emp } = await sb.from('empresas').select('id').eq('slug', slug).eq('ativa', true).maybeSingle();
  if (!emp) return new NextResponse('Você não tem acesso a esta empresa.', { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  const [{ data: perms }, { data: dono }, { data: m }] = await Promise.all([
    sb.rpc('minhas_permissoes', { p_empresa: emp.id }),
    sb.rpc('eh_dono_plataforma'),
    sb.from('membros').select('cargos(nome)').eq('empresa_id', emp.id).eq('user_id', user.id).maybeSingle(),
  ]);
  const pode = new Set(((perms ?? []) as { modulo: string; acao: string }[]).map((p) => `${p.modulo}:${p.acao}`));
  const acesso = {
    modulos: ['comercial', 'operacional', 'financeiro'].filter((k) => pode.has(`${k}:ver`)),
    admin: pode.has('equipe:editar'),
    nome: String(user.user_metadata?.full_name || user.email || ''),
    cargo: dono ? 'Administrador total' : String((m?.cargos as unknown as { nome?: string } | null)?.nome ?? ''),
    configurar: pode.has('equipe:editar') ? `/app/${slug}/configuracoes` : '',
  };
  if (!acesso.modulos.length) return new NextResponse('Seu acesso ainda não tem nenhuma área liberada. Fale com o administrador da empresa.', { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const pagina = html.replace('<!--DH_ACESSO-->', `<script>window.DH_ACESSO=${JSON.stringify(acesso).replace(/</g, '\\u003c')}</script>`);
  return new NextResponse(pagina, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' } });
}
