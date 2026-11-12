// Salva no banco tudo o que a equipe faz no sistema (vendas/atendimentos, clientes, catálogo, equipe e tempos ideais)
// e traz o que os colegas alteraram. Quando sai uma versão nova do sistema, a aba se atualiza sozinha
// (na hora em que ninguém está digitando) e volta para a mesma tela: nada do que foi lançado se perde.
// No link de visualização (sem login) nada é salvo.
(function () {
  const A = window.DH_ACESSO;
  if (!A || !A.slug) return;
  const API = `/api/empresas/${A.slug}/dados`;
  const VOLTA = 'dh_volta_' + A.slug;
  const temFin = !!(A.modulos && A.modulos.includes('financeiro'));

  // ---------- forma estável de comparar (o banco reordena as chaves) ----------
  const canon = (v) => {
    if (Array.isArray(v)) return '[' + v.map((x) => (x === undefined ? 'null' : canon(x))).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).filter((k) => v[k] !== undefined && typeof v[k] !== 'function').sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  };

  // ---------- do sistema para o banco ----------
  const clientesDe = () => { const m = new Map(); for (const r of DB) if (r.cliente && r.cliente.id) m.set(r.cliente.id, r.cliente); return m; };
  function atendimentoParaBanco(r) {
    const o = {};
    for (const k of Object.keys(r)) if (k !== 'cliente' && k !== 'veiculo') o[k] = r[k];
    o.cliente = r.cliente ? r.cliente.id : null;
    const i = r.cliente && r.cliente.veiculos ? r.cliente.veiculos.indexOf(r.veiculo) : -1;
    if (i >= 0) o.veiculoIdx = i; else if (r.veiculo) o.veiculoObj = r.veiculo;
    return o;
  }
  function fotografia() {
    const f = new Map();
    for (const [id, c] of clientesDe()) f.set('clientes|' + id, c);
    for (const r of DB) f.set('atendimentos|' + r.id, atendimentoParaBanco(r));
    for (const c of CATALOGO) f.set('catalogo|' + c.cod, c);
    f.set('config|equipe', { lista: EQUIPE });
    f.set('config|tempo_ideal', TEMPO_IDEAL);
    return f;
  }

  // ---------- do banco para o sistema ----------
  const soltos = new Map(); // clientes salvos que ainda não têm venda na tela
  function aplicar(registros) {
    const clis = clientesDe();
    const porColecao = { clientes: [], atendimentos: [], catalogo: [], config: [] };
    for (const g of registros) if (porColecao[g.colecao]) porColecao[g.colecao].push(g);
    for (const g of porColecao.clientes) {
      if (g.excluido) {
        for (let i = DB.length - 1; i >= 0; i--) if (DB[i].cliente && DB[i].cliente.id === g.id) DB.splice(i, 1);
        soltos.delete(g.id); continue;
      }
      const d = g.dados, c = clis.get(g.id) || soltos.get(g.id);
      if (!c) { soltos.set(g.id, { ...d, veiculos: (d.veiculos || []).map((v) => ({ ...v })) }); continue; }
      const velhos = c.veiculos || [];
      for (const k of Object.keys(c)) if (!(k in d)) delete c[k];
      Object.assign(c, { ...d, veiculos: (d.veiculos || []).map((v, i) => (velhos[i] ? Object.assign(velhos[i], v) : { ...v })) });
    }
    const todos = new Map([...soltos, ...clientesDe()]);
    for (const g of porColecao.atendimentos) {
      const i = DB.findIndex((r) => r.id === g.id);
      if (g.excluido) { if (i >= 0) DB.splice(i, 1); continue; }
      const d = { ...g.dados };
      let c = todos.get(d.cliente);
      if (!c) { c = { id: d.cliente || ('C' + g.id), nome: '', tel: '', email: '', cpf: '', nasc: '', end: '', veiculos: [] }; todos.set(c.id, c); }
      soltos.delete(c.id);
      let v = d.veiculoIdx != null ? c.veiculos[d.veiculoIdx] : null;
      if (!v) { v = d.veiculoObj || { modelo: '', placa: '', ano: '', cor: '', chassi: '' }; if (d.veiculoIdx != null || !c.veiculos.length) c.veiculos.push(v); }
      delete d.veiculoIdx; delete d.veiculoObj;
      d.cliente = c; d.veiculo = v;
      if (i >= 0) { const r = DB[i]; for (const k of Object.keys(r)) delete r[k]; Object.assign(r, d); }
      else DB.push(d);
    }
    for (const g of porColecao.catalogo) {
      const i = CATALOGO.findIndex((c) => c.cod === g.id);
      if (g.excluido) { if (i >= 0) CATALOGO.splice(i, 1); continue; }
      if (i >= 0) { const c = CATALOGO[i]; for (const k of Object.keys(c)) delete c[k]; Object.assign(c, g.dados); }
      else CATALOGO.push(g.dados);
    }
    for (const g of porColecao.config) {
      if (g.excluido) continue;
      if (g.id === 'equipe' && Array.isArray(g.dados.lista) && g.dados.lista.length) { EQUIPE.splice(0, EQUIPE.length, ...g.dados.lista); if (typeof dhEquipe === 'function') dhEquipe(); }
      if (g.id === 'tempo_ideal') Object.assign(TEMPO_IDEAL, g.dados);
    }
    DB.sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.id).localeCompare(String(a.id)));
    const maxNum = (arr, p) => Math.max(0, ...arr.map((x) => (new RegExp('^' + p + '(\\d+)$').exec(x) || [])[1]).filter(Boolean).map(Number));
    nextId = Math.max(nextId, maxNum(DB.map((r) => r.id), 'A') + 1);
    nextCli = Math.max(nextCli, maxNum([...todos.keys()], 'C') + 1);
    nextOS = Math.max(nextOS, 1 + Math.max(0, ...DB.map((r) => +r.os).filter((n) => n > 0 && n < 1e6)));
  }

  // ---------- estado da sincronização ----------
  let salvo = new Map();      // chave -> forma salva no banco
  let pronto = false, enviando = false, falhas = 0, ultimo = null, versaoNova = null, ultimaAcao = Date.now();
  const pendentesRemotos = [];
  const proibido = new Set(); // coleções que este cargo não pode alterar (não fica tentando de novo)

  const selo = document.createElement('div');
  selo.id = 'dh-sync';
  selo.style.cssText = 'position:fixed;right:16px;top:3px;z-index:60;font:11px/1.2 system-ui,sans-serif;padding:3px 9px;border-radius:999px;background:var(--card,#1b1d22);color:var(--muted,#9aa0a6);border:1px solid var(--line,#2a2d33);box-shadow:0 2px 8px rgba(0,0,0,.25);pointer-events:none;transition:opacity .3s';
  document.body.appendChild(selo);
  let seloT;
  function status(txt, tipo) {
    clearTimeout(seloT);
    selo.textContent = txt; selo.style.opacity = '1';
    selo.style.color = tipo === 'bad' ? '#e5484d' : tipo === 'ok' ? '#3fb950' : 'var(--muted,#9aa0a6)';
    if (tipo === 'ok') seloT = setTimeout(() => { selo.style.opacity = '0'; }, 2500);
  }

  const ocupado = () => {
    const el = document.activeElement;
    const digitando = el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !el.closest('#dlg[hidden]');
    const dialogo = !$('#dlg').hidden || !$('#modal').hidden || !$('#cv').hidden;
    return digitando || dialogo;
  };

  async function chamar(url, corpo) {
    const r = await fetch(url, corpo ? { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) } : { credentials: 'same-origin', cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (j.versao && window.DH_VERSAO && j.versao !== window.DH_VERSAO) versaoNova = j.versao;
    return { ok: r.ok, status: r.status, j };
  }

  // ---------- enviar o que mudou ----------
  async function salvar() {
    if (!pronto || enviando) return;
    const f = fotografia(), atual = new Map();
    for (const [k, v] of f) atual.set(k, canon(v));
    const mud = [];
    for (const [k, s] of atual) if (salvo.get(k) !== s) mud.push(k);
    for (const k of salvo.keys()) if (!atual.has(k) && !k.startsWith('config|')) mud.push(k);
    const enviar = mud.filter((k) => !proibido.has(k.split('|')[0]));
    if (!enviar.length) return;
    enviando = true; status('Salvando…');
    let erroMsg = '';
    try {
      const porCol = {};
      for (const k of enviar) { const col = k.split('|')[0]; (porCol[col] = porCol[col] || []).push(k); }
      for (const [col, ks] of Object.entries(porCol)) {
        for (let i = 0; i < ks.length; i += 300) {
          const lote = ks.slice(i, i + 300);
          const mudancas = lote.map((k) => { const id = k.slice(col.length + 1); return atual.has(k) ? { colecao: col, id, dados: JSON.parse(atual.get(k)) } : { colecao: col, id, excluido: true }; });
          const r = await chamar(API, { mudancas });
          if (r.ok) { for (const k of lote) atual.has(k) ? salvo.set(k, atual.get(k)) : salvo.delete(k); }
          else if (r.status === 403 || r.status === 400) { proibido.add(col); erroMsg = r.j.erro || 'Você não tem permissão para alterar isso.'; }
          else if (r.status === 401) { erroMsg = 'Sua sessão terminou. Entre de novo para salvar.'; throw new Error('401'); }
          else throw new Error('rede');
        }
      }
      falhas = 0;
      if (erroMsg) { status('Não salvo', 'bad'); toast(erroMsg, 'bad'); } else status('Salvo ✓', 'ok');
    } catch {
      falhas++;
      status(erroMsg || 'Sem conexão — vamos tentar de novo', 'bad');
      if (falhas === 3 && !erroMsg) toast('Sem conexão com a internet. O que você lançar fica guardado nesta aba e é salvo quando a conexão voltar. Não feche a aba.', 'bad');
    } finally { enviando = false; }
  }
  let tSalvar;
  const agendar = () => { ultimaAcao = Date.now(); clearTimeout(tSalvar); tSalvar = setTimeout(salvar, 700); };
  ['click', 'input', 'change', 'keyup'].forEach((ev) => document.addEventListener(ev, () => setTimeout(agendar, 0), true));

  // ---------- trazer o que os colegas mudaram ----------
  async function buscar(tudo) {
    const regs = [];
    let desde = tudo ? null : (ultimo ? new Date(Date.parse(ultimo) - 15000).toISOString() : null);
    for (let n = 0; n < 50; n++) {
      const r = await chamar(API + (desde ? '?desde=' + encodeURIComponent(desde) : ''));
      if (!r.ok) throw new Error(String(r.status));
      regs.push(...r.j.registros);
      for (const g of r.j.registros) if (!ultimo || g.atualizado_em > ultimo) ultimo = g.atualizado_em;
      if (!r.j.mais) break;
      desde = r.j.registros[r.j.registros.length - 1].atualizado_em;
    }
    return regs;
  }
  function novidades(regs) {
    const pend = new Set();
    const f = fotografia();
    for (const [k, v] of f) if (salvo.get(k) !== undefined && salvo.get(k) !== canon(v)) pend.add(k); // alterado aqui e ainda não salvo: o meu vale
    return regs.filter((g) => {
      const k = g.colecao + '|' + g.id;
      if (pend.has(k)) return false;
      const s = g.excluido ? undefined : canon(g.dados);
      if (salvo.get(k) === s) return false;
      return true;
    });
  }
  function marcarSalvo(regs) {
    for (const g of regs) { const k = g.colecao + '|' + g.id; if (g.excluido) salvo.delete(k); else salvo.set(k, canon(g.dados)); }
  }
  async function atualizarPagar() {
    if (!temFin || !$('#dlg').hidden) return false;
    const r = await chamar(`/api/empresas/${A.slug}/pagar`);
    if (!r.ok || !Array.isArray(r.j.contas)) return false;
    if (canon(r.j.contas) === canon(PAGAR)) return false;
    PAGAR.splice(0, PAGAR.length, ...r.j.contas); return true;
  }
  async function verificar() {
    if (!pronto) return;
    try {
      if (!enviando) {
        const regs = novidades(await buscar(false));
        pendentesRemotos.push(...regs);
        let mudou = await atualizarPagar().catch(() => false);
        if (pendentesRemotos.length && !ocupado()) {
          const lote = pendentesRemotos.splice(0);
          aplicar(lote); marcarSalvo(lote); mudou = true;
        }
        if (mudou && !ocupado()) render();
      }
      cuidarDaVersao();
    } catch { /* tenta de novo no próximo ciclo */ }
  }

  // ---------- versão nova do sistema ----------
  let aviso;
  function lembrarTela() { try { sessionStorage.setItem(VOLTA, JSON.stringify({ dept: S.dept, view: S.view, sel: S.sel, tab: S.tab, y: window.scrollY })); } catch { /* sem armazenamento */ } }
  function recarregar() { lembrarTela(); location.reload(); }
  const hojeBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  function cuidarDaVersao() {
    if (!versaoNova && (!window.DH_DATA_REAL || hojeBR() === HOJE)) return; // versão nova ou virou o dia: atualiza a aba
    const semPendencia = !enviando && [...fotografia()].every(([k, v]) => salvo.get(k) === canon(v) || proibido.has(k.split('|')[0]));
    if (!semPendencia) { salvar(); return; }
    const parado = Date.now() - ultimaAcao > 60000;
    if (document.hidden || (parado && !ocupado())) return recarregar();
    if (!aviso) {
      aviso = document.createElement('div');
      aviso.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:61;display:flex;gap:10px;align-items:center;padding:10px 14px;border-radius:12px;background:var(--card,#1b1d22);color:var(--text,#e8e8e8);border:1px solid var(--line,#2a2d33);box-shadow:0 6px 20px rgba(0,0,0,.35);font:14px system-ui,sans-serif;max-width:calc(100vw - 32px)';
      aviso.innerHTML = '<span>O sistema foi atualizado. Tudo o que você lançou está salvo.</span><button class="btn sm pri" type="button">Atualizar agora</button>';
      aviso.querySelector('button').onclick = recarregar;
      document.body.appendChild(aviso);
    }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { salvar(); if (versaoNova) cuidarDaVersao(); } else verificar(); });
  window.addEventListener('beforeunload', (e) => {
    if (!pronto) return;
    const pend = [...fotografia()].some(([k, v]) => salvo.get(k) !== canon(v) && !proibido.has(k.split('|')[0]));
    if (pend) { salvar(); e.preventDefault(); e.returnValue = ''; }
  });

  // ---------- início ----------
  (async function iniciar() {
    status('Carregando dados…');
    try {
      const regs = await buscar(true);
      aplicar(regs);
      for (const [k, v] of fotografia()) salvo.set(k, canon(v));
      marcarSalvo(regs);
      pronto = true;
      await atualizarPagar().catch(() => false);
      let volta = null;
      try { volta = JSON.parse(sessionStorage.getItem(VOLTA) || 'null'); sessionStorage.removeItem(VOLTA); } catch { /* sem armazenamento */ }
      if (volta && DEPTS[volta.dept] && (!volta.sel || DB.some((r) => r.id === volta.sel))) {
        S.dept = volta.dept; S.view = volta.view; S.sel = volta.sel ?? null; if (volta.tab) S.tab = volta.tab;
        render(); window.scrollTo(0, volta.y || 0);
      } else render();
      status('Dados atualizados ✓', 'ok');
    } catch (e) {
      status('Não foi possível carregar os dados', 'bad');
      toast(String(e && e.message) === '401' ? 'Sua sessão terminou. Entre de novo.' : 'Não foi possível carregar os dados salvos. Recarregue a página.', 'bad');
      return;
    }
    setInterval(verificar, 15000);
    setInterval(() => { if (!enviando) salvar(); }, 5000);
  })();
})();
