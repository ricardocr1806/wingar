import Link from 'next/link';

export function Marca({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="marca" aria-label="DetailHub, início">
      <span className="marca-ic" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M3 15.5 5.2 10a3 3 0 0 1 2.8-2h8a3 3 0 0 1 2.8 2l2.2 5.5V18a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1H6.5v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" fill="currentColor"/><circle cx="7.5" cy="13.5" r="1.3" fill="var(--bg)"/><circle cx="16.5" cy="13.5" r="1.3" fill="var(--bg)"/></svg>
      </span>
      <span>Detail<b>Hub</b></span>
    </Link>
  );
}

export function Aviso({ erro, ok }: { erro?: string; ok?: string }) {
  if (erro) return <p className="msg erro" role="alert">{erro}</p>;
  if (ok) return <p className="msg ok" role="status">{ok}</p>;
  return null;
}

export const Cadeado = () => (
  <svg viewBox="0 0 14 14" aria-hidden="true"><rect x="3" y="6.5" width="8" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4"/><path d="M5 6.5V5a2 2 0 0 1 4 0v1.5" fill="none" stroke="currentColor" strokeWidth="1.4"/></svg>
);
export const Check = () => (
  <svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 7.5 6 10l5-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
