'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { mensagemErro } from '@/lib/erros';
import { enviarEmailDeAcesso } from '@/lib/acessos';
import { SITE_URL } from '@/lib/supabase/config';
import { inicioDaEmpresa } from '@/lib/nav';
import { APRESENTACAO } from '@/generated/apresentacao';

export async function aceitar(f: FormData) {
  const token = String(f.get('token') ?? '');
  const sb = await supabaseServer();
  const { data: info } = await sb.rpc('ver_convite', { p_token: token });
  const i0 = (info as { conta_ativa: boolean; email: string | null }[] | null)?.[0];
  const contaAtiva = !i0?.email || i0?.conta_ativa;
  const { data: empresaId, error } = await sb.rpc('aceitar_convite', { p_token: token });
  if (error) redirect(`/convite/${encodeURIComponent(token)}?erro=${encodeURIComponent(mensagemErro(error))}`);
  const { data: emp } = await sb.from('empresas').select('slug').eq('id', empresaId).maybeSingle();
  const destino = emp ? inicioDaEmpresa(emp.slug, !!APRESENTACAO[emp.slug]) : '/app';
  // Primeira vez no sistema: cria a senha antes de continuar
  redirect(contaAtiva ? destino : `/nova-senha?next=${encodeURIComponent(destino)}`);
}

export async function reenviarLink(f: FormData) {
  const token = String(f.get('token') ?? '');
  const sb = await supabaseServer();
  const { data } = await sb.rpc('ver_convite', { p_token: token });
  const c = (data as { email: string; expirado: boolean; usado: boolean }[] | null)?.[0];
  if (!c || c.expirado || c.usado) redirect(`/convite/${encodeURIComponent(token)}`);
  const aviso = await enviarEmailDeAcesso(c.email, '', token);
  redirect(`/convite/${encodeURIComponent(token)}?${aviso ? 'erro=' + encodeURIComponent(aviso) : 'enviado=1'}`);
}

export type EstadoCriar = { erro?: string; ok?: boolean; email?: string };

/** Link aberto do administrador: a pessoa cria a conta ali mesmo; depois de confirmar o e-mail, entra direto na empresa. */
export async function criarAcessoPeloConvite(_: EstadoCriar, f: FormData): Promise<EstadoCriar> {
  const token = String(f.get('token') ?? '');
  const nome = String(f.get('nome') ?? '').trim();
  const email = String(f.get('email') ?? '').trim().toLowerCase();
  const senha = String(f.get('senha') ?? '');
  if (nome.length < 2) return { erro: 'Informe seu nome.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: 'Informe um e-mail válido.' };
  if (senha.length < 8 || !/[a-zA-Z]/.test(senha) || !/\d/.test(senha)) return { erro: 'A senha precisa ter pelo menos 8 caracteres, com letras e números.' };
  const sb = await supabaseServer();
  const { data: info } = await sb.rpc('ver_convite', { p_token: token });
  const c = (info as { usado: boolean; expirado: boolean }[] | null)?.[0];
  if (!c || c.usado || c.expirado) return { erro: 'Este link não está mais valendo. Peça um novo.' };
  const voltar = `/convite/${token}?auto=1`;
  const { data, error } = await sb.auth.signUp({
    email, password: senha,
    options: { data: { full_name: nome }, emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(voltar)}` },
  });
  if (error) return { erro: mensagemErro(error) };
  if (data.user && !data.user.identities?.length) return { erro: 'Esse e-mail já tem conta no DetailHub. Use "Já tenho conta" logo abaixo.' };
  if (data.session) redirect(voltar);
  return { ok: true, email };
}
