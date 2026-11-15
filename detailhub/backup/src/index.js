// Backup diário: pede ao banco a cópia completa (função backup_completo, só a chave de serviço consegue),
// compacta e guarda no R2. Mantém 35 cópias diárias e uma por mês para sempre (dia 1º).
const DIAS = 35;

async function fazerBackup(env) {
  const chave = env.SUPABASE_SERVICE_KEY;
  if (!chave) throw new Error('Falta o segredo SUPABASE_SERVICE_KEY no Worker detailhub-backup.');
  const cab = { apikey: chave, 'content-type': 'application/json' };
  if (!chave.startsWith('sb_')) cab.authorization = `Bearer ${chave}`; // chave antiga (JWT)
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/backup_completo`, { method: 'POST', headers: cab, body: '{}' });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Banco respondeu ${r.status}: ${texto.slice(0, 300)}`);
  const dados = JSON.parse(texto);
  if (dados.formato !== 'detailhub-backup-1' || !dados.tabelas) throw new Error('Cópia em formato inesperado.');

  const gz = await new Response(new Blob([texto]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  const dia = new Date().toISOString().slice(0, 10);
  const resumo = Object.fromEntries(Object.entries(dados.tabelas).map(([t, l]) => [t, String(l.length)]));
  const meta = { httpMetadata: { contentType: 'application/gzip' }, customMetadata: { ...resumo, usuarios: String(dados.usuarios.length), bytes: String(texto.length) } };
  await env.BACKUPS.put(`diario/${dia}.json.gz`, gz, meta);
  if (dia.endsWith('-01') || !(await env.BACKUPS.head(`mensal/${dia.slice(0, 7)}.json.gz`))) await env.BACKUPS.put(`mensal/${dia.slice(0, 7)}.json.gz`, gz, meta);

  // apaga só cópias diárias com mais de 35 dias (as mensais ficam)
  const limite = new Date(Date.now() - DIAS * 864e5).toISOString().slice(0, 10);
  let cursor;
  do {
    const l = await env.BACKUPS.list({ prefix: 'diario/', cursor });
    for (const o of l.objects) if (o.key.slice(7, 17) < limite) await env.BACKUPS.delete(o.key);
    cursor = l.truncated ? l.cursor : undefined;
  } while (cursor);
  return { dia, bytes: texto.length, compactado: gz.byteLength, tabelas: resumo, usuarios: dados.usuarios.length };
}

export default {
  async scheduled(_evento, env, ctx) {
    ctx.waitUntil(fazerBackup(env).then((r) => console.log('Backup feito', JSON.stringify(r))));
  },
};
