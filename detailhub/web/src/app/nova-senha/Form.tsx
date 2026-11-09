'use client';
import { useActionState } from 'react';
import { definirSenha, type Estado } from '../entrar/actions';
import { CampoSenha } from '../CampoSenha';

export function FormNovaSenha({ next }: { next: string }) {
  const [e, a, p] = useActionState<Estado, FormData>(definirSenha, {});
  return (
    <form action={a} className="auth-card campos">
      <input type="hidden" name="next" value={next} />
      <label>Senha nova<CampoSenha name="senha" autoComplete="new-password" minLength={8} /></label>
      <label>Repita a senha<CampoSenha name="confirmar" autoComplete="new-password" minLength={8} /></label>
      <button className="btn pri" disabled={p}>{p ? 'Salvando…' : 'Salvar senha'}</button>
      {e.erro && <p className="msg erro" role="alert">{e.erro}</p>}
    </form>
  );
}
