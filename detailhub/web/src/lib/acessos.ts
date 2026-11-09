import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SITE_URL, SUPABASE_KEY, SUPABASE_URL } from './supabase/config';

/**
 * Manda para a pessoa o e-mail de acesso ("entre na empresa X"). Usa o envio de link do próprio login do
 * Supabase (que sai pelo Resend), num cliente separado, sem a sessão de quem está adicionando.
 * O link volta para /convite/<código>, onde a pessoa entra na empresa e cria a senha.
 */
export async function enviarEmailDeAcesso(email: string, nome: string, token: string): Promise<string | null> {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${SITE_URL}/convite/${token}`, data: nome ? { full_name: nome } : undefined },
  });
  if (!error) return null;
  if (/rate|seconds|security purposes/i.test(error.message)) return 'O e-mail não foi enviado agora porque acabou de sair um para essa pessoa. Espere um minuto ou mande o link pelo WhatsApp.';
  return 'O e-mail não pôde ser enviado agora. Mande o link pelo WhatsApp.';
}

export const linkDoConvite = (token: string) => `${SITE_URL}/convite/${token}`;
