'use client';
import { useActionState, useRef, useState } from 'react';
import { gerarConviteAdmin, gerarLinkVer, type EstadoLink } from './links';

function Resultado({ e, aviso }: { e: EstadoLink; aviso: string }) {
  const [copiado, setCopiado] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  if (e.erro) return <p className="msg erro" role="alert">{e.erro}</p>;
  if (!e.link) return null;
  return (
    <div className="msg ok" role="status">{aviso}
      <div className="copiar" style={{ marginTop: 8 }}>
        <input ref={ref} readOnly value={e.link} onFocus={(ev) => ev.currentTarget.select()} aria-label="Link" />
        <button type="button" className="btn sm" onClick={async () => { try { await navigator.clipboard.writeText(e.link!); setCopiado(true); } catch { ref.current?.select(); } }}>{copiado ? 'Copiado' : 'Copiar'}</button>
      </div>
    </div>
  );
}

export function LinksCliente({ empresaId, slug, nome, cargoAdmin }: { empresaId: string; slug: string; nome: string; cargoAdmin: string }) {
  const [ev, av, pv] = useActionState<EstadoLink, FormData>(gerarLinkVer, {});
  const [ec, ac, pc] = useActionState<EstadoLink, FormData>(gerarConviteAdmin, {});
  return (
    <div className="grade">
      <div className="card" style={{ boxShadow: 'none' }}>
        <h3>1. Link para o cliente ver a plataforma</h3>
        <p className="muted" style={{ fontSize: 13.5 }}>Abre o sistema da {nome} direto, sem login. Use para apresentar. Vence sozinho e você pode desativar a qualquer momento.</p>
        <form action={av} className="linha">
          <input type="hidden" name="empresa_id" value={empresaId} /><input type="hidden" name="slug" value={slug} />
          <label>Vale por<select name="dias" defaultValue="7"><option value="1">1 dia</option><option value="3">3 dias</option><option value="7">7 dias</option><option value="15">15 dias</option><option value="30">30 dias</option></select></label>
          <button className="btn pri" disabled={pv}>{pv ? 'Gerando…' : 'Gerar link'}</button>
        </form>
        <Resultado e={ev} aviso="Link gerado. Mande para o cliente:" />
      </div>
      <div className="card" style={{ boxShadow: 'none' }}>
        <h3>2. Link para o administrador criar o acesso</h3>
        <p className="muted" style={{ fontSize: 13.5 }}>Quem abrir cria a própria conta e vira Administrador da {nome}. Depois ele mesmo adiciona a equipe. Vale 7 dias e só pode ser usado uma vez.</p>
        <form action={ac}>
          <input type="hidden" name="empresa_id" value={empresaId} /><input type="hidden" name="cargo_id" value={cargoAdmin} />
          <button className="btn pri" disabled={pc || !cargoAdmin}>{pc ? 'Gerando…' : 'Gerar link do administrador'}</button>
        </form>
        <Resultado e={ec} aviso="Link gerado. Mande para o responsável da empresa:" />
      </div>
    </div>
  );
}
