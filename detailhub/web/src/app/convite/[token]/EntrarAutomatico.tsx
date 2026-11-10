'use client';
import { useEffect, useRef } from 'react';
import { aceitar } from './actions';

/** Quem volta do e-mail de confirmação já entra na empresa sem precisar clicar de novo. */
export function EntrarAutomatico({ token, empresa }: { token: string; empresa: string }) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { ref.current?.requestSubmit(); }, []);
  return (
    <form ref={ref} action={aceitar} className="auth-card">
      <input type="hidden" name="token" value={token} />
      <p>Entrando no sistema da <b>{empresa}</b>…</p>
      <button className="btn pri">Entrar na {empresa}</button>
    </form>
  );
}
