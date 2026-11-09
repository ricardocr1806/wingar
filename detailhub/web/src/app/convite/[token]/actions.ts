'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { mensagemErro } from '@/lib/erros';

export async function aceitar(f: FormData) {
  const token = String(f.get('token') ?? '');
  const sb = await supabaseServer();
  const { data: empresaId, error } = await sb.rpc('aceitar_convite', { p_token: token });
  if (error) redirect(`/convite/${encodeURIComponent(token)}?erro=${encodeURIComponent(mensagemErro(error))}`);
  const { data: emp } = await sb.from('empresas').select('slug').eq('id', empresaId).maybeSingle();
  redirect(emp ? `/app/${emp.slug}` : '/app');
}
