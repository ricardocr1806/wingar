import { notFound } from 'next/navigation';
import { Aviso } from '@/app/ui';
import { AdicionarUsuario } from '@/app/usuarios/AdicionarUsuario';
import { cancelarAcesso, salvarUsuario } from '@/app/usuarios/actions';
import { APRESENTACAO } from '@/generated/apresentacao';
import { empresaDoUsuario } from '../dados';

export const metadata = { title: 'Configurações · DetailHub' };
type Usuario = { user_id: string; nome: string | null; email: string; cargo_id: string; cargo: string; nivel: string; escopo: string; ativo: boolean; ultimo_acesso: string | null };
const VE: Record<string, string> = { Administrador: 'Vê tudo e gerencia as pessoas', Financeiro: 'Vê Comercial, Operacional e Financeiro', Comercial: 'Vê só o Comercial', Operacional: 'Vê só o Operacional' };
const quando = (s: string | null) => { if (!s) return 'Ainda não entrou'; const d = Math.floor((Date.now() - new Date(s).getTime()) / 864e5); return d <= 0 ? 'Hoje' : d === 1 ? 'Ontem' : `Há ${d} dias`; };

export default async function Configuracoes({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { slug } = await params;
  const { erro, ok } = await searchParams;
  const { sb, user, emp, pode } = await empresaDoUsuario(slug);
  if (!pode.has('equipe:editar')) notFound();
  const [{ data: dono }, { data: us }, { data: cargos }, { data: vagas }, { data: conv }] = await Promise.all([
    sb.rpc('eh_dono_plataforma'),
    sb.rpc('usuarios_da_empresa', { p_empresa: emp.id }),
    sb.from('cargos').select('id, nome, nivel').eq('empresa_id', emp.id).order('criado_em'),
    sb.rpc('vagas_da_empresa', { p_empresa: emp.id }),
    sb.from('convites').select('id, nome, email, cargo_id, expira_em').eq('empresa_id', emp.id).is('aceito_em', null).gt('expira_em', new Date().toISOString()).order('criado_em', { ascending: false }),
  ]);
  const U = (us ?? []) as Usuario[];
  const C = cargos ?? [];
  const v = ((vagas ?? []) as { limite: number; usados: number; livres: number }[])[0] ?? { limite: 5, usados: 0, livres: 5 };
  const areas = C.filter((c) => dono || c.nivel !== 'admin_empresa');
  const nomeCargo = new Map(C.map((c) => [c.id, c.nome]));
  const volta = `/app/${slug}/configuracoes`;
  const sistema = APRESENTACAO[slug] ? `/apresentacao?empresa=${slug}` : `/app/${slug}`;

  return (
    <>
      <div className="topo">
        <div><a href={sistema} className="faint" style={{ fontSize: 13, textDecoration: 'none' }}>← Voltar ao sistema</a>
          <h1 style={{ marginTop: 6 }}>Configurações</h1>
          <p className="muted">Quem acessa o sistema da {emp.nome} e o que cada pessoa vê.</p></div>
      </div>
      <Aviso erro={erro} ok={ok} />

      <div className="kpis">
        <div className="kpi destaque"><span>Pessoas no plano</span><b>{v.usados} de {v.limite}</b><small>{v.livres ? `${v.livres} vaga${v.livres === 1 ? '' : 's'} livre${v.livres === 1 ? '' : 's'}` : 'todas as vagas usadas'} · administradores não contam</small></div>
        <div className="kpi"><span>Seu acesso</span><b style={{ fontSize: 22 }}>{dono ? 'Administrador total' : 'Administrador'}</b><small>{dono ? 'Dono da plataforma DetailHub' : `Administrador do sistema da ${emp.nome}`}</small></div>
      </div>

      <section className="card"><h3>Áreas de acesso</h3>
        <div className="grade">{C.map((c) => (
          <div key={c.id} className="kpi" style={{ boxShadow: 'none' }}><span>{c.nome}</span><small style={{ fontSize: 13 }}>{VE[c.nome] ?? 'Permissões personalizadas'}</small></div>))}
        </div>
      </section>

      <section className="card">
        <div className="card-h"><h3>Pessoas</h3><span className="chip">{U.length}</span></div>
        {U.length ? (
          <div className="mx-wrap"><table className="lista"><thead><tr><th>Pessoa</th><th>Área e acesso</th><th>Último acesso</th></tr></thead>
            <tbody>{U.map((u) => {
              const eu = u.user_id === user.id, fixo = eu || (!dono && u.nivel === 'admin_empresa');
              return (
                <tr key={u.user_id}>
                  <td><b>{u.nome || u.email}</b>{eu && <span className="chip" style={{ marginLeft: 8 }}>você</span>}<div className="faint" style={{ fontSize: 12.5 }}>{u.email}</div></td>
                  <td>{fixo ? <span>{u.cargo} · {u.ativo ? 'Ativo' : 'Bloqueado'}</span> : (
                    <form action={salvarUsuario} className="linha">
                      <input type="hidden" name="empresa_id" value={emp.id} /><input type="hidden" name="user_id" value={u.user_id} /><input type="hidden" name="volta" value={volta} /><input type="hidden" name="escopo" value={u.escopo} />
                      <select name="cargo_id" defaultValue={u.cargo_id} aria-label="Área">{areas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
                      <select name="ativo" defaultValue={u.ativo ? '1' : '0'} aria-label="Acesso"><option value="1">Ativo</option><option value="0">Bloqueado</option></select>
                      <button className="btn sm">Salvar</button>
                    </form>)}</td>
                  <td>{quando(u.ultimo_acesso)}</td>
                </tr>);
            })}</tbody></table></div>
        ) : <div className="vazio">Ninguém ainda.</div>}
        {!!conv?.length && (<div>
          <span className="faint" style={{ fontSize: 12.5 }}>Adicionados que ainda não entraram</span>
          <table className="lista"><tbody>{conv.map((c) => (
            <tr key={c.id}><td><b>{c.nome || c.email || 'Link de acesso'}</b><div className="faint" style={{ fontSize: 12.5 }}>{c.email}</div></td><td>{nomeCargo.get(c.cargo_id)}</td>
              <td style={{ textAlign: 'right' }}><form action={cancelarAcesso}><input type="hidden" name="convite_id" value={c.id} /><input type="hidden" name="volta" value={volta} /><button className="btn sm perigo">Cancelar</button></form></td></tr>))}
          </tbody></table></div>)}
      </section>

      <section className="card"><h3>Adicionar pessoa</h3>
        {v.livres > 0 || dono ? <AdicionarUsuario empresaId={emp.id} volta={volta} cargos={areas.map(({ id, nome }) => ({ id, nome }))} />
          : <p className="muted">Todas as {v.limite} vagas do plano estão em uso. Bloqueie alguém para liberar uma vaga ou fale com o DetailHub para aumentar o plano.</p>}
        <span className="faint" style={{ fontSize: 12.5 }}>A pessoa recebe um e-mail para entrar no sistema da {emp.nome} e criar a senha. O link também aparece aqui para mandar pelo WhatsApp.</span>
      </section>
    </>
  );
}
