'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/supabase/config';
import { mensagemErro } from '@/lib/erros';

const txt = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const voltar = (slug: string, erro?: string): never =>
  redirect(`/app/${slug}/equipe${erro ? `?erro=${encodeURIComponent(erro)}` : ''}`);

export async function alternarPermissao(f: FormData) {
  const slug = txt(f, 'slug'), cargo = txt(f, 'cargo_id'), empresa = txt(f, 'empresa_id'), modulo = txt(f, 'modulo'), acao = txt(f, 'acao');
  const sb = await supabaseServer();
  if (txt(f, 'ligar') === '1') {
    const { error } = await sb.from('cargo_permissoes').insert({ cargo_id: cargo, empresa_id: empresa, modulo, acao });
    if (error) voltar(slug, mensagemErro(error));
  } else {
    const { data, error } = await sb.from('cargo_permissoes').delete()
      .match({ cargo_id: cargo, modulo, acao }).select('cargo_id');
    if (error || !data?.length) voltar(slug, error ? mensagemErro(error) : 'Você não tem permissão para tirar essa permissão.');
  }
  revalidatePath(`/app/${slug}`, 'layout');
  voltar(slug);
}

export async function criarCargo(f: FormData) {
  const slug = txt(f, 'slug');
  const sb = await supabaseServer();
  const { error } = await sb.from('cargos').insert({
    empresa_id: txt(f, 'empresa_id'), nome: txt(f, 'nome'),
    nivel: txt(f, 'nivel') === 'admin_area' ? 'admin_area' : 'equipe', pai_id: txt(f, 'pai_id'),
  });
  if (error) voltar(slug, error.code === '23514' ? 'O nome do cargo precisa ter entre 2 e 60 letras.' : mensagemErro(error));
  revalidatePath(`/app/${slug}/equipe`);
  voltar(slug);
}

export async function excluirCargo(f: FormData) {
  const slug = txt(f, 'slug');
  const sb = await supabaseServer();
  const { data, error } = await sb.from('cargos').delete().eq('id', txt(f, 'cargo_id')).select('id');
  if (error) voltar(slug, /foreign key|23503/.test(error.message) ? 'Esse cargo tem pessoas ou outros cargos ligados a ele. Mude-os de cargo antes de excluir.' : mensagemErro(error));
  if (!data?.length) voltar(slug, 'Você não tem permissão para excluir esse cargo.');
  revalidatePath(`/app/${slug}/equipe`);
  voltar(slug);
}

export async function salvarMembro(f: FormData) {
  const slug = txt(f, 'slug');
  const sb = await supabaseServer();
  const { data, error } = await sb.from('membros')
    .update({ cargo_id: txt(f, 'cargo_id'), escopo: txt(f, 'escopo') === 'proprios' ? 'proprios' : 'todos', ativo: txt(f, 'ativo') !== '0' })
    .match({ empresa_id: txt(f, 'empresa_id'), user_id: txt(f, 'user_id') }).select('user_id');
  if (error) voltar(slug, mensagemErro(error));
  if (!data?.length) voltar(slug, 'Você não pode mudar o cargo dessa pessoa (ou o seu próprio).');
  revalidatePath(`/app/${slug}/equipe`);
  voltar(slug);
}

export type EstadoConvite = { erro?: string; link?: string; email?: string };
export async function convidar(_: EstadoConvite, f: FormData): Promise<EstadoConvite> {
  const email = txt(f, 'email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: 'Informe um e-mail válido.' };
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('criar_convite', {
    p_empresa: txt(f, 'empresa_id'), p_email: email, p_cargo: txt(f, 'cargo_id'),
    p_escopo: txt(f, 'escopo') === 'proprios' ? 'proprios' : 'todos',
  });
  if (error) return { erro: /row-level/.test(error.message) ? 'Você não pode convidar alguém para esse cargo: ele tem permissões que você não tem.' : mensagemErro(error) };
  revalidatePath(`/app/${txt(f, 'slug')}/equipe`);
  return { link: `${SITE_URL}/convite/${data}`, email };
}
