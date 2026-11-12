/** Aceita só caminhos internos ou endereços das empresas no DetailHub (ex.: https://wingard.detailhub.com.br/). */
export function destinoSeguro(v: unknown, padrao = '/app'): string {
  const s = typeof v === 'string' ? v : '';
  if (s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/\\')) return s;
  if (/^https:\/\/[a-z0-9-]+\.detailhub\.com\.br\/[^\s]*$/.test(s)) return s;
  return padrao;
}

/** Para onde mandar quem é de uma empresa: o endereço próprio dela, se houver versão de apresentação, ou a área interna. */
// Empresas com endereço próprio já ligado no Cloudflare. As demais abrem pelo endereço principal
// até o endereço *.detailhub.com.br ser liberado no DNS.
export const COM_SUBDOMINIO = new Set(['wingard']);
const BASE = 'https://detailhub.com.br';

export function inicioDaEmpresa(slug: string, temApresentacao: boolean): string {
  if (!temApresentacao) return `/app/${slug}`;
  return COM_SUBDOMINIO.has(slug) ? `https://${slug}.detailhub.com.br/` : `${BASE}/apresentacao?empresa=${encodeURIComponent(slug)}`;
}

/** Endereço onde ficam os links da empresa (convite, visualização). */
export const enderecoDaEmpresa = (slug: string) => (COM_SUBDOMINIO.has(slug) ? `https://${slug}.detailhub.com.br` : BASE);
