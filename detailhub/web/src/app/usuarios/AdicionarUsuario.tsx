'use client';
import { useActionState, useRef, useState } from 'react';
import { adicionarUsuario, type EstadoAcesso } from './actions';

export function AdicionarUsuario({ empresaId, cargos, volta }: {
  empresaId: string; cargos: { id: string; nome: string }[]; volta: string;
}) {
  const [e, acao, p] = useActionState<EstadoAcesso, FormData>(adicionarUsuario, {});
  const [copiado, setCopiado] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  if (!cargos.length) return <p className="muted">Crie um cargo primeiro para poder adicionar pessoas.</p>;
  return (
    <form action={acao} className="campos" key={e.link ?? 'novo'}>
      <input type="hidden" name="empresa_id" value={empresaId} />
      <input type="hidden" name="volta" value={volta} />
      <div className="linha">
        <label>Nome<input name="nome" required minLength={2} placeholder="Nome da pessoa" autoComplete="off" /></label>
        <label>E-mail<input name="email" type="email" required placeholder="pessoa@empresa.com.br" autoComplete="off" /></label>
        <label>Área<select name="cargo_id">{cargos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
      </div>
      <div className="linha" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <label className="ck"><input type="checkbox" name="enviar" defaultChecked /> Mandar o acesso por e-mail agora</label>
        <button className="btn pri" disabled={p}>{p ? 'Adicionando…' : 'Adicionar usuário'}</button>
      </div>
      {e.erro && <p className="msg erro" role="alert">{e.erro}</p>}
      {e.link && (
        <div className="msg ok" role="status">
          <b>{e.nome}</b> foi adicionado. {e.enviado ? `O acesso foi enviado para ${e.email}.` : ''} {e.aviso}
          <div style={{ marginTop: 6 }}>Se preferir, mande este link pelo WhatsApp (vale 7 dias e só funciona com {e.email}):</div>
          <div className="copiar" style={{ marginTop: 8 }}>
            <input ref={ref} readOnly value={e.link} onFocus={(ev) => ev.currentTarget.select()} aria-label="Link de acesso" />
            <button type="button" className="btn sm" onClick={async () => {
              try { await navigator.clipboard.writeText(e.link!); setCopiado(true); } catch { ref.current?.select(); }
            }}>{copiado ? 'Copiado' : 'Copiar link'}</button>
          </div>
        </div>
      )}
    </form>
  );
}
