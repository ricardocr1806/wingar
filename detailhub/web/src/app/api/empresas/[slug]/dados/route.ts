import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { mensagemErro } from '@/lib/erros';
import { VERSAO } from '@/generated/apresentacao';

// Tudo o que a equipe lança no sistema da empresa (atendimentos, clientes, catálogo, equipe, tempos).
// Quem pode ver e alterar cada parte está nas regras do próprio banco.
const COLECOES = new Set(['atendimentos', 'clientes', 'catalogo', 'config']);
const LOTE = 2000;
const erro = (msg: string, status = 400) => NextResponse.json({ erro: msg, versao: VERSAO }, { status, headers: { 'cache-control': 'no-store' } });

async function contexto(slug: string) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { erro: erro('Entre na sua conta.', 401) };
  const { data: emp } = await sb.from('empresas').select('id').eq('slug', slug).maybeSingle();
  if (!emp) return { erro: erro('Empresa não encontrada.', 404) };
  return { sb, empresa: emp.id as string, user: user.id };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const c = await contexto((await params).slug);
  if ('erro' in c) return c.erro;
  const desde = req.nextUrl.searchParams.get('desde');
  let q = c.sb.from('registros').select('colecao, id, dados, excluido, atualizado_em, atualizado_por')
    .eq('empresa_id', c.empresa).order('atualizado_em').limit(LOTE);
  if (desde && !Number.isNaN(Date.parse(desde))) q = q.gt('atualizado_em', desde);
  const { data, error } = await q;
  if (error) return erro(mensagemErro(error), 403);
  const registros = (data ?? []).map((r) => ({ ...r, meu: r.atualizado_por === c.user, atualizado_por: undefined }));
  return NextResponse.json({ versao: VERSAO, registros, mais: registros.length === LOTE }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const c = await contexto((await params).slug);
  if ('erro' in c) return c.erro;
  const b = await req.json().catch(() => ({})) as { mudancas?: unknown };
  const lista = Array.isArray(b.mudancas) ? b.mudancas : [];
  if (!lista.length || lista.length > 500) return erro('Nada para salvar.');
  const linhas = [];
  for (const m of lista as Record<string, unknown>[]) {
    const colecao = String(m?.colecao ?? ''), id = String(m?.id ?? '');
    if (!COLECOES.has(colecao) || !id || id.length > 80) return erro('Registro inválido.');
    const excluido = m.excluido === true;
    if (!excluido && (m.dados === null || typeof m.dados !== 'object')) return erro('Registro inválido.');
    linhas.push({ empresa_id: c.empresa, colecao, id, excluido, dados: excluido ? null : m.dados });
  }
  const { error } = await c.sb.from('registros').upsert(linhas, { onConflict: 'empresa_id,colecao,id' });
  if (error) return erro(mensagemErro(error), 403);
  return NextResponse.json({ ok: true, versao: VERSAO }, { headers: { 'cache-control': 'no-store' } });
}
