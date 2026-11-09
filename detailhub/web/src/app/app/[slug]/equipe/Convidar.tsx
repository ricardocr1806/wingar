'use client';
import { useActionState, useRef, useState } from 'react';
import { convidar, type EstadoConvite } from './actions';

export function Convidar({ slug, empresaId, cargos, acao = convidar, titulo = 'Convidar pessoa' }: {
  slug: string; empresaId: string; cargos: { id: string; nome: string }[];
  acao?: (s: EstadoConvite, f: FormData) => Promise<EstadoConvite>; titulo?: string;
}) {
  const [e, a, p] = useActionState<EstadoConvite, FormData>(acao, {});
  const [copiado, setCopiado] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <form action={a} className="campos">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="empresa_id" value={empresaId} />
      <div className="linha">
        <label>E-mail<input name="email" type="email" required placeholder="pessoa@empresa.com.br" /></label>
        {cargos.length > 1 ? (
          <label>Cargo<select name="cargo_id">{cargos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        ) : <input type="hidden" name="cargo_id" value={cargos[0]?.id ?? ''} />}
        {cargos.length > 1 && (
          <label>Vê os registros<select name="escopo"><option value="todos">De todos</option><option value="proprios">Só os próprios</option></select></label>
        )}
        <button className="btn pri" disabled={p}>{p ? 'Gerando…' : titulo}</button>
      </div>
      {e.erro && <p className="msg erro" role="alert">{e.erro}</p>}
      {e.link && (
        <div className="msg ok" role="status">
          Convite para {e.email} criado. Mande este link para a pessoa (vale 7 dias e só funciona com esse e-mail):
          <div className="copiar" style={{ marginTop: 8 }}>
            <input ref={ref} readOnly value={e.link} onFocus={(ev) => ev.currentTarget.select()} aria-label="Link do convite" />
            <button type="button" className="btn sm" onClick={async () => {
              try { await navigator.clipboard.writeText(e.link!); setCopiado(true); } catch { ref.current?.select(); }
            }}>{copiado ? 'Copiado' : 'Copiar'}</button>
          </div>
        </div>
      )}
    </form>
  );
}
