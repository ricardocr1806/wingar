import Link from 'next/link';
import { MODULOS } from '@/lib/acesso';
import { redirect } from 'next/navigation';
import { empresaDoUsuario } from './dados';
import { APRESENTACAO } from '@/generated/apresentacao';

const ETAPA: Record<string, string> = { comercial: 'Etapa 2', operacional: 'Etapa 3', financeiro: 'Etapa 4' };

export default async function InicioEmpresa({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { emp, pode } = await empresaDoUsuario(slug);
  if (APRESENTACAO[slug]) redirect(`/apresentacao?empresa=${slug}`);
  const visiveis = MODULOS.filter((m) => pode.has(`${m.codigo}:ver`));
  return (
    <>
      <div className="topo"><div><h1>{emp.nome}</h1><p className="muted">Escolha um módulo. Você vê só o que o seu cargo libera.</p></div></div>
      <div className="grade">
        {visiveis.map((m) => (
          <Link key={m.codigo} href={`/app/${slug}/${m.codigo}`} className="card" style={{ textDecoration: 'none', borderTop: `3px solid ${m.cor}` }}>
            <h3>{m.nome}</h3>
            <p className="muted">{m.codigo === 'equipe' ? 'Cargos, permissões e convites.' : `Chega na ${ETAPA[m.codigo]} da construção.`}</p>
          </Link>
        ))}
        {!visiveis.length && <div className="vazio">Seu cargo ainda não tem nenhum módulo liberado. Fale com o administrador.</div>}
      </div>
    </>
  );
}
