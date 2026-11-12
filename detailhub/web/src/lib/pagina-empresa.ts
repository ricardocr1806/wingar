import { APRESENTACAO } from '@/generated/apresentacao';

// Cada empresa abre o sistema com o próprio nome. A Wingard tem a versão dela (com o histórico);
// toda empresa nova usa a versão padrão, sem dados de ninguém.
const limpo = (t: string) => t.replace(/[^\p{L}\p{N} .&()\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 60);

export function paginaDaEmpresa(slug: string, nome: string): string {
  if (APRESENTACAO[slug]) return APRESENTACAO[slug];
  const n = limpo(nome) || limpo(slug.replace(/-/g, ' ')) || 'Empresa';
  return APRESENTACAO._padrao
    .split('__DH_EMPRESA_M__').join(n.toLocaleUpperCase('pt-BR'))
    .split('__DH_EMPRESA__').join(n)
    .split('__DH_SLUG__').join(slug.replace(/[^a-z0-9-]/g, ''));
}

export const temSistema = (slug: string) => !!(APRESENTACAO[slug] || APRESENTACAO._padrao);
