'use server';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { mensagemErro } from '@/lib/erros';
import { enviarEmailDeAcesso, linkDoConvite } from '@/lib/acessos';

export type EstadoAcesso = { erro?: string; link?: string; email?: string; nome?: string; aviso?: string; enviado?: boolean };
const txt = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

/** Adiciona uma pessoa à empresa: cria o acesso (convite) e manda o e-mail. As regras de quem pode fazer isso estão no banco. */
export async function adicionarUsuario(_: EstadoAcesso, f: FormData): Promise<EstadoAcesso> {
  const nome = txt(f, 'nome'), email = txt(f, 'email').toLowerCase();
  if (nome.length < 2) return { erro: 'Informe o nome da pessoa.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: 'Informe um e-mail válido.' };
  const sb = await supabaseServer();
  const { data: token, error } = await sb.rpc('criar_convite', {
    p_empresa: txt(f, 'empresa_id'), p_email: email, p_cargo: txt(f, 'cargo_id'),
    p_escopo: txt(f, 'escopo') === 'proprios' ? 'proprios' : 'todos', p_nome: nome,
  });
  if (error || !token) return { erro: /row-level/.test(error?.message ?? '') ? 'Você não pode dar esse cargo: ele tem permissões que você não tem.' : mensagemErro(error) };
  const aviso = f.get('enviar') ? await enviarEmailDeAcesso(email, nome, token as string) : null;
  revalidatePath(txt(f, 'volta') || '/plataforma');
  return { link: linkDoConvite(token as string), email, nome, aviso: aviso ?? undefined, enviado: !!f.get('enviar') && !aviso };
}

/** Muda cargo, visão (todos/próprios) ou bloqueia o acesso de alguém. */
export async function salvarUsuario(f: FormData) {
  const sb = await supabaseServer();
  const { data, error } = await sb.from('membros')
    .update({ cargo_id: txt(f, 'cargo_id'), escopo: txt(f, 'escopo') === 'proprios' ? 'proprios' : 'todos', ativo: txt(f, 'ativo') !== '0' })
    .match({ empresa_id: txt(f, 'empresa_id'), user_id: txt(f, 'user_id') }).select('user_id');
  const volta = txt(f, 'volta') || '/plataforma';
  revalidatePath(volta);
  const { redirect } = await import('next/navigation');
  if (error || !data?.length) redirect(`${volta}?erro=${encodeURIComponent(error ? mensagemErro(error) : 'Você não pode mudar o acesso dessa pessoa.')}`);
  redirect(`${volta}?ok=${encodeURIComponent('Acesso atualizado.')}`);
}

/** Cancela um acesso que ainda não foi usado. */
export async function cancelarAcesso(f: FormData) {
  const sb = await supabaseServer();
  await sb.from('convites').delete().eq('id', txt(f, 'convite_id'));
  const volta = txt(f, 'volta') || '/plataforma';
  revalidatePath(volta);
  const { redirect } = await import('next/navigation');
  redirect(volta);
}
