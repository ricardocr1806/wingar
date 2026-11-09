import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { usuarioAtual } from '@/lib/supabase/server';
import { chave } from '@/lib/acesso';

/** Empresa pelo endereço + permissões efetivas de quem está acessando. RLS garante que só membros a encontram. */
export const empresaDoUsuario = cache(async (slug: string) => {
  const { sb, user } = await usuarioAtual();
  if (!user) redirect('/entrar');
  const { data: emp } = await sb.from('empresas').select('id, nome, slug, ativa').eq('slug', slug).maybeSingle();
  if (!emp) notFound();
  const { data: perms } = await sb.rpc('minhas_permissoes', { p_empresa: emp.id });
  const pode = new Set((perms ?? []).map((p: { modulo: string; acao: string }) => chave(p.modulo, p.acao)));
  return { sb, user, emp, pode };
});
