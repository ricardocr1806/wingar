import Link from 'next/link';
import { usuarioAtual } from '@/lib/supabase/server';
import { MODULOS } from '@/lib/acesso';
import { Aviso } from '@/app/ui';
import { criarEmpresa } from './actions';

type Linha = { id: string; nome: string; slug: string; ativa: boolean; criada_em: string; usuarios: number; usuarios_ativos: number; pendentes: number; modulos: string[]; ultimo_acesso: string | null };
const data = (s: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');
const quando = (s: string | null) => {
  if (!s) return 'Nunca acessou';
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 864e5);
  return d <= 0 ? 'Hoje' : d === 1 ? 'Ontem' : `Há ${d} dias`;
};

export default async function Painel({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { erro, ok } = await searchParams;
  const { sb, user } = await usuarioAtual();
  const { data: rows } = await sb.rpc('resumo_empresas');
  const L = (rows ?? []) as Linha[];
  const ativas = L.filter((e) => e.ativa).length;
  const usuarios = L.reduce((s, e) => s + Number(e.usuarios_ativos), 0);
  const pendentes = L.reduce((s, e) => s + Number(e.pendentes), 0);
  const primeiro = String(user?.user_metadata?.full_name ?? '').split(' ')[0];

  return (
    <>
      <div className="topo"><div><span className="faint" style={{ fontSize: 13 }}>Painel administrativo</span><h1>{primeiro ? `Olá, ${primeiro}` : 'Visão geral'}</h1>
        <p className="muted">Todas as empresas que usam o DetailHub, num lugar só.</p></div>
        <a className="btn pri" href="#nova">+ Nova empresa</a></div>
      <Aviso erro={erro} ok={ok} />

      <div className="kpis">
        <div className="kpi destaque"><span>Empresas ativas</span><b>{ativas}</b><small>{L.length - ativas ? `${L.length - ativas} desativada${L.length - ativas === 1 ? '' : 's'}` : 'nenhuma desativada'}</small></div>
        <div className="kpi"><span>Usuários ativos</span><b>{usuarios}</b><small>em todas as empresas</small></div>
        <div className="kpi"><span>Acessos pendentes</span><b>{pendentes}</b><small>adicionados que ainda não entraram</small></div>
        <div className="kpi"><span>Total de empresas</span><b>{L.length}</b><small>clientes da plataforma</small></div>
      </div>

      <section className="card" id="empresas">
        <div className="card-h"><h3>Empresas</h3><span className="chip">{L.length}</span></div>
        {L.length ? (
          <div className="mx-wrap"><table className="lista">
            <thead><tr><th>Empresa</th><th>Situação</th><th>Usuários</th><th>Pendentes</th><th>Módulos</th><th>Último acesso</th><th>Desde</th><th /></tr></thead>
            <tbody>{L.map((e) => (
              <tr key={e.id}>
                <td><Link href={`/plataforma/empresas/${e.id}`} style={{ textDecoration: 'none' }}><b>{e.nome}</b></Link><div className="faint mono" style={{ fontSize: 12 }}>/{e.slug}</div></td>
                <td>{e.ativa ? <span className="chip ok">Ativa</span> : <span className="chip bad">Desativada</span>}</td>
                <td>{e.usuarios_ativos}{Number(e.usuarios) > Number(e.usuarios_ativos) && <span className="faint"> · {Number(e.usuarios) - Number(e.usuarios_ativos)} bloq.</span>}</td>
                <td>{Number(e.pendentes) ? <span className="chip">{e.pendentes}</span> : '—'}</td>
                <td><span className="mods">{MODULOS.filter((m) => m.codigo !== 'equipe').map((m) => (
                  <i key={m.codigo} title={m.nome} style={{ background: e.modulos.includes(m.codigo) ? m.cor : 'var(--surface-3)' }} />))}</span></td>
                <td>{quando(e.ultimo_acesso)}</td>
                <td>{data(e.criada_em)}</td>
                <td style={{ whiteSpace: 'nowrap' }}><a className="btn sm pri" href={`/apresentacao?empresa=${e.slug}`} target="_blank" rel="noopener">Abrir</a> <Link className="btn sm" href={`/plataforma/empresas/${e.id}`}>Gerenciar</Link></td>
              </tr>))}</tbody>
          </table></div>
        ) : <div className="vazio">Nenhuma empresa ainda. Cadastre a primeira logo abaixo.</div>}
      </section>

      <section className="card" id="nova"><h3>Nova empresa</h3>
        <form action={criarEmpresa} className="linha">
          <label>Nome da empresa<input name="nome" required minLength={2} maxLength={120} placeholder="Nome da empresa" /></label>
          <button className="btn pri">Criar empresa</button>
        </form>
        <span className="faint" style={{ fontSize: 12.5 }}>Depois de criar, você cai na página da empresa para adicionar o administrador e a equipe.</span>
      </section>
    </>
  );
}
