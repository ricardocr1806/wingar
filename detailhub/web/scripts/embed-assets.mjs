// Embute os arquivos estáticos (.open-next/assets) dentro do próprio Worker.
//
// Por quê: o envio de "Workers Static Assets" usa um token temporário próprio, e o proxy do ambiente
// de desenvolvimento troca esse token pela chave da conta, então a Cloudflare recusa o envio. Com os
// arquivos embutidos, o deploy só precisa da chave da conta. São ~1 MB, bem abaixo do limite do Worker.
// Quando o deploy passar a ser feito por CI (GitHub Actions ou Workers Builds), dá para voltar ao
// "assets" nativo do wrangler e apagar este script.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const RAIZ = new URL('../.open-next/', import.meta.url).pathname;
const ASSETS = join(RAIZ, 'assets');
const TIPOS = {
  '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
};

const arquivos = {};
(function andar(dir) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) andar(p);
    else arquivos['/' + relative(ASSETS, p).split('\\').join('/')] =
      [TIPOS[extname(p).toLowerCase()] ?? 'application/octet-stream', readFileSync(p).toString('base64')];
  }
})(ASSETS);

writeFileSync(join(RAIZ, 'embedded-assets.mjs'), `export const FILES = ${JSON.stringify(arquivos)};\n`);
writeFileSync(join(RAIZ, 'worker-embedded.mjs'), `import worker from './worker.js';
import { FILES } from './embedded-assets.mjs';

const cache = new Map();
function servir(pathname) {
  const f = FILES[pathname];
  if (!f) return null;
  let corpo = cache.get(pathname);
  if (!corpo) { corpo = Uint8Array.from(atob(f[1]), (c) => c.charCodeAt(0)); cache.set(pathname, corpo); }
  const imutavel = pathname.startsWith('/_next/static/');
  return new Response(corpo, { headers: {
    'content-type': f[0],
    'cache-control': imutavel ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
    'x-content-type-options': 'nosniff',
  } });
}
const ASSETS = { fetch: async (r) => servir(new URL(typeof r === 'string' ? r : r.url).pathname) ?? new Response('Not found', { status: 404 }) };

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (request.method === 'GET' || request.method === 'HEAD') {
      const r = pathname !== '/BUILD_ID' && servir(pathname);
      if (r) return r;
    }
    return worker.fetch(request, Object.assign(Object.create(env), { ASSETS }), ctx);
  },
};
`);
console.log(`Embutidos ${Object.keys(arquivos).length} arquivos estáticos no Worker.`);
