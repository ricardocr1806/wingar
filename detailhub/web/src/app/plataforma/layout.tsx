import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { usuarioAtual } from '@/lib/supabase/server';
import { Marca } from '@/app/ui';

export const metadata = { title: 'Painel administrativo · DetailHub' };

export default async function CascaPlataforma({ children }: { children: React.ReactNode }) {
  const { sb, user } = await usuarioAtual();
  if (!user) redirect('/entrar?next=/plataforma');
  const { data: dono } = await sb.rpc('eh_dono_plataforma');
  if (!dono) notFound();
  const nome = String(user.user_metadata?.full_name ?? user.email ?? '');
  return (
    <div className="casca">
      <aside className="lado">
        <Marca href="/plataforma" />
        <div className="emp">Painel administrativo<b>Dono da plataforma</b></div>
        <nav aria-label="Painel">
          <Link href="/plataforma"><i style={{ background: 'var(--acc)' }} />Visão geral</Link>
          <Link href="/plataforma#empresas"><i style={{ background: 'var(--com)' }} />Empresas</Link>
          <Link href="/plataforma#nova"><i style={{ background: 'var(--fin)' }} />Nova empresa</Link>
        </nav>
        <form action="/sair" method="post">
          <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{nome}</span>
          <span className="faint" style={{ fontSize: 12.5, display: 'block', marginBottom: 8 }}>{user.email}</span>
          <button className="btn sm">Sair</button>
        </form>
      </aside>
      <main className="conteudo">{children}</main>
    </div>
  );
}
