import Link from 'next/link';
import { notFound } from 'next/navigation';
import { usuarioAtual } from '@/lib/supabase/server';
import { ACOES, MODULOS, NIVEL_NOME, chave } from '@/lib/acesso';
import { Aviso, Check } from '@/app/ui';
import { AdicionarUsuario } from '@/app/usuarios/AdicionarUsuario';
import { cancelarAcesso, salvarUsuario } from '@/app/usuarios/actions';
import { alternarAtiva, alternarTeto } from '../../actions';
import { APRESENTACAO } from '@/generated/apresentacao';
import { LinksCliente } from '../../LinksCliente';
import { desativarLinkVer } from '../../links';

const C0 = (c: { id: string; nivel: string }[] | null) => (c ?? []).find((x) => x.nivel === 'admin_empresa')?.id ?? '';
type Usuario = { user_id: string; nome: string | null; email: string; cargo_id: string; cargo: string; nivel: keyof typeof NIVEL_NOME; escopo: string; ativo: boolean; ultimo_acesso: string | null };
const quando = (s: string | null) => {
  if (!s) return 'Ainda não entrou';
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 864e5);
  return d <= 0 ? 'Hoje' : d === 1 ? 'Ontem' : `Há ${d} dias`;
};

export default async function Empresa({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { id } = await params;
  const { erro, ok } = await searchParams;
  const { sb } = await usuarioAtual();
  const { data: emp } = await sb.from('empresas').select('id, nome, slug, ativa, criada_em').eq('id', id).maybeSingle();
  if (!emp) notFound();
  const [{ data: us }, { data: cargos }, { data: teto }, { data: conv }, { data: links }] = await Promise.all([
    sb.rpc('usuarios_da_empresa', { p_empresa: id }),
    sb.from('cargos').select('id, nome, nivel').eq('empresa_id', id).order('criado_em'),
    sb.from('empresa_teto').select('modulo, acao').eq('empresa_id', id),
    sb.from('convites').select('id, nome, email, cargo_id, expira_em').eq('empresa_id', id).is('aceito_em', null).order('criado_em', { ascending: false }),
    sb.from('links_visualizacao').select('id, expira_em, ativo, acessos, ultimo_acesso, criado_em').eq('empresa_id', id).eq('ativo', true).gt('expira_em', new Date().toISOString()).order('criado_em', { ascending: false }),
  ]);
  const cargoAdmin = C0(cargos);
  const U = (us ?? []) as Usuario[];
  const C = cargos ?? [];
  const nomeCargo = new Map(C.map((c) => [c.id, c.nome]));
  const t = new Set((teto ?? []).map((x) => chave(x.modulo, x.acao)));
  const volta = `/plataforma/empresas/${id}`;

  return (
    <>
      <div className="topo">
        <div><Link href="/plataforma" className="faint" style={{ fontSize: 13, textDecoration: 'none' }}>← Painel</Link>
          <h1 style={{ marginTop: 6 }}>{emp.nome}</h1>
          <p className="muted">{emp.ativa ? 'Ativa' : 'Desativada'} · desde {new Date(emp.criada_em).toLocaleDateString('pt-BR')} · {U.filter((u) => u.ativo).length} usuário(s) ativo(s)</p></div>
        <div className="linha" style={{ alignItems: 'center' }}>
          {emp.ativa ? <span className="chip ok">Ativa</span> : <span className="chip bad">Desativada</span>}
          {APRESENTACAO[emp.slug] && <a className="btn pri" href={`https://${emp.slug}.detailhub.com.br/`} target="_blank" rel="noopener">Abrir {emp.slug}.detailhub.com.br</a>}
          <Link className="btn" href={`/app/${emp.slug}`}>Área interna</Link>
          <form action={alternarAtiva}><input type="hidden" name="empresa_id" value={id} /><input type="hidden" name="ativa" value={emp.ativa ? '0' : '1'} />
            <button className={`btn ${emp.ativa ? 'perigo' : ''}`}>{emp.ativa ? 'Desativar empresa' : 'Reativar empresa'}</button></form>
        </div>
      </div>
      <Aviso erro={erro} ok={ok} />

      {APRESENTACAO[emp.slug] && (
        <section className="card" id="links">
          <div><h3>Links para o cliente</h3><span className="faint" style={{ fontSize: 12.5 }}>Gere e mande pelo WhatsApp.</span></div>
          <LinksCliente empresaId={id} slug={emp.slug} nome={emp.nome} cargoAdmin={cargoAdmin} />
          {!!links?.length && (<div>
            <span className="faint" style={{ fontSize: 12.5 }}>Links de visualização valendo agora</span>
            <table className="lista"><tbody>{links.map((l) => (
              <tr key={l.id}><td>Criado em {new Date(l.criado_em).toLocaleDateString('pt-BR')}</td><td>Vale até {new Date(l.expira_em).toLocaleDateString('pt-BR')}</td>
                <td>{l.acessos} abertura{l.acessos === 1 ? '' : 's'}{l.ultimo_acesso ? ` · última em ${new Date(l.ultimo_acesso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}` : ''}</td>
                <td style={{ textAlign: 'right' }}><form action={desativarLinkVer}><input type="hidden" name="link_id" value={l.id} /><input type="hidden" name="empresa_id" value={id} /><button className="btn sm perigo">Desativar</button></form></td></tr>))}
            </tbody></table></div>)}
        </section>
      )}

      <section className="card">
        <div className="card-h"><div><h3>Usuários</h3><span className="faint" style={{ fontSize: 12.5 }}>Quem acessa o sistema da {emp.nome}</span></div><span className="chip">{U.length}</span></div>
        {U.length ? (
          <div className="mx-wrap"><table className="lista"><thead><tr><th>Pessoa</th><th>Cargo</th><th>Vê</th><th>Acesso</th><th>Último acesso</th><th /></tr></thead>
            <tbody>{U.map((u) => (
              <tr key={u.user_id}>
                <td><b>{u.nome || u.email}</b><div className="faint" style={{ fontSize: 12.5 }}>{u.email}</div></td>
                <td colSpan={3}><form action={salvarUsuario} className="linha">
                  <input type="hidden" name="empresa_id" value={id} /><input type="hidden" name="user_id" value={u.user_id} /><input type="hidden" name="volta" value={volta} />
                  <select name="cargo_id" defaultValue={u.cargo_id} aria-label="Cargo">{C.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
                  <select name="escopo" defaultValue={u.escopo} aria-label="Vê os registros"><option value="todos">De todos</option><option value="proprios">Só os próprios</option></select>
                  <select name="ativo" defaultValue={u.ativo ? '1' : '0'} aria-label="Acesso"><option value="1">Ativo</option><option value="0">Bloqueado</option></select>
                  <button className="btn sm">Salvar</button>
                </form></td>
                <td>{quando(u.ultimo_acesso)}</td><td />
              </tr>))}</tbody></table></div>
        ) : <div className="vazio">Ninguém ainda. Adicione o administrador da {emp.nome} logo abaixo.</div>}

        {!!conv?.length && (<div>
          <span className="faint" style={{ fontSize: 12.5 }}>Adicionados que ainda não entraram</span>
          <table className="lista"><tbody>{conv.map((c) => (
            <tr key={c.id}><td><b>{c.nome || c.email}</b><div className="faint" style={{ fontSize: 12.5 }}>{c.email}</div></td><td>{nomeCargo.get(c.cargo_id)}</td>
              <td>{new Date(c.expira_em) < new Date() ? <span className="chip bad">Link expirado</span> : <span className="chip">Link vale até {new Date(c.expira_em).toLocaleDateString('pt-BR')}</span>}</td>
              <td style={{ textAlign: 'right' }}><form action={cancelarAcesso}><input type="hidden" name="convite_id" value={c.id} /><input type="hidden" name="volta" value={volta} /><button className="btn sm perigo">Cancelar</button></form></td></tr>))}
          </tbody></table></div>)}
      </section>

      <section className="card"><h3>Adicionar usuário</h3>
        <AdicionarUsuario empresaId={id} volta={volta} cargos={C.map(({ id, nome }) => ({ id, nome }))} />
        <span className="faint" style={{ fontSize: 12.5 }}>A pessoa recebe um e-mail para entrar na {emp.nome} e criar a senha. Para adicionar de novo alguém com o link vencido, é só adicionar outra vez.</span>
      </section>

      <section className="card">
        <div className="card-h"><div><h3>Cargos e permissões</h3><span className="faint" style={{ fontSize: 12.5 }}>{C.map((c) => `${c.nome} (${NIVEL_NOME[c.nivel as keyof typeof NIVEL_NOME].toLowerCase()})`).join(' · ')}</span></div>
          <Link className="btn sm" href={`/app/${emp.slug}/equipe`}>Configurar cargos</Link></div>
      </section>

      <section className="card" id="modulos">
        <div><h3>Módulos liberados</h3><span className="faint" style={{ fontSize: 12.5 }}>O que a {emp.nome} pode usar (plano contratado). Tirar daqui tira de todos na empresa, inclusive do administrador.</span></div>
        <div className="mx-wrap"><table className="mx">
          <thead><tr><th>Área</th>{ACOES.map((a) => <th key={a.codigo}>{a.nome}</th>)}</tr></thead>
          <tbody>{MODULOS.map((m) => (
            <tr key={m.codigo}><td style={{ ['--c' as string]: m.cor }}><i />{m.nome}</td>
              {ACOES.map((a) => { const on = t.has(chave(m.codigo, a.codigo)); return (
                <td key={a.codigo}><form action={alternarTeto}>
                  <input type="hidden" name="empresa_id" value={id} /><input type="hidden" name="modulo" value={m.codigo} />
                  <input type="hidden" name="acao" value={a.codigo} /><input type="hidden" name="ligar" value={on ? '0' : '1'} />
                  <button className={`cel ${on ? 'on' : ''}`} aria-pressed={on} aria-label={`${m.nome}: ${a.nome}`}>{on ? <Check /> : null}</button>
                </form></td>); })}
            </tr>))}</tbody>
        </table></div>
      </section>
    </>
  );
}
