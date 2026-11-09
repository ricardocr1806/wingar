'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { mensagemErro } from '@/lib/erros';
import { enviarEmailDeAcesso } from '@/lib/acessos';

export async function aceitar(f: FormData) {
  const token = String(f.get('token') ?? '');
  const sb = await supabaseServer();
  const { data: info } = await sb.rpc('ver_convite', { p_token: token });
  const contaAtiva = (info as { conta_ativa: boolean }[] | null)?.[0]?.conta_ativa;
  const { data: empresaId, error } = await sb.rpc('aceitar_convite', { p_token: token });
  if (error) redirect(`/convite/${encodeURIComponent(token)}?erro=${encodeURIComponent(mensagemErro(error))}`);
  const { data: emp } = await sb.from('empresas').select('slug').eq('id', empresaId).maybeSingle();
  const destino = emp ? `/app/${emp.slug}` : '/app';
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
