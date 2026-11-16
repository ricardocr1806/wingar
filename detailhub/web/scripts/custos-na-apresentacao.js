// Relatório e DRE: "Gastos por centro de custo". Pizza (rosca) com a divisão dos gastos do período e,
// ao lado, a lista do maior para o menor (que também é a legenda). Filtro por centro de custo: escolhendo
// um centro (na lista, na pizza ou no seletor), aparecem as contas dele, da maior para a menor.
(function () {
  // Cor fixa por centro de custo (segue o centro, nunca a posição no ranking). Paleta validada para
  // daltonismo, com tons próprios para o tema claro e o escuro.
  const CORES_CLARO = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
  const CORES_ESCURO = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'];
  const OUTROS = 'Outros';
  const estilo = document.createElement('style');
  estilo.textContent = `
    .dh-cc{--cc-surface:var(--surface)}
    ${CORES_CLARO.map((c, i) => `.dh-cc{--cc${i}:${c}}`).join('')}
    @media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) .dh-cc{${CORES_ESCURO.map((c, i) => `--cc${i}:${c};`).join('')}} }
    :root[data-theme="dark"] .dh-cc{${CORES_ESCURO.map((c, i) => `--cc${i}:${c};`).join('')}}
    .dh-cc .cc-grid{display:grid;grid-template-columns:240px minmax(0,1fr);gap:28px;align-items:center}
    @media (max-width:760px){ .dh-cc .cc-grid{grid-template-columns:minmax(0,1fr)} .dh-cc .cc-pie{margin:0 auto} }
    .dh-cc .cc-pie{position:relative;width:240px;height:240px}
    .dh-cc .cc-pie svg{width:240px;height:240px;display:block}
    .dh-cc .cc-pie path{cursor:pointer;transition:opacity .15s}
    .dh-cc .cc-centro{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;text-align:center}
    .dh-cc .cc-centro span{font-size:12px;color:var(--muted)}
    .dh-cc .cc-centro b{font-size:18px;color:var(--fg);margin-top:2px}
    .dh-cc .cc-lista{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
    .dh-cc .cc-item{all:unset;box-sizing:border-box;width:100%;display:grid;grid-template-columns:12px minmax(0,1fr) auto 52px;gap:4px 10px;align-items:center;padding:8px 10px;border-radius:10px;cursor:pointer}
    .dh-cc .cc-item:hover,.dh-cc .cc-item:focus-visible{background:var(--surface-2)}
    .dh-cc .cc-item[aria-pressed="true"]{background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--line-2)}
    .dh-cc .cc-sw{width:12px;height:12px;border-radius:3px}
    .dh-cc .cc-nome{font-weight:600;color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dh-cc .cc-val{font-variant-numeric:tabular-nums;color:var(--fg);text-align:right}
    .dh-cc .cc-pct{font-variant-numeric:tabular-nums;color:var(--muted);text-align:right;font-size:13px}
    .dh-cc .cc-barra{grid-column:2 / 5;height:4px;border-radius:4px;background:var(--surface-3);overflow:hidden}
    .dh-cc .cc-barra i{display:block;height:100%;border-radius:4px}
    .dh-cc .cc-tip{position:fixed;z-index:70;pointer-events:none;background:var(--fg);color:var(--bg);font-size:12.5px;padding:7px 10px;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.25);white-space:nowrap}
    .dh-cc .cc-contas{margin-top:18px}
    .dh-cc .cc-vazio{padding:28px 8px;text-align:center;color:var(--muted)}
    @media print{ .dh-cc .cc-item{break-inside:avoid} .dh-cc .cc-tip{display:none} }`;
  document.head.appendChild(estilo);

  // Centros na ordem fixa da empresa; centros lançados fora da lista entram depois (ex.: Marketing Comercial).
  function centros() {
    const extras = [...new Set(PAGAR.map((p) => p.cat).filter((c) => c && !CATS_PAGAR.includes(c)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return [...CATS_PAGAR, ...extras];
  }
  const corDe = (nome, ordem) => { const i = ordem.indexOf(nome); return i >= 0 && i < 8 ? `var(--cc${i})` : 'var(--faint)'; };

  function dados() {
    const per = S.f.periodo, ordem = centros();
    const contas = PAGAR.filter((p) => noPeriodo(p.venc, per));
    const soma = new Map();
    for (const p of contas) soma.set(p.cat, (soma.get(p.cat) || 0) + (+p.valor || 0));
    let fatias = ordem.filter((c) => soma.get(c) > 0).map((c) => ({ nome: c, valor: soma.get(c), cor: corDe(c, ordem) }));
    // mais de 8 centros com gasto: os menores viram "Outros" (cor neutra)
    if (fatias.length > 8) {
      const ord = [...fatias].sort((a, b) => b.valor - a.valor), fica = new Set(ord.slice(0, 7).map((f) => f.nome));
      const resto = fatias.filter((f) => !fica.has(f.nome));
      fatias = fatias.filter((f) => fica.has(f.nome)).concat({ nome: OUTROS, valor: resto.reduce((t, f) => t + f.valor, 0), cor: 'var(--faint)', grupo: resto.map((f) => f.nome) });
    }
    const total = fatias.reduce((t, f) => t + f.valor, 0);
    return { contas, fatias, total, ordem };
  }

  const pct = (v, t) => (t ? (v / t * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' : '—');
  function arco(cx, cy, r0, r1, a0, a1) {
    const p = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
    const g = a1 - a0 > Math.PI ? 1 : 0, [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
    return `M${x0},${y0} A${r1},${r1} 0 ${g} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${g} 0 ${x3},${y3} Z`;
  }
  function pizza(fatias, total, sel) {
    if (fatias.length === 1) return `<circle cx="120" cy="120" r="${(118 + 72) / 2}" fill="none" stroke="${fatias[0].cor}" stroke-width="46" data-cc="${esc(fatias[0].nome)}"/>`;
    let a = 0;
    return fatias.map((f) => {
      const a1 = a + (f.valor / total) * Math.PI * 2, d = arco(120, 120, 72, 118, a, a1); a = a1;
      const apagado = sel !== 'todos' && sel !== f.nome && !(f.grupo && f.grupo.includes(sel));
      return `<path d="${d}" fill="${f.cor}" stroke="var(--cc-surface)" stroke-width="2" stroke-linejoin="round" opacity="${apagado ? 0.28 : 1}" data-cc="${esc(f.nome)}"><title>${esc(f.nome)}: ${fmt(f.valor)} (${pct(f.valor, total)})</title></path>`;
    }).join('');
  }

  function secao() {
    const { contas, fatias, total, ordem } = dados();
    const sel = S.f.cc && (S.f.cc === 'todos' || ordem.includes(S.f.cc)) ? S.f.cc : 'todos';
    const opcoes = [['todos', 'Todos os centros de custo'], ...ordem.map((c) => [c, c])];
    const filtro = `<select data-dhcc="1" style="width:auto;max-width:300px;flex:0 0 auto" aria-label="Filtrar por centro de custo">${opcoes.map(([v, n]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
    const cab = `<div class="card-h" style="flex-wrap:wrap;gap:10px"><div><h3>Gastos por centro de custo</h3><span class="faint" style="font-size:12.5px">${esc(nomePeriodo(S.f.periodo))} · contas a pagar por vencimento. Clique num centro para ver as contas dele.</span></div>${filtro}</div>`;
    if (!total) return `<section class="card dh-cc">${cab}<div class="cc-vazio">Nenhuma conta a pagar neste período.</div></section>`;
    const ranking = [...fatias].sort((a, b) => b.valor - a.valor), maior = ranking[0].valor;
    const lista = `<ol class="cc-lista">${ranking.map((f) => `<li><button class="cc-item" data-a="ccSel" data-c="${esc(f.nome)}" aria-pressed="${sel === f.nome}">
        <span class="cc-sw" style="background:${f.cor}"></span><span class="cc-nome">${esc(f.nome)}</span><span class="cc-val">${fmt(f.valor)}</span><span class="cc-pct">${pct(f.valor, total)}</span>
        <span class="cc-barra"><i style="width:${(f.valor / maior * 100).toFixed(1)}%;background:${f.cor}"></i></span></button></li>`).join('')}</ol>`;
    const escolhido = sel === 'todos' ? null : fatias.find((f) => f.nome === sel || (f.grupo && f.grupo.includes(sel)));
    const meio = escolhido && sel !== 'todos'
      ? `<span>${esc(sel)}</span><b>${fmt(contas.filter((p) => p.cat === sel).reduce((t, p) => t + (+p.valor || 0), 0))}</b><span>${pct(contas.filter((p) => p.cat === sel).reduce((t, p) => t + (+p.valor || 0), 0), total)} dos gastos</span>`
      : `<span>Total de gastos</span><b>${fmt(total)}</b><span>${contas.length} conta${contas.length === 1 ? '' : 's'}</span>`;
    let detalhe = '';
    if (sel !== 'todos') {
      const L = contas.filter((p) => p.cat === sel).sort((a, b) => b.valor - a.valor);
      const forn = new Map(); L.forEach((p) => forn.set(p.forn || '—', (forn.get(p.forn || '—') || 0) + (+p.valor || 0)));
      const topForn = [...forn].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, v]) => `${esc(n)} (${fmt(v)})`).join(' · ');
      detalhe = L.length ? `<div class="cc-contas"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:8px"><b>${esc(sel)}: ${L.length} conta${L.length === 1 ? '' : 's'}, ${fmt(L.reduce((t, p) => t + (+p.valor || 0), 0))}</b>${topForn ? `<span class="faint" style="font-size:12.5px">Maiores fornecedores: ${topForn}</span>` : ''}</div>
        <div class="tbl-wrap" style="box-shadow:none"><table class="tbl"><thead><tr><th>Vencimento</th><th>Descrição</th><th>Fornecedor</th><th class="num">Valor</th><th>Situação</th></tr></thead><tbody>
        ${L.map((p) => `<tr><td class="mono">${fdate(p.venc)}</td><td>${esc(p.desc)}</td><td>${esc(p.forn)}</td><td class="num">${fmt(p.valor)}</td><td>${p.pago ? chip('ok', 'Pago') : p.venc < HOJE ? chip('bad', 'Vencido') : chip('warn', 'Em aberto')}</td></tr>`).join('')}
        </tbody></table></div><div style="margin-top:10px"><button class="btn sm ghost" data-a="ccSel" data-c="todos">Ver todos os centros</button></div></div>`
        : `<div class="cc-vazio">Nenhuma conta de ${esc(sel)} neste período.</div>`;
    }
    return `<section class="card dh-cc">${cab}<div class="cc-grid"><div class="cc-pie"><svg viewBox="0 0 240 240" role="img" aria-label="Divisão dos gastos por centro de custo">${pizza(fatias, total, sel)}</svg><div class="cc-centro">${meio}</div></div>${lista}</div>${detalhe}</section>`;
  }

  const original = VIEWS.dre;
  VIEWS.dre = () => {
    const html = original();
    try { return html + secao(); } catch (e) { console.error(e); return html; }
  };
  ACT.ccSel = (a) => { const c = a.dataset.c; S.f.cc = c === 'todos' || S.f.cc === c ? 'todos' : c; render(); };
  document.addEventListener('change', (e) => { if (e.target.dataset && e.target.dataset.dhcc) { S.f.cc = e.target.value; render(); } });
  document.addEventListener('click', (e) => {
    const p = e.target.closest && e.target.closest('.dh-cc [data-cc]');
    if (p) { const c = p.getAttribute('data-cc'); if (c !== OUTROS) { S.f.cc = S.f.cc === c ? 'todos' : c; render(); } }
  });
  // dica ao passar o mouse na pizza
  let tip;
  document.addEventListener('mousemove', (e) => {
    const p = e.target.closest && e.target.closest('.dh-cc [data-cc]');
    if (!p) { if (tip) tip.hidden = true; return; }
    const sec = p.closest('.dh-cc');
    if (!tip || !sec.contains(tip)) { tip = document.createElement('div'); tip.className = 'cc-tip'; sec.appendChild(tip); }
    const t = p.querySelector('title'); tip.textContent = t ? t.textContent : p.getAttribute('data-cc');
    tip.hidden = false; tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 12) + 'px';
  });
})();
