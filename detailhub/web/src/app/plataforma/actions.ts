'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/supabase/config';
import { mensagemErro } from '@/lib/erros';
import type { EstadoConvite } from '@/app/app/[slug]/equipe/actions';

const txt = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const voltar = (msg?: { erro?: string; ok?: string }): never => {
  const q = msg?.erro ? `?erro=${encodeURIComponent(msg.erro)}` : msg?.ok ? `?ok=${encodeURIComponent(msg.ok)}` : '';
  redirect(`/plataforma${q}`);
};
const slugDe = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export async function criarEmpresa(f: FormData) {
  const nome = txt(f, 'nome');
  const slug = slugDe(txt(f, 'slug') || nome);
  if (nome.length < 2 || !slug) voltar({ erro: 'Informe o nome da empresa.' });
  const sb = await supabaseServer();
  const { error } = await sb.rpc('criar_empresa', { p_nome: nome, p_slug: slug });
  if (error) voltar({ erro: error.code === '23505' ? `O endereço "${slug}" já está em uso. Escolha outro.` : mensagemErro(error) });
  revalidatePath('/plataforma');
  voltar({ ok: `Empresa ${nome} criada. Agora convide o administrador dela.` });
}

export async function alternarAtiva(f: FormData) {
  const sb = await supabaseServer();
  const { error } = await sb.from('empresas').update({ ativa: txt(f, 'ativa') === '1' }).eq('id', txt(f, 'empresa_id'));
  if (error) voltar({ erro: mensagemErro(error) });
  revalidatePath('/plataforma');
  voltar();
}

export async function alternarTeto(f: FormData) {
  const sb = await supabaseServer();
  const base = { empresa_id: txt(f, 'empresa_id'), modulo: txt(f, 'modulo'), acao: txt(f, 'acao') };
  const { error } = txt(f, 'ligar') === '1'
    ? await sb.from('empresa_teto').insert(base)
    : await sb.from('empresa_teto').delete().match(base);
  if (error) voltar({ erro: mensagemErro(error) });
  revalidatePath('/plataforma');
  voltar();
}

export async function convidarAdmin(_: EstadoConvite, f: FormData): Promise<EstadoConvite> {
  const email = txt(f, 'email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: 'Informe um e-mail válido.' };
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('criar_convite', { p_empresa: txt(f, 'empresa_id'), p_email: email, p_cargo: txt(f, 'cargo_id') });
  if (error) return { erro: mensagemErro(error) };
  return { link: `${SITE_URL}/convite/${data}`, email };
}
