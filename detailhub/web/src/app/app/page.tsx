import Link from 'next/link';
import { redirect } from 'next/navigation';
import { usuarioAtual } from '@/lib/supabase/server';
import { Marca } from '@/app/ui';
import { inicioDaEmpresa } from '@/lib/nav';
import { temSistema } from '@/lib/pagina-empresa';

export const metadata = { title: 'Suas empresas · DetailHub' };

export default async function Empresas() {
  const { sb, user } = await usuarioAtual();
  if (!user) redirect('/entrar');
  const [{ data: dono }, { data: empresas }] = await Promise.all([
    sb.rpc('eh_dono_plataforma'),
    sb.from('empresas').select('id, nome, slug, ativa').order('nome'),
  ]);
  if (dono) redirect('/plataforma');
  const lista = (empresas ?? []).filter((e) => dono || e.ativa);
  if (!dono && lista.length === 1) redirect(inicioDaEmpresa(lista[0].slug, temSistema(lista[0].slug)));

  return (
    <main className="auth" style={{ maxWidth: 560 }}>
      <Marca href="/app" />
      <h1>Olá{user.user_metadata?.full_name ? `, ${String(user.user_metadata.full_name).split(' ')[0]}` : ''}</h1>
      {dono && (
        <Link href="/plataforma" className="card" style={{ textDecoration: 'none' }}>
          <h3>Painel do dono da plataforma</h3>
          <p className="muted">Criar empresas, liberar módulos e convidar administradores.</p>
        </Link>
      )}
      {lista.length ? (
        <div className="grade" style={{ gridTemplateColumns: '1fr' }}>
          {lista.map((e) => (
            <Link key={e.id} href={`/app/${e.slug}`} className="card" style={{ textDecoration: 'none', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <b>{e.nome}</b>{!e.ativa && <span className="chip bad">Desativada</span>}
            </Link>
          ))}
        </div>
      ) : !dono && (
        <div className="vazio">Sua conta ({user.email}) ainda não foi adicionada a nenhuma empresa. Peça para o administrador da sua empresa te adicionar em <b>Adicionar colaborador</b>, com este mesmo e-mail. Você vai receber um link por e-mail para entrar.</div>
      )}
      <form action="/sair" method="post"><button className="link">Sair da conta</button></form>
    </main>
  );
}
