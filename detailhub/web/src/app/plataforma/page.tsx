import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { usuarioAtual } from '@/lib/supabase/server';
import { ACOES, MODULOS, chave } from '@/lib/acesso';
import { Aviso, Check, Marca } from '@/app/ui';
import { Convidar } from '@/app/app/[slug]/equipe/Convidar';
import { alternarAtiva, alternarTeto, convidarAdmin, criarEmpresa } from './actions';

export const metadata = { title: 'Painel da plataforma · DetailHub' };

export default async function Plataforma({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { sb, user } = await usuarioAtual();
  if (!user) redirect('/entrar?next=/plataforma');
  const { data: dono } = await sb.rpc('eh_dono_plataforma');
  if (!dono) notFound();
  const { erro, ok } = await searchParams;
  const [{ data: empresas }, { data: teto }, { data: admins }, { data: membros }] = await Promise.all([
    sb.from('empresas').select('id, nome, slug, ativa, criada_em').order('criada_em'),
    sb.from('empresa_teto').select('empresa_id, modulo, acao'),
    sb.from('cargos').select('id, empresa_id').eq('nivel', 'admin_empresa'),
    sb.from('membros').select('empresa_id, ativo'),
  ]);
  const tetoDe = (id: string) => new Set((teto ?? []).filter((t) => t.empresa_id === id).map((t) => chave(t.modulo, t.acao)));
  const admDe = (id: string) => (admins ?? []).find((a) => a.empresa_id === id)?.id ?? '';
  const qtd = (id: string) => (membros ?? []).filter((m) => m.empresa_id === id && m.ativo).length;

  return (
    <div className="conteudo" style={{ margin: '0 auto' }}>
      <div className="topo">
        <div><Marca href="/app" /><h1 style={{ marginTop: 16 }}>Painel da plataforma</h1>
          <p className="muted">Só você vê esta página. Aqui você cria empresas, decide o que cada uma pode usar e convida o administrador.</p></div>
        <form action="/sair" method="post"><button className="btn sm">Sair</button></form>
      </div>
      <Aviso erro={erro} ok={ok} />

      <section className="card"><h3>Nova empresa</h3>
        <form action={criarEmpresa} className="linha">
          <label>Nome da empresa<input name="nome" required minLength={2} maxLength={120} placeholder="Ex.: Wingard Proteção Automotiva" /></label>
          <label>Endereço no sistema<input name="slug" pattern="[a-z0-9-]*" maxLength={60} placeholder="wingard (opcional)" /></label>
          <button className="btn pri">Criar empresa</button>
        </form>
        <span className="faint" style={{ fontSize: 12.5 }}>A empresa nasce com todos os módulos liberados e com o cargo de Administrador.</span>
      </section>

      {(empresas ?? []).map((e) => {
        const t = tetoDe(e.id);
        return (
          <section key={e.id} className="card">
            <div className="card-h">
              <div><h3>{e.nome}</h3><span className="faint mono" style={{ fontSize: 12.5 }}>/app/{e.slug} · {qtd(e.id)} pessoa{qtd(e.id) === 1 ? '' : 's'}</span></div>
              <div className="linha" style={{ alignItems: 'center' }}>
                {e.ativa ? <span className="chip ok">Ativa</span> : <span className="chip bad">Desativada</span>}
                <Link className="btn sm" href={`/app/${e.slug}`}>Entrar como suporte</Link>
                <form action={alternarAtiva}><input type="hidden" name="empresa_id" value={e.id} /><input type="hidden" name="ativa" value={e.ativa ? '0' : '1'} />
                  <button className={`btn sm ${e.ativa ? 'perigo' : ''}`}>{e.ativa ? 'Desativar' : 'Reativar'}</button></form>
              </div>
            </div>
            <div>
              <span className="faint" style={{ fontSize: 12.5 }}>O que esta empresa pode usar (teto do plano). Tirar daqui tira de todos na empresa, inclusive do administrador.</span>
              <div className="mx-wrap"><table className="mx">
                <thead><tr><th>Área</th>{ACOES.map((a) => <th key={a.codigo}>{a.nome}</th>)}</tr></thead>
                <tbody>{MODULOS.map((m) => (
                  <tr key={m.codigo}><td style={{ ['--c' as string]: m.cor }}><i />{m.nome}</td>
                    {ACOES.map((a) => { const on = t.has(chave(m.codigo, a.codigo)); return (
                      <td key={a.codigo}><form action={alternarTeto}>
                        <input type="hidden" name="empresa_id" value={e.id} /><input type="hidden" name="modulo" value={m.codigo} />
                        <input type="hidden" name="acao" value={a.codigo} /><input type="hidden" name="ligar" value={on ? '0' : '1'} />
                        <button className={`cel ${on ? 'on' : ''}`} aria-pressed={on} aria-label={`${m.nome}: ${a.nome}`}>{on ? <Check /> : null}</button>
                      </form></td>); })}
                  </tr>))}</tbody>
              </table></div>
            </div>
            <Convidar slug={e.slug} empresaId={e.id} cargos={[{ id: admDe(e.id), nome: 'Administrador' }]} acao={convidarAdmin} titulo="Convidar administrador" />
          </section>
        );
      })}
      {!empresas?.length && <div className="vazio">Nenhuma empresa ainda. Crie a primeira acima.</div>}
    </div>
  );
}
