import Link from 'next/link';
import { usuarioAtual } from '@/lib/supabase/server';
import { Aviso, Marca } from '@/app/ui';
import { aceitar } from './actions';

export const metadata = { title: 'Convite · DetailHub' };

export default async function Convite({ params, searchParams }: {
  params: Promise<{ token: string }>; searchParams: Promise<{ erro?: string }>;
}) {
  const { token } = await params;
  const { erro } = await searchParams;
  const { user } = await usuarioAtual();
  const volta = encodeURIComponent(`/convite/${token}`);
  return (
    <main className="auth">
      <Marca />
      <h1>Você foi convidado para o DetailHub</h1>
      <Aviso erro={erro} />
      {user ? (
        <div className="auth-card">
          <p>Você está entrando como <b>{user.email}</b>. O convite só funciona se foi enviado para este e-mail.</p>
          <form action={aceitar}><input type="hidden" name="token" value={token} /><button className="btn pri" style={{ width: '100%' }}>Aceitar convite</button></form>
          <form action="/sair" method="post"><button className="link">Não é você? Entrar com outra conta</button></form>
        </div>
      ) : (
        <div className="auth-card">
          <p className="muted">Para aceitar, entre ou crie sua conta com o mesmo e-mail que recebeu o convite.</p>
          <Link className="btn pri" href={`/entrar?next=${volta}`}>Entrar ou criar conta</Link>
        </div>
      )}
    </main>
  );
}
