import { notFound } from 'next/navigation';
import { MODULOS } from '@/lib/acesso';
import { empresaDoUsuario } from '../dados';

export default async function Modulo({ params }: { params: Promise<{ slug: string; modulo: string }> }) {
  const { slug, modulo } = await params;
  const m = MODULOS.find((x) => x.codigo === modulo && x.codigo !== 'equipe');
  if (!m) notFound();
  const { pode } = await empresaDoUsuario(slug);
  if (!pode.has(`${m.codigo}:ver`)) notFound();
  return (
    <>
      <div className="topo"><h1>{m.nome}</h1></div>
      <div className="vazio">O módulo {m.nome} entra nas próximas etapas, trazendo o que já foi validado no protótipo.</div>
    </>
  );
}
