'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { mensagemErro } from '@/lib/erros';
import { enderecoDaEmpresa } from '@/lib/nav';

export type EstadoLink = { erro?: string; link?: string };
const txt = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function gerarLinkVer(_: EstadoLink, f: FormData): Promise<EstadoLink> {
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('criar_link_visualizacao', { p_empresa: txt(f, 'empresa_id'), p_dias: Number(txt(f, 'dias')) || 7 });
  if (error || !data) return { erro: mensagemErro(error) };
  revalidatePath(`/plataforma/empresas/${txt(f, 'empresa_id')}`);
  return { link: `${enderecoDaEmpresa(txt(f, 'slug'))}/ver/${data}` };
}

export async function gerarConviteAdmin(_: EstadoLink, f: FormData): Promise<EstadoLink> {
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('criar_convite', { p_empresa: txt(f, 'empresa_id'), p_email: null, p_cargo: txt(f, 'cargo_id') });
  if (error || !data) return { erro: mensagemErro(error) };
  revalidatePath(`/plataforma/empresas/${txt(f, 'empresa_id')}`);
  return { link: `${enderecoDaEmpresa(txt(f, 'slug'))}/convite/${data}` };
}

export async function desativarLinkVer(f: FormData) {
  const sb = await supabaseServer();
  await sb.from('links_visualizacao').update({ ativo: false }).eq('id', txt(f, 'link_id'));
  const id = txt(f, 'empresa_id');
  revalidatePath(`/plataforma/empresas/${id}`);
  redirect(`/plataforma/empresas/${id}?ok=${encodeURIComponent('Link desativado. Quem tiver esse link não consegue mais abrir.')}#links`);
}
