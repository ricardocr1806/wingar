'use client';
import { useActionState } from 'react';
import { CampoSenha } from '@/app/CampoSenha';
import { criarAcessoPeloConvite, type EstadoCriar } from './actions';

export function CriarAcesso({ token, empresa, cargo }: { token: string; empresa: string; cargo: string }) {
  const [e, acao, p] = useActionState<EstadoCriar, FormData>(criarAcessoPeloConvite, {});
  if (e.ok) return (
    <div className="auth-card">
      <h3 style={{ margin: 0 }}>Falta só confirmar o seu e-mail</h3>
      <p>Enviamos um link para <b>{e.email}</b>. Abra o e-mail e clique em <b>confirmar</b>: você entra direto no sistema da {empresa}.</p>
      <p className="faint" style={{ fontSize: 13 }}>Não chegou? Olhe no spam ou na aba Promoções.</p>
    </div>);
  return (
    <form action={acao} className="auth-card campos">
      <input type="hidden" name="token" value={token} />
      <p style={{ margin: 0 }}>Crie seu acesso de <b>{cargo}</b> da <b>{empresa}</b>.</p>
      <label>Seu nome<input name="nome" autoComplete="name" required minLength={2} /></label>
      <label>Seu e-mail<input name="email" type="email" autoComplete="email" required /></label>
      <label>Crie uma senha<CampoSenha name="senha" autoComplete="new-password" minLength={8} />
        <span className="dica">Pelo menos 8 caracteres, com letras e números.</span></label>
      <button className="btn pri" disabled={p}>{p ? 'Criando…' : 'Criar meu acesso'}</button>
      {e.erro && <p className="msg erro" role="alert">{e.erro}</p>}
    </form>
  );
}
