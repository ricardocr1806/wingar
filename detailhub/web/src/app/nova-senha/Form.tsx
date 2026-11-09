'use client';
import { useActionState } from 'react';
import { definirSenha, type Estado } from '../entrar/actions';

export function FormNovaSenha() {
  const [e, a, p] = useActionState<Estado, FormData>(definirSenha, {});
  return (
    <form action={a} className="auth-card campos">
      <label>Senha nova<input name="senha" type="password" autoComplete="new-password" minLength={8} required /></label>
      <label>Repita a senha<input name="confirmar" type="password" autoComplete="new-password" minLength={8} required /></label>
      <button className="btn pri" disabled={p}>{p ? 'Salvando…' : 'Salvar senha'}</button>
      {e.erro && <p className="msg erro" role="alert">{e.erro}</p>}
    </form>
  );
}
