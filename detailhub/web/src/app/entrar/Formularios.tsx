'use client';
import { useActionState, useState } from 'react';
import { cadastrar, entrar, recuperar, entrarComGoogle, type Estado } from './actions';

type Modo = 'entrar' | 'cadastrar' | 'recuperar';

export function Formularios({ next, erroGoogle }: { next: string; erroGoogle: boolean }) {
  const [modo, setModo] = useState<Modo>('entrar');
  const [eE, aE, pE] = useActionState<Estado, FormData>(entrar, {});
  const [eC, aC, pC] = useActionState<Estado, FormData>(cadastrar, {});
  const [eR, aR, pR] = useActionState<Estado, FormData>(recuperar, {});
  const est = modo === 'entrar' ? eE : modo === 'cadastrar' ? eC : eR;

  return (
    <div className="auth-card">
      <div className="auth-tabs" role="tablist">
        <button role="tab" aria-selected={modo === 'entrar'} onClick={() => setModo('entrar')}>Entrar</button>
        <button role="tab" aria-selected={modo === 'cadastrar'} onClick={() => setModo('cadastrar')}>Criar conta</button>
      </div>

      {modo !== 'recuperar' && (
        <>
          <form action={entrarComGoogle}>
            <input type="hidden" name="next" value={next} />
            <button className="btn google" type="submit">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6c-.3 1.4-1 2.6-2.2 3.4v2.8h3.6c2.1-1.9 3.2-4.8 3.2-8.3z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.9C3.8 20.5 7.6 23 12 23z"/><path fill="#FBBC05" d="M5.7 14c-.2-.7-.4-1.4-.4-2s.1-1.4.4-2V7.1H2C1.4 8.6 1 10.2 1 12s.4 3.4 1 4.9L5.7 14z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2C17.5 2.1 15 1 12 1 7.6 1 3.8 3.5 2 7.1L5.7 10c.9-2.7 3.4-4.6 6.3-4.6z"/></svg>
              Continuar com Google
            </button>
          </form>
          {erroGoogle && <p className="msg erro">Não foi possível entrar com o Google. Tente de novo.</p>}
          <div className="ou"><span>ou com e-mail</span></div>
        </>
      )}

      {modo === 'entrar' && (
        <form action={aE} className="campos">
          <input type="hidden" name="next" value={next} />
          <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
          <label>Senha<input name="senha" type="password" autoComplete="current-password" required /></label>
          <button className="btn pri" disabled={pE}>{pE ? 'Entrando…' : 'Entrar'}</button>
          <button type="button" className="link" onClick={() => setModo('recuperar')}>Esqueci minha senha</button>
        </form>
      )}
      {modo === 'cadastrar' && (
        <form action={aC} className="campos">
          <input type="hidden" name="next" value={next} />
          <label>Nome completo<input name="nome" autoComplete="name" required /></label>
          <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
          <label>Senha<input name="senha" type="password" autoComplete="new-password" minLength={8} required />
            <span className="dica">Pelo menos 8 caracteres, com letras e números.</span></label>
          <button className="btn pri" disabled={pC}>{pC ? 'Criando…' : 'Criar conta'}</button>
        </form>
      )}
      {modo === 'recuperar' && (
        <form action={aR} className="campos">
          <p className="muted">Informe o e-mail da conta. Vamos mandar um link para criar uma senha nova.</p>
          <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
          <button className="btn pri" disabled={pR}>{pR ? 'Enviando…' : 'Enviar link'}</button>
          <button type="button" className="link" onClick={() => setModo('entrar')}>Voltar para entrar</button>
        </form>
      )}
      {est.erro && <p className="msg erro" role="alert">{est.erro}</p>}
      {est.ok && <p className="msg ok" role="status">{est.ok}</p>}
    </div>
  );
}
