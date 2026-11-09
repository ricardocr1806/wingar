import Link from 'next/link';
import { Marca } from '@/app/ui';
import { MODULOS } from '@/lib/acesso';
import { empresaDoUsuario } from './dados';

export default async function CascaEmpresa({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { emp, pode, user } = await empresaDoUsuario(slug);
  const visiveis = MODULOS.filter((m) => pode.has(`${m.codigo}:ver`));
  return (
    <div className="casca">
      <aside className="lado">
        <Marca href="/app" />
        <div className="emp">Empresa<b>{emp.nome}</b></div>
        <nav aria-label="Módulos">
          <Link href={`/app/${slug}`}><i />Início</Link>
          {visiveis.map((m) => (
            <Link key={m.codigo} href={`/app/${slug}/${m.codigo}`} style={{ ['--c' as string]: m.cor }}><i />{m.nome}</Link>
          ))}
        </nav>
        <form action="/sair" method="post">
          <span className="faint" style={{ fontSize: 12.5, display: 'block', marginBottom: 6 }}>{user.email}</span>
          <button className="btn sm">Sair</button>
        </form>
      </aside>
      <main className="conteudo">{children}</main>
    </div>
  );
}
