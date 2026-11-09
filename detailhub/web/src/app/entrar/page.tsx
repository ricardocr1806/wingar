import { redirect } from 'next/navigation';
import { usuarioAtual } from '@/lib/supabase/server';
import { destinoSeguro } from '@/lib/nav';
import { Formularios } from './Formularios';
import { Marca } from '@/app/ui';

export const metadata = { title: 'Entrar · DetailHub' };

export default async function Entrar({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = destinoSeguro(sp.next);
  const { user } = await usuarioAtual();
  if (user) redirect(next);
  return (
    <main className="auth">
      <Marca />
      <h1>Gestão completa da sua estética automotiva</h1>
      <p className="muted">Da venda à entrega: comercial, pátio, laudos e financeiro num lugar só.</p>
      <Formularios next={next} erroGoogle={sp.erro === 'google'} modoInicial={sp.modo === 'cadastrar' ? 'cadastrar' : 'entrar'} />
    </main>
  );
}
