'use client';
import { useState } from 'react';

/** Campo de senha com botão para mostrar ou esconder o que foi digitado. */
export function CampoSenha({ name, autoComplete, minLength }: { name: string; autoComplete: string; minLength?: number }) {
  const [ver, setVer] = useState(false);
  return (
    <span className="senha">
      <input name={name} type={ver ? 'text' : 'password'} autoComplete={autoComplete} minLength={minLength} required
        autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Esconder senha' : 'Mostrar senha'} aria-pressed={ver} title={ver ? 'Esconder senha' : 'Mostrar senha'}>
        {ver ? (
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.4 10.4 0 0 1 12 5c5 0 9 4.5 10 7-.4 1-1.3 2.4-2.6 3.7M6.6 6.6C4.5 8 3.1 10 2 12c1 2.5 5 7 10 7 1.6 0 3.1-.4 4.4-1.1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8"/></svg>
        )}
      </button>
    </span>
  );
}
