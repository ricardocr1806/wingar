import Link from 'next/link';
import { usuarioAtual } from '@/lib/supabase/server';
import { Aviso, Marca } from '@/app/ui';
import { aceitar, reenviarLink } from './actions';
import { SessaoDoLink } from './SessaoDoLink';

export const metadata = { title: 'Acesso · DetailHub' };
type Info = { email: string; empresa: string; empresa_slug: string; cargo: string; expirado: boolean; usado: boolean; conta_ativa: boolean };

export default async function Convite({ params, searchParams }: {
  params: Promise<{ token: string }>; searchParams: Promise<{ erro?: string; enviado?: string }>;
}) {
  const { token } = await params;
  const { erro, enviado } = await searchParams;
  const { sb, user } = await usuarioAtual();
  const { data } = await sb.rpc('ver_convite', { p_token: token });
  const c = (data as Info[] | null)?.[0];
  const volta = encodeURIComponent(`/convite/${token}`);

  let corpo: React.ReactNode;
  if (!c) corpo = <div className="auth-card"><p>Este link de acesso não existe. Peça um novo para quem te adicionou.</p></div>;
  else if (c.usado) corpo = <div className="auth-card"><p>Este acesso já foi usado.</p><Link className="btn pri" href="/entrar">Entrar no DetailHub</Link></div>;
  else if (c.expirado) corpo = <div className="auth-card"><p>Este link venceu. Peça para quem te adicionou te adicionar de novo.</p></div>;
  else if (user && user.email?.toLowerCase() === c.email) corpo = (
    <div className="auth-card">
      <p>Você foi adicionado à <b>{c.empresa}</b> como <b>{c.cargo}</b>.</p>
      <form action={aceitar}><input type="hidden" name="token" value={token} /><button className="btn pri" style={{ width: '100%' }}>Entrar na {c.empresa}</button></form>
    </div>);
  else if (user) corpo = (
    <div className="auth-card">
      <p>Este acesso é para <b>{c.email}</b>, mas você está logado como <b>{user.email}</b>.</p>
      <form action="/sair" method="post"><button className="btn">Sair e entrar com o e-mail certo</button></form>
    </div>);
  else corpo = (
    <div className="auth-card">
      <p>Você foi adicionado à <b>{c.empresa}</b> como <b>{c.cargo}</b>.</p>
      <p className="muted">Acesso para <b>{c.email}</b>.</p>
      {c.conta_ativa ? (
        <Link className="btn pri" href={`/entrar?next=${volta}`}>Entrar com minha senha</Link>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 13.5 }}>Abra o e-mail que você recebeu e clique no link para entrar e criar sua senha.</p>
          <form action={reenviarLink}><input type="hidden" name="token" value={token} /><button className="btn pri" style={{ width: '100%' }}>Mandar o link para o meu e-mail</button></form>
          {enviado && <p className="msg ok">Link enviado para {c.email}. Abra o e-mail neste aparelho.</p>}
        </>
      )}
    </div>);

  return (
    <main className="auth">
      <Marca />
      <h1>{c && !c.usado && !c.expirado ? `Bem-vindo à ${c.empresa}` : 'Acesso ao DetailHub'}</h1>
      <SessaoDoLink />
      <Aviso erro={erro} />
      {corpo}
    </main>
  );
}
