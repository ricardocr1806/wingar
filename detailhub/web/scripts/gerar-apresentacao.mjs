// Gera src/generated/apresentacao.ts com a versão de apresentação de cada empresa (arquivos em private/<slug>.html).
// Esses arquivos têm dados de clientes: ficam fora do Git (.gitignore) e só são servidos com login.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
const raiz = new URL('../', import.meta.url).pathname;
const dir = raiz + 'private/';
const paginas = {};

// Liga a versão de apresentação ao acesso real: quando a página recebe window.DH_ACESSO (pessoa logada),
// mostra só as áreas liberadas para o cargo dela, troca o "Acessando como" pelo nome real e põe o atalho de Configurações.
const TROCAS = [
  ["let nextOS = 1, nextId = 1;", "const dhNovoId = p => p + (Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 5)).toUpperCase(); let nextOS = 1, nextId = 1;"],
  ["'A'+String(nextId++).padStart(2,'0')", "dhNovoId('A')", true],
  ["const novoCli = () => ({id:'C'+String(nextCli++).padStart(4,'0'),", "const novoCli = () => ({id:dhNovoId('C'),"],
  // Centros de custo da Wingard (contas a pagar e DRE)
  ["const CATS_PAGAR = ['Materiais','Pessoal','Ocupação','Marketing','Administrativo','Impostos','Financeiro','Outros'];",
   "const CATS_PAGAR = ['Diretoria','Operacional','Marketing','Comercial','CMV','Cartão de Crédito','Escritório Central'];"],
  [`const REGRAS_CAT = [
  ['Impostos',['das','simples','imposto','iss','icms','irpj','csll','pis','cofins','darf','inss','fgts','taxa municipal','iptu']],
  ['Pessoal',['folha','salario','comissao','pro-labore','pro labore','ferias','13','vale transporte','vale refeicao','beneficio','rescisao']],
  ['Ocupação',['aluguel','condominio','energia','luz','enel','agua','sabesp','internet','telefone','limpeza','seguranca','manutencao predial']],
  ['Materiais',['ppf','pelicula','bobina','rolo','material','produto','vonixx','filme','vinil','ferramenta','insumo']],
  ['Marketing',['anuncio','meta ads','facebook','instagram','google ads','marketing','publicidade','agencia','brinde','evento']],
  ['Financeiro',['tarifa','juros','emprestimo','financiamento','iof','maquininha','taxa de cartao','banco']],
  ['Administrativo',['contab','honorario','sistema','software','assinatura','escritorio','advogad','juridico','correios']],
];`,
   `const REGRAS_CAT = [
  ['Cartão de Crédito',['cartao de credito','fatura do cartao','fatura cartao','nubank','itaucard','bradescard','cartao corporativo','anuidade']],
  ['CMV',['ppf','pelicula','bobina','rolo','material','produto','vonixx','filme','vinil','insumo','mercadoria']],
  ['Marketing',['anuncio','meta ads','meta','facebook','instagram','google ads','google','marketing','publicidade','agencia','trafego','brinde','evento']],
  ['Comercial',['comissao','vendedor','vendas','crm','prospeccao','representante']],
  ['Diretoria',['pro-labore','pro labore','prolabore','retirada','socio','diretoria','distribuicao de lucro']],
  ['Operacional',['folha','salario','ferias','13','vale transporte','vale refeicao','beneficio','rescisao','ferramenta','equipamento','manutencao','combustivel','frete','lavagem','aplicador']],
  ['Escritório Central',['aluguel','condominio','energia','luz','enel','agua','sabesp','internet','telefone','limpeza','seguranca','contab','honorario','sistema','software','assinatura','escritorio','advogad','juridico','correios','das','simples','imposto','iss','icms','darf','inss','fgts','iptu','tarifa','juros','emprestimo','financiamento','iof','maquininha','taxa de cartao','banco']],
];`],
  ["  return 'Outros';\n}\nconst assinatura", "  return 'Escritório Central';\n}\nconst assinatura"],
  ["  const mat = cat('Materiais'), lucroB = liq-mat;\n  const desp = CATS_PAGAR.filter(c=>c!=='Materiais').map(c=>[c, cat(c)]);",
   "  const mat = cat('CMV'), lucroB = liq-mat;\n  const desp = CATS_PAGAR.filter(c=>c!=='CMV').map(c=>[c, cat(c)]);"],
  ["line('Materiais aplicados (PPF, películas, produtos)', mat, 'ind', true)", "line('CMV · custo da mercadoria vendida (PPF, películas, produtos)', mat, 'ind', true)"],
  ["validaLinha({desc:'', forn:'', cat:'Outros',", "validaLinha({desc:'', forn:'', cat:'Escritório Central',"],
  ['<label for="np-c">Categoria</label>', '<label for="np-c">Centro de custo</label>'],
  ['<h3>Gastos por categoria</h3>', '<h3>Gastos por centro de custo</h3>'],
  ['<th>Categoria</th>', '<th>Centro de custo</th>', true],
  ['<td>${p.pago?`<button class="btn sm ghost" data-a="pagar" data-i="${i}">Desfazer</button>`:`<button class="btn sm" data-a="pagar" data-i="${i}">Marcar como paga</button>`}</td></tr>`',
   '<td style="white-space:nowrap">${p.pago?`<button class="btn sm ghost" data-a="pagar" data-i="${i}">Desfazer</button>`:`<button class="btn sm" data-a="pagar" data-i="${i}">Marcar como paga</button>`} <button class="btn sm ghost" data-a="pgEditar" data-i="${i}" aria-label="Editar conta">${ico(\'edit\')}Editar</button></td></tr>`'],
  ['<span class="av solid" title="${d.user}">${ini(d.user)}</span>',
   '<span class="av solid" title="${esc((window.DH_ACESSO || window.DH_VITRINE || {}).nome || d.user)}">${ini((window.DH_ACESSO || window.DH_VITRINE || {}).nome || d.user)}</span>'],
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
    $('#perfil').innerHTML = (A.configurar ? \`<button class="btn sm" data-a="cfgAbrir" style="width:100%;justify-content:center">+ Adicionar colaborador</button>\` : '') + \`<form action="/sair" method="post" style="margin-top:8px"><button class="btn sm ghost" style="width:100%">Sair</button></form>\`;
    $('#who').innerHTML = \`<span class="av solid">\${ini(A.nome)}</span><div><b>\${esc(A.nome)}</b><span>\${esc(A.cargo)}</span></div>\`; }
  else if (window.DH_VITRINE) { const V = window.DH_VITRINE; $('#perfil').innerHTML = \`<button class="btn sm" data-a="cfgAbrir" style="width:100%;justify-content:center">+ Adicionar colaborador</button>\`; $('#who').innerHTML = \`<span class="av solid">\${ini(V.nome)}</span><div><b>\${esc(V.nome)}</b><span>\${esc(V.cargo)}</span></div>\`; }`],
];
function adaptar(html, extras = []) {
  for (const [de, para, todos] of [...TROCAS, ...extras]) {
    if (!html.includes(de)) { console.warn('Aviso: trecho não encontrado na apresentação:', de.slice(0, 60)); continue; }
    html = todos ? html.split(de).join(para) : html.replace(de, para);
  }
  const extra = ['config-na-apresentacao.js', 'pagar-na-apresentacao.js', 'sincronizar-na-apresentacao.js'].map((f) => readFileSync(raiz + 'scripts/' + f, 'utf8')).join('\n');
  return html + `\n<script>\n${extra}\n</script>\n`;
}
if (existsSync(dir)) for (const f of readdirSync(dir)) if (f.endsWith('.html')) {
  const corpo = adaptar(readFileSync(dir + f, 'utf8'));
  paginas[f.replace(/\.html$/, '')] = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><!--DH_ACESSO--></head><body>${corpo}</body></html>`;
}
// Versão padrão para toda empresa nova criada no painel: o mesmo sistema, com o nome da empresa
// (trocado na hora de abrir) e sem nenhum dado da Wingard (histórico, clientes, catálogo, equipe).
if (existsSync(dir + 'wingard.html')) {
  const base = readFileSync(dir + 'wingard.html', 'utf8');
  const hist = /HISTDATA = \{.*\};/.exec(base)[0];
  const equipe = /const EQUIPE = \[.*?\];/.exec(base)[0];
  const PADRAO = [
    ["const HOJE = '2026-11-03';", "const HOJE = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo'}).format(new Date()); window.DH_DATA_REAL = true;"],
    [hist, 'HISTDATA = {"cat":[["000","Produto não informado",0,"s"]],"cli":[],"neg":[],"osmax":0};'],
    ["const APLICADORES = ['Diego Martins','Felipe Souza','Lucas Pereira','Rogério Lima'];\nconst TECNICOS = ['William Santos','Diego Martins'];", "const APLICADORES = []; const TECNICOS = [];"],
    [equipe, "const EQUIPE = []; function dhEquipe(){ const n = EQUIPE.map(p=>p.nome), t = EQUIPE.filter(p=>/t[ée]cnic|respons/i.test(p.funcao)).map(p=>p.nome); APLICADORES.splice(0, APLICADORES.length, ...n); TECNICOS.splice(0, TECNICOS.length, ...(t.length ? t : n)); }"],
    ["[...TECNICOS,...APLICADORES.slice(1)]", "EQUIPE.map(p=>p.nome)", true],
    ["EQUIPE.splice(0, EQUIPE.length, ...L); fecharDlg();", "EQUIPE.splice(0, EQUIPE.length, ...L); dhEquipe(); fecharDlg();"],
    ["relIniciar: a => { const r = DB.find", "relIniciar: a => { if (!EQUIPE.length){ toast('Cadastre primeiro a equipe da operação.','warn'); return ACT.equipeEditar(); } const r = DB.find"],
    ["${S.prodDemo ? '' : `<button class=\"btn pri\" data-a=\"prodDemo\">", "${S.prodDemo || window.DH_ACESSO ? '' : `<button class=\"btn pri\" data-a=\"prodDemo\">"],
    ["user:'Letícia Siciliano', papel:'Consultora'", "user:'Equipe Comercial', papel:'Comercial'"],
    ["user:'William Santos', papel:'Responsável técnico'", "user:'Equipe Operacional', papel:'Operacional'"],
    ["user:'Tatiane Moura', papel:'Financeiro'", "user:'Equipe Financeiro', papel:'Financeiro'"],
    ["const ORIGENS = [", "if (!CONSULTORES.length) CONSULTORES.push(((window.DH_ACESSO||window.DH_VITRINE||{}).nome) || 'Consultor');\nconst ORIGENS = ["],
    ["(r.linha==='bobina' ? x.linha==='bobina' : x.linha!=='bobina'));", "(r.linha==='bobina' ? x.linha==='bobina' : x.linha!=='bobina')); if (!c) return toast('Cadastre primeiro um serviço no menu Serviços.','warn');"],
  ];
  let h = adaptar(base, PADRAO);
  h = h.split('https://wingard.detailhub.com.br/').join('https://__DH_SLUG__.detailhub.com.br/')
       .split('wingard_modelos_pagar').join('dh_modelos_pagar')
       .split('Wingard').join('__DH_EMPRESA__').split('WINGARD').join('__DH_EMPRESA_M__');
  if (/wingard/i.test(h.replace(/__DH_[A-Z_]+__/g, ''))) console.warn('Aviso: a versão padrão ainda cita a Wingard');
  paginas._padrao = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><!--DH_ACESSO--></head><body>${h}</body></html>`;
}
mkdirSync(raiz + 'src/generated', { recursive: true });
// Versão desta publicação: as abas abertas comparam com a do servidor e se atualizam sozinhas.
const VERSAO = new Date().toISOString();
for (const k of Object.keys(paginas)) paginas[k] = paginas[k].replace('<!--DH_ACESSO-->', `<script>window.DH_VERSAO=${JSON.stringify(VERSAO)}</script><!--DH_ACESSO-->`);
writeFileSync(raiz + 'src/generated/apresentacao.ts', `// Gerado por scripts/gerar-apresentacao.mjs. Não editar.\nexport const VERSAO = ${JSON.stringify(VERSAO)};\nexport const APRESENTACAO: Record<string, string> = ${JSON.stringify(paginas)};\n`);
console.log('Apresentações:', Object.keys(paginas).join(', ') || 'nenhuma');
