import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { mensagemErro } from '@/lib/erros';
import { enviarEmailDeAcesso, linkDoConvite } from '@/lib/acessos';

// Dados e ações da tela Configurações que fica dentro do sistema da empresa.
// Tudo roda com a sessão de quem está logado: as regras do banco decidem o que pode.
const DESCRICAO: Record<string, string> = {
  Administrador: 'Vê tudo e gerencia os colaboradores',
  Financeiro: 'Vê Comercial, Operacional e Financeiro',
  Comercial: 'Vê só o Comercial',
  Operacional: 'Vê só o Operacional',
};
const erro = (msg: string, status = 400) => NextResponse.json({ erro: msg }, { status });

async function contexto(slug: string) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { sb, falha: erro('Entre na sua conta.', 401) };
  const { data: emp } = await sb.from('empresas').select('id, nome').eq('slug', slug).maybeSingle();
  if (!emp) return { sb, falha: erro('Empresa não encontrada.', 404) };
  const { data: pode } = await sb.rpc('tem_permissao', { p_empresa: emp.id, p_modulo: 'equipe', p_acao: 'editar' });
  if (!pode) return { sb, falha: erro('Só o administrador acessa as Configurações.', 403) };
  const { data: dono } = await sb.rpc('eh_dono_plataforma');
  return { sb, user, emp, dono: !!dono };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await contexto(slug);
  if ('falha' in c && c.falha) return c.falha;
  const { sb, user, emp, dono } = c as Required<typeof c>;
  const [{ data: us }, { data: cargos }, { data: vagas }, { data: conv }] = await Promise.all([
    sb.rpc('usuarios_da_empresa', { p_empresa: emp.id }),
    sb.from('cargos').select('id, nome, nivel').eq('empresa_id', emp.id).order('criado_em'),
    sb.rpc('vagas_da_empresa', { p_empresa: emp.id }),
    sb.from('convites').select('id, nome, email, cargo_id, expira_em').eq('empresa_id', emp.id).is('aceito_em', null).gt('expira_em', new Date().toISOString()).order('criado_em', { ascending: false }),
  ]);
  const v = ((vagas ?? []) as { limite: number; usados: number; livres: number }[])[0] ?? { limite: 5, usados: 0, livres: 5 };
  const nomeCargo = new Map((cargos ?? []).map((x) => [x.id, x.nome]));
  return NextResponse.json({
    empresa: emp.nome, dono, limite: v.limite, usados: v.usados, livres: v.livres,
    areas: (cargos ?? []).map((x) => ({ id: x.id, nome: x.nome, admin: x.nivel === 'admin_empresa', descricao: DESCRICAO[x.nome] ?? 'Permissões personalizadas' })),
    pessoas: ((us ?? []) as { user_id: string; nome: string | null; email: string; cargo_id: string; cargo: string; nivel: string; ativo: boolean; ultimo_acesso: string | null }[])
      .map((u) => ({ ...u, eu: u.user_id === user.id, admin: u.nivel === 'admin_empresa' })),
    pendentes: (conv ?? []).map((x) => ({ id: x.id, nome: x.nome, email: x.email, area: nomeCargo.get(x.cargo_id) ?? '' })),
  }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await contexto(slug);
  if ('falha' in c && c.falha) return c.falha;
  const { sb, emp } = c as Required<typeof c>;
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const s = (k: string) => String(b[k] ?? '').trim();

  if (b.acao === 'adicionar') {
    const nome = s('nome'), email = s('email').toLowerCase();
    if (nome.length < 2) return erro('Informe o nome do colaborador.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return erro('Informe um e-mail válido.');
    const { data: token, error } = await sb.rpc('criar_convite', { p_empresa: emp.id, p_email: email, p_cargo: s('cargo_id'), p_escopo: 'todos', p_nome: nome });
    if (error || !token) return erro(/row-level/.test(error?.message ?? '') ? 'Você não pode dar essa área para alguém.' : mensagemErro(error));
    const aviso = b.enviar ? await enviarEmailDeAcesso(email, nome, token as string) : null;
    return NextResponse.json({ link: linkDoConvite(token as string), email, nome, enviado: !!b.enviar && !aviso, aviso });
  }
  if (b.acao === 'salvar') {
    const { data, error } = await sb.from('membros').update({ cargo_id: s('cargo_id'), ativo: b.ativo !== false })
      .match({ empresa_id: emp.id, user_id: s('user_id') }).select('user_id');
    if (error) return erro(mensagemErro(error));
    if (!data?.length) return erro('Você não pode mudar o acesso dessa pessoa.', 403);
    return NextResponse.json({ ok: true });
  }
  if (b.acao === 'cancelar') {
    const { data } = await sb.from('convites').delete().match({ id: s('convite_id'), empresa_id: emp.id }).select('id');
    if (!data?.length) return erro('Não foi possível cancelar esse acesso.', 403);
    return NextResponse.json({ ok: true });
  }
  return erro('Ação desconhecida.');
}
