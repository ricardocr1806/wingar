'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/supabase/config';
import { mensagemErro } from '@/lib/erros';
import { destinoSeguro } from '@/lib/nav';

export type Estado = { erro?: string; ok?: string };

const senhaForte = (s: string) => s.length >= 8 && /[a-zA-Z]/.test(s) && /\d/.test(s);

export async function entrar(_: Estado, f: FormData): Promise<Estado> {
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({
    email: String(f.get('email') ?? '').trim().toLowerCase(),
    password: String(f.get('senha') ?? ''),
  });
  if (error) return { erro: mensagemErro(error) };
  redirect(destinoSeguro(f.get('next')));
}

export async function cadastrar(_: Estado, f: FormData): Promise<Estado> {
  const nome = String(f.get('nome') ?? '').trim();
  const email = String(f.get('email') ?? '').trim().toLowerCase();
  const senha = String(f.get('senha') ?? '');
  if (nome.length < 2) return { erro: 'Informe seu nome.' };
  if (!senhaForte(senha)) return { erro: 'A senha precisa ter pelo menos 8 caracteres, com letras e números.' };
  const sb = await supabaseServer();
  const next = destinoSeguro(f.get('next'));
  const { error } = await sb.auth.signUp({
    email, password: senha,
    options: { data: { full_name: nome }, emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { erro: mensagemErro(error) };
  return { ok: `Enviamos um link de confirmação para ${email}. Abra o e-mail para ativar a conta.` };
}

export async function recuperar(_: Estado, f: FormData): Promise<Estado> {
  const email = String(f.get('email') ?? '').trim().toLowerCase();
  if (!email.includes('@')) return { erro: 'Informe o e-mail da sua conta.' };
  const sb = await supabaseServer();
  await sb.auth.resetPasswordForEmail(email, { redirectTo: `${SITE_URL}/auth/callback?next=/nova-senha` });
  // Mesma resposta exista ou não a conta, para não revelar quais e-mails estão cadastrados.
  return { ok: 'Se esse e-mail tiver conta, você vai receber um link para criar uma senha nova.' };
}

export async function entrarComGoogle(f: FormData) {
  const sb = await supabaseServer();
  const next = destinoSeguro(f.get('next'));
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect(`/entrar?erro=google&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}

export async function definirSenha(_: Estado, f: FormData): Promise<Estado> {
  const senha = String(f.get('senha') ?? '');
  if (!senhaForte(senha)) return { erro: 'A senha precisa ter pelo menos 8 caracteres, com letras e números.' };
  if (senha !== String(f.get('confirmar') ?? '')) return { erro: 'As duas senhas não são iguais.' };
  const sb = await supabaseServer();
  const { error } = await sb.auth.updateUser({ password: senha });
  if (error) return { erro: mensagemErro(error) };
  redirect(destinoSeguro(f.get('next')));
}
