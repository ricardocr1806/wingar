export const MODULOS = [
  { codigo: 'comercial', nome: 'Comercial', cor: 'var(--com)' },
  { codigo: 'operacional', nome: 'Operacional', cor: 'var(--ope)' },
  { codigo: 'financeiro', nome: 'Financeiro', cor: 'var(--fin)' },
  { codigo: 'equipe', nome: 'Equipe e cargos', cor: 'var(--acc)' },
] as const;
export const ACOES = [
  { codigo: 'ver', nome: 'Ver' },
  { codigo: 'editar', nome: 'Criar e editar' },
  { codigo: 'excluir', nome: 'Excluir' },
  { codigo: 'aprovar', nome: 'Aprovar' },
  { codigo: 'exportar', nome: 'Exportar' },
] as const;

export type Cargo = { id: string; nome: string; nivel: 'admin_empresa' | 'admin_area' | 'equipe'; pai_id: string | null };
export type Perm = { cargo_id: string; modulo: string; acao: string };
export const chave = (m: string, a: string) => `${m}:${a}`;

/** Permissões efetivas de cada cargo: as dele ∩ as efetivas do pai ∩ teto da empresa (mesma regra do banco). */
export function efetivas(cargos: Cargo[], perms: Perm[], teto: Set<string>): Map<string, Set<string>> {
  const proprias = new Map<string, Set<string>>();
  for (const p of perms) {
    if (!proprias.has(p.cargo_id)) proprias.set(p.cargo_id, new Set());
    proprias.get(p.cargo_id)!.add(chave(p.modulo, p.acao));
  }
  const memo = new Map<string, Set<string>>();
  const porId = new Map(cargos.map((c) => [c.id, c]));
  const calc = (id: string, prof = 0): Set<string> => {
    if (memo.has(id)) return memo.get(id)!;
    const c = porId.get(id);
    const own = proprias.get(id) ?? new Set<string>();
    const pai = c?.pai_id && prof < 10 ? calc(c.pai_id, prof + 1) : teto;
    const r = new Set([...own].filter((k) => pai.has(k) && teto.has(k)));
    memo.set(id, r);
    return r;
  };
  cargos.forEach((c) => calc(c.id));
  return memo;
}

export const NIVEL_NOME = { admin_empresa: 'Administrador da empresa', admin_area: 'Administrador de área', equipe: 'Cargo' } as const;
