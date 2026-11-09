/** Aceita só caminhos internos ou endereços das empresas no DetailHub (ex.: https://wingard.detailhub.com.br/). */
export function destinoSeguro(v: unknown, padrao = '/app'): string {
  const s = typeof v === 'string' ? v : '';
  if (s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/\\')) return s;
  if (/^https:\/\/[a-z0-9-]+\.detailhub\.com\.br\/[^\s]*$/.test(s)) return s;
  return padrao;
}

/** Para onde mandar quem é de uma empresa: o endereço próprio dela, se houver versão de apresentação, ou a área interna. */
export function inicioDaEmpresa(slug: string, temApresentacao: boolean): string {
  return temApresentacao ? `https://${slug}.detailhub.com.br/` : `/app/${slug}`;
}
