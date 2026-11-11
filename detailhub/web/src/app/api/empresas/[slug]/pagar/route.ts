import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { mensagemErro } from '@/lib/erros';

// Contas a pagar da empresa, salvas no banco. As regras de quem vê, lança, edita e exclui estão no próprio banco.
const erro = (msg: string, status = 400) => NextResponse.json({ erro: msg }, { status });
type Conta = { id: string; descricao: string; fornecedor: string; centro_custo: string; vencimento: string; valor: number; pago: boolean; pago_em: string | null; origem: string | null };
const paraTela = (c: Conta) => ({ id: c.id, desc: c.descricao, forn: c.fornecedor, cat: c.centro_custo, venc: c.vencimento, valor: Number(c.valor), pago: c.pago, pagoEm: c.pago_em, origem: c.origem });

function limpar(b: Record<string, unknown>) {
  const t = (k: string, max: number) => String(b[k] ?? '').trim().slice(0, max);
  const valor = Math.round(Number(b.valor) * 100) / 100;
  const venc = t('venc', 10);
  if (!t('desc', 200)) return { erro: 'Informe a descrição da conta.' };
  if (!(valor > 0)) return { erro: 'Informe o valor da conta.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(venc)) return { erro: 'Informe o vencimento.' };
  if (!t('cat', 60)) return { erro: 'Escolha o centro de custo.' };
  return { dados: { descricao: t('desc', 200), fornecedor: t('forn', 200) || '—', centro_custo: t('cat', 60), vencimento: venc, valor, pago: !!b.pago, origem: t('origem', 120) || null } };
}

async function contexto(slug: string) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { erro: erro('Entre na sua conta.', 401) };
  const { data: emp } = await sb.from('empresas').select('id').eq('slug', slug).maybeSingle();
  if (!emp) return { erro: erro('Empresa não encontrada.', 404) };
  return { sb, empresa: emp.id as string };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const c = await contexto((await params).slug);
  if ('erro' in c) return c.erro;
  const { data, error } = await c.sb.from('contas_pagar').select('*').eq('empresa_id', c.empresa).order('vencimento').limit(5000);
  if (error) return erro(mensagemErro(error), 403);
  return NextResponse.json({ contas: (data as Conta[]).map(paraTela) }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const c = await contexto((await params).slug);
  if ('erro' in c) return c.erro;
  const { sb, empresa } = c;
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const id = String(b.id ?? '');

  if (b.acao === 'criar' || b.acao === 'importar') {
    const lista = (b.acao === 'importar' ? (Array.isArray(b.contas) ? b.contas : []) : [b]) as Record<string, unknown>[];
    if (!lista.length || lista.length > 2000) return erro('Nada para salvar.');
    const linhas = [];
    for (const l of lista) { const r = limpar(l); if ('erro' in r) return erro(r.erro as string); linhas.push({ ...r.dados, empresa_id: empresa }); }
    const { data, error } = await sb.from('contas_pagar').insert(linhas).select('*');
    if (error) return erro(/row-level/.test(error.message) ? 'Seu acesso não permite lançar contas.' : mensagemErro(error), 403);
    return NextResponse.json({ contas: (data as Conta[]).map(paraTela) });
  }
  if (b.acao === 'atualizar') {
    const r = limpar(b); if ('erro' in r) return erro(r.erro as string);
    const { data, error } = await sb.from('contas_pagar').update(r.dados).match({ id, empresa_id: empresa }).select('*');
    if (error || !data?.length) return erro(error ? mensagemErro(error) : 'Seu acesso não permite editar esta conta.', 403);
    return NextResponse.json({ conta: paraTela(data[0] as Conta) });
  }
  if (b.acao === 'pagar') {
    const { data, error } = await sb.from('contas_pagar').update({ pago: !!b.pago }).match({ id, empresa_id: empresa }).select('*');
    if (error || !data?.length) return erro(error ? mensagemErro(error) : 'Seu acesso não permite alterar esta conta.', 403);
    return NextResponse.json({ conta: paraTela(data[0] as Conta) });
  }
  if (b.acao === 'excluir') {
    const { data, error } = await sb.from('contas_pagar').delete().match({ id, empresa_id: empresa }).select('id');
    if (error || !data?.length) return erro(error ? mensagemErro(error) : 'Seu acesso não permite excluir contas.', 403);
    return NextResponse.json({ ok: true });
  }
  return erro('Ação desconhecida.');
}
