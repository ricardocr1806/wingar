// Gera src/generated/apresentacao.ts com a versão de apresentação de cada empresa (arquivos em private/<slug>.html).
// Esses arquivos têm dados de clientes: ficam fora do Git (.gitignore) e só são servidos com login.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
const raiz = new URL('../', import.meta.url).pathname;
const dir = raiz + 'private/';
const paginas = {};

// Liga a versão de apresentação ao acesso real: quando a página recebe window.DH_ACESSO (pessoa logada),
// mostra só as áreas liberadas para o cargo dela, troca o "Acessando como" pelo nome real e põe o atalho de Configurações.
const TROCAS = [
  // aviso interno do protótipo: não aparece para o cliente
  ['<div class="demo"><b>Protótipo</b>Histórico real importado do CRM (1.031 negócios). O que for alterado aqui não é salvo.</div>', ''],
  ['/* ---------- registros ---------- */',
   `if (window.DH_ACESSO) { for (const k of Object.keys(DEPTS)) if (!window.DH_ACESSO.modulos.includes(k)) delete DEPTS[k]; }
/* ---------- registros ---------- */`],
  ['function go(dept, view, sel){',
   `function go(dept, view, sel){
  if (dept && !DEPTS[dept]) { toast('Seu acesso não inclui essa área.', 'bad'); return; }`],
  ['function renderNav(){',
   `if (window.DH_ACESSO) { const k0 = Object.keys(DEPTS)[0]; if (k0 && !DEPTS[S.dept]) { S.dept = k0; S.view = DEPTS[k0].menu[0][0]; } S.perfil = window.DH_ACESSO.admin ? 'admin' : 'equipe'; }
function renderNav(){`],
  ["  $('#who').innerHTML = `<span class=\"av solid\">${ini(d.user)}</span><div><b>${d.user}</b><span>${d.papel}</span></div>`;",
   `  $('#who').innerHTML = \`<span class="av solid">\${ini(d.user)}</span><div><b>\${d.user}</b><span>\${d.papel}</span></div>\`;
  if (window.DH_ACESSO) { const A = window.DH_ACESSO;
    $('#perfil').innerHTML = (A.configurar ? \`<a class="btn sm" href="\${A.configurar}" style="width:100%;justify-content:center">Configurações</a>\` : '') + \`<form action="/sair" method="post" style="margin-top:8px"><button class="btn sm ghost" style="width:100%">Sair</button></form>\`;
    $('#who').innerHTML = \`<span class="av solid">\${ini(A.nome)}</span><div><b>\${esc(A.nome)}</b><span>\${esc(A.cargo)}</span></div>\`; }`],
];
function adaptar(html) {
  for (const [de, para] of TROCAS) {
    if (!html.includes(de)) { console.warn('Aviso: trecho não encontrado na apresentação:', de.slice(0, 60)); continue; }
    html = html.replace(de, para);
  }
  return html.replace(/<body>/, '<body>');
}
if (existsSync(dir)) for (const f of readdirSync(dir)) if (f.endsWith('.html')) {
  const corpo = adaptar(readFileSync(dir + f, 'utf8'));
  paginas[f.replace(/\.html$/, '')] = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><!--DH_ACESSO--></head><body>${corpo}</body></html>`;
}
mkdirSync(raiz + 'src/generated', { recursive: true });
writeFileSync(raiz + 'src/generated/apresentacao.ts', `// Gerado por scripts/gerar-apresentacao.mjs. Não editar.\nexport const APRESENTACAO: Record<string, string> = ${JSON.stringify(paginas)};\n`);
console.log('Apresentações:', Object.keys(paginas).join(', ') || 'nenhuma');
