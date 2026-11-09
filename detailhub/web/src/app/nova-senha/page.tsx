import { redirect } from 'next/navigation';
import { usuarioAtual } from '@/lib/supabase/server';
import { Marca } from '@/app/ui';
import { FormNovaSenha } from './Form';

export default async function NovaSenha({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const { user } = await usuarioAtual();
  if (!user) redirect('/entrar');
  return (
    <main className="auth"><Marca /><h1>Crie sua senha</h1><p className="muted">Você vai usar o seu e-mail e esta senha para entrar no DetailHub.</p><FormNovaSenha next={next ?? '/app'} /></main>
  );
}
