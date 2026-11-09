/** Aceita só caminhos internos, para ninguém usar o login como redirecionamento para outro site. */
export function destinoSeguro(v: unknown, padrao = '/app'): string {
  const s = typeof v === 'string' ? v : '';
  return s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/\\') ? s : padrao;
}
