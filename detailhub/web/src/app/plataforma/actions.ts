'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { mensagemErro } from '@/lib/erros';

const txt = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const slugDe = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export async function criarEmpresa(f: FormData) {
  const nome = txt(f, 'nome');
  const slug = slugDe(txt(f, 'slug') || nome);
  if (nome.length < 2 || !slug) redirect(`/plataforma?erro=${encodeURIComponent('Informe o nome da empresa.')}`);
  const sb = await supabaseServer();
  const { data: id, error } = await sb.rpc('criar_empresa', { p_nome: nome, p_slug: slug });
  if (error) redirect(`/plataforma?erro=${encodeURIComponent(error.code === '23505' ? `O endereço "${slug}" já está em uso. Escolha outro.` : mensagemErro(error))}`);
  revalidatePath('/plataforma');
  redirect(`/plataforma/empresas/${id}?ok=${encodeURIComponent(`Empresa ${nome} criada. Agora adicione o administrador e a equipe.`)}`);
}

export async function alternarAtiva(f: FormData) {
  const id = txt(f, 'empresa_id');
  const sb = await supabaseServer();
  const { error } = await sb.from('empresas').update({ ativa: txt(f, 'ativa') === '1' }).eq('id', id);
  revalidatePath('/plataforma', 'layout');
  redirect(`/plataforma/empresas/${id}?${error ? 'erro=' + encodeURIComponent(mensagemErro(error)) : 'ok=' + encodeURIComponent(txt(f, 'ativa') === '1' ? 'Empresa reativada.' : 'Empresa desativada: a equipe dela perdeu o acesso.')}`);
}

export async function alternarTeto(f: FormData) {
  const id = txt(f, 'empresa_id');
  const sb = await supabaseServer();
  const base = { empresa_id: id, modulo: txt(f, 'modulo'), acao: txt(f, 'acao') };
  const { error } = txt(f, 'ligar') === '1' ? await sb.from('empresa_teto').insert(base) : await sb.from('empresa_teto').delete().match(base);
  revalidatePath(`/plataforma/empresas/${id}`);
  redirect(`/plataforma/empresas/${id}${error ? '?erro=' + encodeURIComponent(mensagemErro(error)) : ''}#modulos`);
}
