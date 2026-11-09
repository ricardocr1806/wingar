// Gera src/generated/apresentacao.ts com a versão de apresentação de cada empresa (arquivos em private/<slug>.html).
// Esses arquivos têm dados de clientes: ficam fora do Git (.gitignore) e só são servidos com login.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
const raiz = new URL('../', import.meta.url).pathname;
const dir = raiz + 'private/';
const paginas = {};
if (existsSync(dir)) for (const f of readdirSync(dir)) if (f.endsWith('.html')) {
  const corpo = readFileSync(dir + f, 'utf8');
  paginas[f.replace(/\.html$/, '')] = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"></head><body>${corpo}</body></html>`;
}
mkdirSync(raiz + 'src/generated', { recursive: true });
writeFileSync(raiz + 'src/generated/apresentacao.ts', `// Gerado por scripts/gerar-apresentacao.mjs. Não editar.\nexport const APRESENTACAO: Record<string, string> = ${JSON.stringify(paginas)};\n`);
console.log('Apresentações:', Object.keys(paginas).join(', ') || 'nenhuma');
