import { redirect } from 'next/navigation';
import { usuarioAtual } from '@/lib/supabase/server';
import { Marca } from '@/app/ui';
import { FormNovaSenha } from './Form';

export default async function NovaSenha() {
  const { user } = await usuarioAtual();
  if (!user) redirect('/entrar');
  return (
    <main className="auth"><Marca /><h1>Crie uma senha nova</h1><FormNovaSenha /></main>
  );
}
