// Campos de valor em reais: enquanto a pessoa digita, o valor já aparece formatado (ponto de milhar e vírgula
// dos centavos), como no aplicativo do banco: digitar 200000 mostra 2.000,00. Também o campo "Valor total" da proposta.
(function () {
  const DINHEIRO = /^(i-desc|i-ent|b-frete|v\d+|il-x-\d+|np-x|ns-v|cat-v-\d+|dl-meta-.+|ed-x|dh-total)$/;
  const ehDinheiro = (el) => el && el.tagName === 'INPUT' && DINHEIRO.test(el.id || '');
  const br = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // enquanto digita
  document.addEventListener('input', (e) => {
    const el = e.target; if (!ehDinheiro(el)) return;
    const d = el.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    el.value = d ? br(parseInt(d, 10) / 100) : '';
  }, true);
  // ao entrar no campo, seleciona tudo para digitar o valor novo por cima
  document.addEventListener('focusin', (e) => {
    const el = e.target; if (!ehDinheiro(el) || el.disabled) return;
    if (el.value && dhNum(el.value) === 0) el.value = ''; // campo zerado: começa a digitar do zero
    setTimeout(() => { try { el.select(); } catch { /* */ } }, 0);
  });

  // valores que a tela desenha (ex.: 1137.5) aparecem já formatados (1.137,50)
  function formatar(raiz) {
    (raiz.querySelectorAll ? raiz.querySelectorAll('input') : []).forEach((el) => {
      if (!ehDinheiro(el) || el === document.activeElement || el.dataset.dhFmt === el.value) return;
      if (el.value.trim() !== '') el.value = br(dhNum(el.value));
      el.dataset.dhFmt = el.value;
    });
  }
  new MutationObserver((lista) => { for (const m of lista) m.addedNodes.forEach((n) => { if (n.nodeType === 1) formatar(n.tagName === 'INPUT' ? n.parentNode || n : n); }); })
    .observe(document.body, { childList: true, subtree: true });
  formatar(document);

  // Valor total da proposta: sem serviços, vira a linha "Valor total da proposta"; com serviços,
  // um total menor vira desconto e um total maior vira a linha "Ajuste para o valor total".
  document.addEventListener('change', (e) => {
    if (e.target.id !== 'dh-total') return;
    const r = cur(); if (!r || e.target.disabled) return;
    const T = Math.round(dhNum(e.target.value) * 100) / 100;
    if (!(T > 0)) return;
    for (let i = r.servicos.length - 1; i >= 0; i--) if (r.servicos[i].dhTotal) r.servicos.splice(i, 1);
    const base = r.servicos.reduce((t, s) => t + (+s.qtd || 0) * (+s.valor || 0), 0);
    const linha = (desc, valor) => ({ cod: '000', desc, qtd: 1, valor, det: '', dhTotal: true });
    if (!r.servicos.length) { r.servicos.push(linha('Valor total da proposta', T)); r.desconto = 0; }
    else if (T <= base) r.desconto = Math.round((base - T) * 100) / 100;
    else { r.desconto = 0; r.servicos.push(linha('Ajuste para o valor total', Math.round((T - base) * 100) / 100)); }
    render();
    toast(`Total da proposta: ${fmt(total(r))}.`);
  });
})();

// Filtro de período: "Escolher datas…" abre um quadro com De / Até e aplica o período personalizado.
(function () {
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!(el.tagName === 'SELECT' && el.dataset.f === 'periodo' && el.value === 'escolher')) return;
    e.stopImmediatePropagation(); e.stopPropagation();
    const atual = String(S.f.periodo || ''), r = /^r:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(atual);
    el.value = atual;
    const hoje = dhDia(0), de = r ? r[1] : hoje.slice(0, 8) + '01', ate = r ? dhSomaDia(r[2], -1) : hoje;
    dialogo(`<div class="dlg-h"><span class="dlg-ic">${ico('calendar')}</span><div><h2>Escolher período</h2><p class="muted">Os números da tela passam a considerar só esse intervalo de datas.</p></div></div>
      <div class="fields"><div class="field"><label for="per-de">De</label><input id="per-de" type="date" value="${de}"></div>
        <div class="field"><label for="per-ate">Até</label><input id="per-ate" type="date" value="${ate}"></div></div>
      <div id="per-err" class="cv-err" hidden></div>
      <div class="dlg-acts"><button class="btn" data-a="dlgFechar">Cancelar</button><button class="btn pri" data-a="perAplicar">Aplicar</button></div>`);
  }, true);
  ACT.perAplicar = () => {
    const de = $('#per-de').value, ate = $('#per-ate').value, err = $('#per-err');
    if (!de || !ate) { err.textContent = 'Escolha as duas datas.'; err.hidden = false; return; }
    if (ate < de) { err.textContent = 'A data final precisa ser depois da inicial.'; err.hidden = false; return; }
    S.f.periodo = 'r:' + de + ':' + dhSomaDia(ate, 1);
    fecharDlg(); render();
  };
})();
