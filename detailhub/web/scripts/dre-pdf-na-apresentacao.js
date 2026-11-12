// Relatório e DRE: botão "Imprimir / salvar PDF". Monta o relatório numa folha A4 (empresa, período, unidade,
// indicadores e a tabela completa) e abre a impressão do navegador, onde dá para imprimir ou salvar em PDF.
(function () {
  const estilo = document.createElement('style');
  estilo.textContent = `
    @media print{ #dh-sync{display:none!important} }
    .doc.dre-doc .dre-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2px solid var(--ink);padding-bottom:12px;margin-bottom:14px}
    .doc.dre-doc .dre-top h1{font:700 22px/1.15 "Helvetica Neue",Arial,sans-serif;margin:0 0 4px}
    .doc.dre-doc .dre-top .emp{font:700 15px/1 "Helvetica Neue",Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;text-align:right}
    .doc.dre-doc .dre-top .meta{font-size:11px;opacity:.75;text-align:right;margin-top:6px;line-height:1.5}
    .doc.dre-doc .dre-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:0 0 16px}
    .doc.dre-doc .dre-kpis div{border:1px solid rgba(0,0,0,.18);border-radius:6px;padding:8px 10px}
    .doc.dre-doc .dre-kpis span{display:block;font-size:10.5px;opacity:.7}
    .doc.dre-doc .dre-kpis b{display:block;font-size:16px;margin:3px 0 2px}
    .doc.dre-doc table{width:100%;border-collapse:collapse;font-size:12px}
    .doc.dre-doc th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;opacity:.7;border-bottom:1.5px solid var(--ink);padding:6px 4px}
    .doc.dre-doc td{padding:6px 4px;border-bottom:1px solid rgba(0,0,0,.1)}
    .doc.dre-doc .num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
    .doc.dre-doc tr.grp td{font-weight:700;background:rgba(0,0,0,.04)}
    .doc.dre-doc tr.ind td:first-child{padding-left:18px}
    .doc.dre-doc tr.res td{font-weight:700;font-size:13.5px;border-top:2px solid var(--ink);border-bottom:2px solid var(--ink)}
    .doc.dre-doc .neg{color:#b42318}
    .doc.dre-doc .rodape{margin-top:18px;font-size:10.5px;opacity:.65;line-height:1.5}
    .doc.dre-doc tr{break-inside:avoid}`;
  document.head.appendChild(estilo);

  // Imprimir qualquer tela (Ctrl+P ou o menu do navegador): sai a tela que a pessoa está vendo, em folha branca,
  // sem o menu lateral, a barra de busca e os botões. Quando um documento (OS, Prisma, DRE) está aberto, sai só ele.
  const tela = 'body:not(:has(#modal:not([hidden])))';
  const claro = (() => { // cores do tema claro, para não imprimir fundo escuro com letra clara
    for (const f of document.styleSheets) {
      let regras; try { regras = f.cssRules; } catch { continue; }
      for (const r of regras) if (r.selectorText === ':root' && r.style) return [...r.style].filter((k) => k.startsWith('--')).map((k) => `${k}:${r.style.getPropertyValue(k)} !important`).join(';');
    }
    return '';
  })();
  const impressao = document.createElement('style');
  impressao.textContent = `
    @media print{
      :root{color-scheme:light !important;${claro}}
      html, ${tela}{background:#fff!important;color:#111!important}
      ${tela} .app{display:block!important;min-height:0!important}
      ${tela} .side, ${tela} .topbar, ${tela} .toast, ${tela} #dlg, ${tela} #cv, ${tela} #dh-sync, ${tela} .btn, ${tela} .strips{display:none!important}
      ${tela} .main{padding:0!important;gap:14px!important}
      ${tela} .view{animation:none!important;gap:14px!important}
      ${tela} .card, ${tela} .kpi, ${tela} section{box-shadow:none!important;break-inside:avoid-page}
      ${tela} .kpi.hl{background:#fff!important;color:#111!important;border:1px solid #ccc!important}
      ${tela} .kpi.hl *{color:#111!important}
      ${tela} .tbl-wrap{overflow:visible!important}
      ${tela} table{min-width:0!important}
      ${tela} tr{break-inside:avoid}
      ${tela} input, ${tela} select{border:1px solid #ccc!important;background:#fff!important;color:#111!important}
      @page{size:A4;margin:12mm}
    }`;
  document.head.appendChild(impressao);

  const original = VIEWS.dre;
  VIEWS.dre = () => {
    const html = original();
    const botao = `<div style="display:flex;justify-content:flex-end;margin:0 0 12px"><button class="btn pri" data-a="drePdf">${ico('print')}Imprimir / salvar PDF</button></div>`;
    const i = html.indexOf('<div class="filters">');
    return i < 0 ? botao + html : html.slice(0, i) + botao + html.slice(i);
  };

  const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  ACT.drePdf = () => {
    const view = document.querySelector('#main .view');
    const tabela = view && view.querySelector('table.dre');
    if (!tabela) return toast('Abra o Relatório e DRE para imprimir.', 'warn');
    const empresa = txt(document.querySelector('.brand b')) || 'Empresa';
    const periodo = nomePeriodo(S.f.periodo), unidade = unNome(S.f.dre), aliq = +S.f.aliq || 0;
    const quem = (window.DH_ACESSO && window.DH_ACESSO.nome) || '';
    const agora = new Date();
    const gerado = agora.toLocaleDateString('pt-BR') + ' às ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const kpis = [...view.querySelectorAll('.kpis .kpi')].map((k) => `<div><span>${esc(txt(k.querySelector('.k')))}</span><b>${esc(txt(k.querySelector('.v')))}</b><span>${esc(txt(k.querySelector('.d')))}</span></div>`).join('');
    const linhas = [...tabela.querySelectorAll('tbody tr')].map((tr) => {
      const c = tr.querySelectorAll('td'), valor = txt(c[1]);
      return `<tr class="${esc(tr.className)}"><td>${esc(txt(c[0]))}</td><td class="num ${valor.startsWith('−') ? 'neg' : ''}">${esc(valor)}</td><td class="num">${esc(txt(c[2]))}</td></tr>`;
    }).join('');
    const m = $('#modal');
    m.innerHTML = `<div class="modal-in"><div class="modal-bar"><span><b>Relatório e DRE</b> · folha A4<br><small style="opacity:.75">Na janela que abrir, escolha a impressora ou "Salvar como PDF".</small></span>
      <span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-a="fecharModal">Fechar</button><button class="btn sm pri" data-a="drePdfImprimir">${ico('print')}Imprimir / salvar PDF</button></span></div>
      <div class="doc dre-doc">
        <div class="dre-top"><div><h1>Relatório e DRE</h1><div>${esc(periodo)} · ${esc(unidade)}</div><div style="font-size:11px;opacity:.75;margin-top:3px">Por competência. Receita das vendas fechadas; despesas das contas a pagar. Alíquota de impostos: ${String(aliq).replace('.', ',')}%.</div></div>
          <div><div class="emp">${esc(empresa)}</div><div class="meta">Gerado em ${esc(gerado)}${quem ? '<br>por ' + esc(quem) : ''}</div></div></div>
        <div class="dre-kpis">${kpis}</div>
        <table><thead><tr><th>Conta</th><th class="num">Valor</th><th class="num">% da receita</th></tr></thead><tbody>${linhas}</tbody></table>
        <div class="rodape">${esc(empresa)} · Relatório gerado pelo sistema de gestão DetailHub.</div>
      </div></div>`;
    m.hidden = false;
    m.scrollTo(0, 0);
    setTimeout(() => ACT.drePdfImprimir(), 80);
  };
  ACT.drePdfImprimir = () => {
    const titulo = document.title;
    document.title = `DRE ${txt(document.querySelector('.brand b'))} - ${nomePeriodo(S.f.periodo)}`.replace(/[\\/:*?"<>|]/g, '-');
    const volta = () => { document.title = titulo; window.removeEventListener('afterprint', volta); };
    window.addEventListener('afterprint', volta);
    try { window.print(); } catch { volta(); }
    setTimeout(volta, 60000);
  };
})();
