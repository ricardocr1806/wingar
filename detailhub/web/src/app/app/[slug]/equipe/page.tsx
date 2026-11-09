import { notFound } from 'next/navigation';
import { ACOES, MODULOS, NIVEL_NOME, chave, efetivas, type Cargo, type Perm } from '@/lib/acesso';
import { Aviso, Cadeado, Check } from '@/app/ui';
import { empresaDoUsuario } from '../dados';
import { alternarPermissao, criarCargo, excluirCargo, salvarMembro } from './actions';
import { Convidar } from './Convidar';

export const metadata = { title: 'Equipe e cargos · DetailHub' };

export default async function Equipe({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ erro?: string }>;
}) {
  const { slug } = await params;
  const { erro } = await searchParams;
  const { sb, user, emp, pode } = await empresaDoUsuario(slug);
  if (!pode.has('equipe:ver')) notFound();
  const gere = pode.has('equipe:editar');

  const [{ data: cargos }, { data: perms }, { data: teto }, { data: membros }, { data: convites }] = await Promise.all([
    sb.from('cargos').select('id, nome, nivel, pai_id').eq('empresa_id', emp.id).order('criado_em'),
    sb.from('cargo_permissoes').select('cargo_id, modulo, acao').eq('empresa_id', emp.id),
    sb.from('empresa_teto').select('modulo, acao').eq('empresa_id', emp.id),
    sb.from('membros').select('user_id, cargo_id, escopo, ativo').eq('empresa_id', emp.id),
    gere ? sb.from('convites').select('id, email, cargo_id, expira_em, aceito_em').eq('empresa_id', emp.id).is('aceito_em', null).order('criado_em', { ascending: false }) : Promise.resolve({ data: [] as { id: string; email: string; cargo_id: string; expira_em: string; aceito_em: string | null }[] }),
  ]);
  const C = (cargos ?? []) as Cargo[];
  const P = (perms ?? []) as Perm[];
  const tetoSet = new Set((teto ?? []).map((t) => chave(t.modulo, t.acao)));
  const ef = efetivas(C, P, tetoSet);
  const proprias = new Set(P.map((p) => `${p.cargo_id}|${chave(p.modulo, p.acao)}`));
  const ids = (membros ?? []).map((m) => m.user_id);
  const { data: perfis } = ids.length ? await sb.from('perfis').select('user_id, nome, email').in('user_id', ids) : { data: [] };
  const perfil = new Map((perfis ?? []).map((p) => [p.user_id, p]));
  const nomeCargo = new Map(C.map((c) => [c.id, c.nome]));
  // cargos que esta pessoa pode atribuir: tudo o que o cargo tem, ela também tem
  const atribuiveis = C.filter((c) => c.nivel !== 'admin_empresa' && [...(ef.get(c.id) ?? [])].every((k) => pode.has(k)));
  const comum = { slug, empresa_id: emp.id };

  return (
    <>
      <div className="topo"><div><h1>Equipe e cargos</h1>
        <p className="muted">Cada cargo só pode ter o que o cargo de cima tem. Tirar uma permissão de um cargo tira também de todos os cargos abaixo dele.</p></div></div>
      <Aviso erro={erro} />

      {C.map((c) => {
        const pai = c.pai_id ? ef.get(c.pai_id) ?? new Set<string>() : tetoSet;
        const fixo = c.nivel === 'admin_empresa' || !gere;
        return (
          <section key={c.id} className="card">
            <div className="card-h">
              <div><h3>{c.nome}</h3><span className="faint" style={{ fontSize: 12.5 }}>{NIVEL_NOME[c.nivel]}{c.pai_id ? ` · abaixo de ${nomeCargo.get(c.pai_id)}` : ' · definido pelo dono da plataforma'}</span></div>
              {gere && c.nivel !== 'admin_empresa' && (
                <form action={excluirCargo}><input type="hidden" name="slug" value={slug} /><input type="hidden" name="cargo_id" value={c.id} />
                  <button className="btn sm perigo">Excluir cargo</button></form>
              )}
            </div>
            <div className="mx-wrap"><table className="mx">
              <thead><tr><th>Área</th>{ACOES.map((a) => <th key={a.codigo}>{a.nome}</th>)}</tr></thead>
              <tbody>{MODULOS.map((m) => (
                <tr key={m.codigo}><td style={{ ['--c' as string]: m.cor }}><i />{m.nome}</td>
                  {ACOES.map((a) => {
                    const k = chave(m.codigo, a.codigo);
                    const on = ef.get(c.id)?.has(k) ?? false;
                    const trava = !pai.has(k) || !tetoSet.has(k) || (!fixo && !pode.has(k));
                    const rotulo = `${m.nome}: ${a.nome}`;
                    if (fixo || trava) return (
                      <td key={a.codigo}><span className={`cel ${on ? 'on' : ''} ${trava && !on ? 'trava' : 'fixo'}`} role="img"
                        aria-label={`${rotulo}: ${on ? 'liberado' : trava ? 'bloqueado pelo nível de cima' : 'não liberado'}`}
                        title={trava && !on ? 'O nível de cima não tem esta permissão' : undefined}>{on ? <Check /> : trava ? <Cadeado /> : null}</span></td>);
                    return (
                      <td key={a.codigo}><form action={alternarPermissao}>
                        <input type="hidden" name="slug" value={slug} /><input type="hidden" name="empresa_id" value={emp.id} />
                        <input type="hidden" name="cargo_id" value={c.id} /><input type="hidden" name="modulo" value={m.codigo} />
                        <input type="hidden" name="acao" value={a.codigo} /><input type="hidden" name="ligar" value={proprias.has(`${c.id}|${k}`) ? '0' : '1'} />
                        <button className={`cel ${on ? 'on' : ''}`} aria-pressed={on} aria-label={rotulo}>{on ? <Check /> : null}</button>
                      </form></td>);
                  })}</tr>))}</tbody>
            </table></div>
          </section>
        );
      })}

      {gere && (
        <section className="card"><h3>Novo cargo</h3>
          <form action={criarCargo} className="linha">
            <input type="hidden" name="slug" value={slug} /><input type="hidden" name="empresa_id" value={emp.id} />
            <label>Nome do cargo<input name="nome" required minLength={2} maxLength={60} placeholder="Ex.: Vendedor, Aplicador, Assistente financeiro" /></label>
            <label>Tipo<select name="nivel"><option value="equipe">Cargo da equipe</option><option value="admin_area">Administrador de área</option></select></label>
            <label>Fica abaixo de<select name="pai_id">{C.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
            <button className="btn pri">Criar cargo</button>
          </form>
          <span className="faint" style={{ fontSize: 12.5 }}>Depois de criar, marque as permissões no quadro do cargo.</span>
        </section>
      )}

      <section className="card"><div className="card-h"><h3>Pessoas</h3><span className="chip">{(membros ?? []).length}</span></div>
        <div className="mx-wrap"><table className="lista"><thead><tr><th>Pessoa</th><th>Cargo</th><th>Vê os registros</th><th>Situação</th><th /></tr></thead>
          <tbody>{(membros ?? []).map((m) => {
            const pf = perfil.get(m.user_id);
            const eu = m.user_id === user.id;
            const podeMexer = gere && !eu && atribuiveis.some((c) => c.id === m.cargo_id);
            return (
              <tr key={m.user_id}>
                <td><b>{pf?.nome || pf?.email}</b>{eu && <span className="chip" style={{ marginLeft: 8 }}>você</span>}<div className="faint" style={{ fontSize: 12.5 }}>{pf?.email}</div></td>
                {podeMexer ? (
                  <td colSpan={4}><form action={salvarMembro} className="linha">
                    <input type="hidden" name="slug" value={slug} /><input type="hidden" name="empresa_id" value={emp.id} /><input type="hidden" name="user_id" value={m.user_id} />
                    <label><span className="faint">Cargo</span><select name="cargo_id" defaultValue={m.cargo_id}>{atribuiveis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
                    <label><span className="faint">Vê</span><select name="escopo" defaultValue={m.escopo}><option value="todos">De todos</option><option value="proprios">Só os próprios</option></select></label>
                    <label><span className="faint">Acesso</span><select name="ativo" defaultValue={m.ativo ? '1' : '0'}><option value="1">Ativo</option><option value="0">Bloqueado</option></select></label>
                    <button className="btn sm">Salvar</button>
                  </form></td>
                ) : (<>
                  <td>{nomeCargo.get(m.cargo_id)}</td><td>{m.escopo === 'proprios' ? 'Só os próprios' : 'De todos'}</td>
                  <td>{m.ativo ? <span className="chip ok">Ativo</span> : <span className="chip bad">Bloqueado</span>}</td><td />
                </>)}
              </tr>);
          })}</tbody></table></div>
      </section>

      {gere && (
        <section className="card"><h3>Convidar para a equipe</h3>
          {atribuiveis.length ? <Convidar slug={slug} empresaId={emp.id} cargos={atribuiveis.map(({ id, nome }) => ({ id, nome }))} />
            : <p className="muted">Crie um cargo primeiro para poder convidar alguém.</p>}
          {!!convites?.length && (<div>
            <span className="faint" style={{ fontSize: 12.5 }}>Convites aguardando</span>
            <table className="lista"><tbody>{convites.map((cv) => (
              <tr key={cv.id}><td>{cv.email}</td><td>{nomeCargo.get(cv.cargo_id)}</td>
                <td>{new Date(cv.expira_em) < new Date() ? <span className="chip bad">Expirado</span> : <span className="chip">Vale até {new Date(cv.expira_em).toLocaleDateString('pt-BR')}</span>}</td></tr>))}
            </tbody></table></div>)}
        </section>
      )}
    </>
  );
}
