// Contas a pagar salvas no banco (para quem entrou com login e tem o Financeiro), com Editar → Salvar / Excluir.
// No link de visualização (sem login) continua só na tela, como demonstração.
(function () {
  const A = window.DH_ACESSO;
  const SALVA = !!(A && A.modulos && A.modulos.includes('financeiro'));
  const API = SALVA ? `/api/empresas/${A.slug}/pagar` : '';
  const num = (v) => parseFloat(String(v).replace(/\./g, '').replace(',', '.'));

  // Se o servidor ou a internet falharem no meio, tenta de novo sozinho (as contas novas levam um id próprio,
  // então uma nova tentativa nunca lança a mesma conta duas vezes).
  const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
  async function api(corpo) {
    if (corpo && corpo.acao === 'criar' && !corpo.id) corpo.id = novoId();
    if (corpo && corpo.acao === 'importar') corpo.contas.forEach((c) => { if (!c.id) c.id = novoId(); });
    let ultimo = '';
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      if (tentativa) await espera([0, 700, 1500, 3000, 5000][tentativa]);
      try {
        const r = await fetch(API, corpo ? { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) } : { credentials: 'same-origin', cache: 'no-store' });
        const j = await r.json().catch(() => null);
        if (r.ok && j) return j;
        if (j && j.erro) { toast(j.erro, 'bad'); return null; } // recusa de verdade (permissão, dado faltando)
        ultimo = 'servidor';
      } catch { ultimo = 'rede'; }
    }
    toast(ultimo === 'rede' ? 'Sem conexão com a internet. Nada foi salvo, tente de novo.' : 'O servidor não respondeu. Nada foi salvo, tente de novo em instantes.', 'bad');
    return null;
  }
  async function carregar() {
    const j = await api();
    if (j) { PAGAR.splice(0, PAGAR.length, ...j.contas); S.pagarCarregado = true; render(); }
  }

  if (SALVA) {
    ACT.addPagar = async () => {
      const d = $('#np-d').value.trim(), v = num($('#np-x').value);
      if (!d || !(v > 0)) return toast('Informe a descrição e o valor da conta.', 'bad');
      const j = await api({ acao: 'criar', desc: d, forn: $('#np-f').value.trim(), cat: $('#np-c').value, venc: $('#np-v').value || HOJE, valor: v });
      if (j) { PAGAR.push(...j.contas); S.f.pag = 'aberto'; render(); toast('Conta lançada e salva.'); }
    };
    ACT.pagar = async (a) => {
      const p = PAGAR[+a.dataset.i]; const j = await api({ acao: 'pagar', id: p.id, pago: !p.pago });
      if (j) { Object.assign(p, j.conta); render(); toast(p.pago ? 'Conta marcada como paga.' : 'Pagamento desfeito.'); }
    };
    const importarOriginal = ACT.impImportar;
    ACT.impImportar = async () => {
      const im = S.imp, ok = im.linhas.filter((l) => l.incl && !l.erros.length);
      if (!ok.length) return importarOriginal();
      const j = await api({ acao: 'importar', contas: ok.map((l) => ({ desc: l.desc || l.forn, forn: l.forn, cat: l.cat, venc: l.venc, valor: l.valor, pago: !!l.pago, origem: im.nome })) });
      if (!j) return;
      PAGAR.push(...j.contas);
      const n = j.contas.length, v = j.contas.reduce((s, c) => s + c.valor, 0);
      S.imp = null; S.pgTab = 'lista'; S.f.pag = 'todos'; render();
      toast(`${n} conta${n === 1 ? '' : 's'} importada${n === 1 ? '' : 's'} e salva${n === 1 ? '' : 's'} (${fmt(v)}).`);
    };
  }

  ACT.pgEditar = (a) => {
    const i = +a.dataset.i, p = PAGAR[i];
    dialogo(`<div class="dlg-h"><span class="dlg-ic">${ico('edit')}</span><div><span class="muted">Editar conta a pagar</span><h2>${esc(p.desc)}</h2></div></div>
      <div class="fields">
        <div class="field"><label for="ed-d">Descrição</label><input id="ed-d" value="${esc(p.desc)}"></div>
        <div class="field"><label for="ed-f">Fornecedor</label><input id="ed-f" value="${esc(p.forn === '—' ? '' : p.forn)}"></div>
        <div class="field"><label for="ed-c">Centro de custo</label><select id="ed-c">${[...new Set([...CATS_PAGAR, p.cat])].map((c) => `<option ${c === p.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        <div class="field"><label for="ed-v">Vencimento</label><input id="ed-v" type="date" value="${p.venc}"></div>
        <div class="field"><label for="ed-x">Valor (R$)</label><input id="ed-x" class="num" inputmode="decimal" value="${p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}"></div>
        <div class="field"><label for="ed-p">Situação</label><select id="ed-p"><option value="0" ${p.pago ? '' : 'selected'}>Em aberto</option><option value="1" ${p.pago ? 'selected' : ''}>Paga</option></select></div>
      </div>
      <div id="ed-err" class="cv-err" hidden></div>
      <div class="dlg-acts" style="justify-content:space-between"><button class="btn danger" data-a="pgExcluir" data-i="${i}">${ico('trash')}Excluir</button>
        <span style="display:flex;gap:8px"><button class="btn" data-a="dlgFechar">Cancelar</button><button class="btn pri" data-a="pgSalvar" data-i="${i}">Salvar</button></span></div>`);
  };
  ACT.pgSalvar = async (a) => {
    const p = PAGAR[+a.dataset.i];
    const novo = { desc: $('#ed-d').value.trim(), forn: $('#ed-f').value.trim() || '—', cat: $('#ed-c').value, venc: $('#ed-v').value, valor: num($('#ed-x').value), pago: $('#ed-p').value === '1' };
    if (!novo.desc || !(novo.valor > 0) || !novo.venc) { const e = $('#ed-err'); e.textContent = 'Preencha descrição, vencimento e valor.'; e.hidden = false; return; }
    if (SALVA) { const j = await api({ acao: 'atualizar', id: p.id, ...novo, origem: p.origem }); if (!j) return; Object.assign(p, j.conta); }
    else Object.assign(p, novo);
    fecharDlg(); render(); toast('Conta atualizada.');
  };
  ACT.pgExcluir = (a) => {
    const p = PAGAR[+a.dataset.i];
    dialogo(`<div class="dlg-h"><span class="dlg-ic del">${ico('trash')}</span><div><span class="muted">Excluir conta a pagar</span><h2>${esc(p.desc)}</h2><p class="muted">${esc(p.forn)} · ${fmt(p.valor)} · vence ${fdate(p.venc)}</p></div></div>
      <p style="margin:0"><b>Sim, deseja realmente excluir esta conta?</b> Ela sai da lista e da DRE.</p>
      <div class="dlg-acts"><button class="btn" data-a="pgEditar" data-i="${a.dataset.i}">Não, voltar</button><button class="btn danger" data-a="pgExcluirSim" data-i="${a.dataset.i}">Sim, excluir</button></div>`);
  };
  ACT.pgExcluirSim = async (a) => {
    const i = +a.dataset.i, p = PAGAR[i];
    if (SALVA) { const j = await api({ acao: 'excluir', id: p.id }); if (!j) return; }
    PAGAR.splice(i, 1); fecharDlg(); render(); toast('Conta excluída.', 'warn');
  };

  if (SALVA) carregar();
})();
