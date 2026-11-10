// Tela "Configurações" dentro do sistema da empresa (só para o administrador).
// É anexada à versão de apresentação por scripts/gerar-apresentacao.mjs e usa as funções dela (VIEWS, ACT, S, render…).
(function () {
  const A = window.DH_ACESSO;
  if (!A || !A.admin) return;
  const API = `/api/empresas/${A.slug}/config`;
  S.cfg = null; S.cfgNovo = null;

  async function carregar() {
    try {
      const r = await fetch(API, { credentials: 'same-origin', cache: 'no-store' });
      const j = await r.json();
      S.cfg = r.ok ? j : { erro: j.erro || 'Não foi possível carregar.' };
    } catch { S.cfg = { erro: 'Sem conexão. Tente de novo.' }; }
    if (S.view === 'config') render();
  }
  async function enviar(corpo) {
    try {
      const r = await fetch(API, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.erro || 'Não foi possível salvar.', 'bad'); return null; }
      return j;
    } catch { toast('Sem conexão. Tente de novo.', 'bad'); return null; }
  }
  const quando = (s) => { if (!s) return 'Ainda não entrou'; const d = Math.floor((Date.now() - new Date(s).getTime()) / 864e5); return d <= 0 ? 'Hoje' : d === 1 ? 'Ontem' : `Há ${d} dias`; };

  VIEWS.config = () => {
    const C = S.cfg;
    const topo = `<header class="phead"><div><div class="eyebrow"><span class="dot"></span>Administração</div><h1>Configurações</h1>
      <p class="sub">Quem acessa o sistema e o que cada pessoa vê. Só o administrador enxerga esta tela.</p></div></header>`;
    if (!C) return topo + `<div class="card"><p class="muted">Carregando…</p></div>`;
    if (C.erro) return topo + `<div class="card"><p class="muted">${esc(C.erro)}</p></div>`;
    const areas = C.areas.filter((x) => C.dono || !x.admin);
    const opt = (sel) => areas.map((x) => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.nome)}</option>`).join('');
    const novo = S.cfgNovo;
    return topo + `
      <div class="kpis">
        <div class="kpi hl"><span class="k">Pessoas no plano</span><span class="v">${C.usados} de ${C.limite}</span><span class="d">${C.livres ? `${C.livres} vaga${C.livres === 1 ? '' : 's'} livre${C.livres === 1 ? '' : 's'}` : 'todas as vagas em uso'} · administradores não contam</span></div>
        <div class="kpi"><span class="k">Seu acesso</span><span class="v" style="font-size:22px">${C.dono ? 'Administrador total' : 'Administrador do sistema'}</span><span class="d">${C.dono ? 'Dono da plataforma' : esc(C.empresa)}</span></div>
      </div>
      <section class="card"><h3>Áreas de acesso</h3>
        <div class="fields">${C.areas.map((x) => `<div class="field"><b>${esc(x.nome)}</b><span class="faint" style="font-size:13px">${esc(x.descricao)}</span></div>`).join('')}</div>
      </section>
      <section class="card"><div class="card-h"><h3>Pessoas</h3>${chip('neu', String(C.pessoas.length))}</div>
        <div class="tbl-wrap" style="box-shadow:none"><table class="tbl"><thead><tr><th>Pessoa</th><th>Área</th><th>Acesso</th><th>Último acesso</th><th></th></tr></thead><tbody>
        ${C.pessoas.map((p) => {
          const fixo = p.eu || (!C.dono && p.admin);
          return `<tr><td class="cl"><b>${esc(p.nome || p.email)}${p.eu ? ' · você' : ''}</b><span>${esc(p.email)}</span></td>
            <td>${fixo ? esc(p.cargo) : `<select data-k="cargo" aria-label="Área">${opt(p.cargo_id)}</select>`}</td>
            <td>${fixo ? (p.ativo ? chip('ok', 'Ativo') : chip('bad', 'Bloqueado')) : `<select data-k="ativo" aria-label="Acesso"><option value="1" ${p.ativo ? 'selected' : ''}>Ativo</option><option value="0" ${p.ativo ? '' : 'selected'}>Bloqueado</option></select>`}</td>
            <td>${quando(p.ultimo_acesso)}</td>
            <td>${fixo ? '' : `<button class="btn sm" data-a="cfgSalvar" data-u="${p.user_id}">Salvar</button>`}</td></tr>`;
        }).join('') || `<tr><td colspan="5" class="muted">Ninguém ainda.</td></tr>`}
        </tbody></table></div>
        ${C.pendentes.length ? `<div><span class="faint" style="font-size:12.5px">Adicionados que ainda não entraram</span>
          <table class="tbl"><tbody>${C.pendentes.map((x) => `<tr><td class="cl"><b>${esc(x.nome || x.email || 'Link de acesso')}</b><span>${esc(x.email || '')}</span></td><td>${esc(x.area)}</td>
            <td style="text-align:right"><button class="btn sm" data-a="cfgCancelar" data-c="${x.id}">Cancelar</button></td></tr>`).join('')}</tbody></table></div>` : ''}
      </section>
      <section class="card"><h3>Adicionar pessoa</h3>
        ${C.livres > 0 || C.dono ? `<div class="fields">
            <div class="field"><label for="cfg-nome">Nome</label><input id="cfg-nome" placeholder="Nome da pessoa" autocomplete="off"></div>
            <div class="field"><label for="cfg-email">E-mail</label><input id="cfg-email" type="email" placeholder="pessoa@empresa.com.br" autocomplete="off"></div>
            <div class="field"><label for="cfg-area">Área</label><select id="cfg-area">${opt(areas.find((x) => x.nome === 'Comercial')?.id)}</select></div>
          </div>
          <div style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap">
            <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="cfg-enviar" checked> Mandar o acesso por e-mail agora</label>
            <button class="btn pri" data-a="cfgAdd">Adicionar pessoa</button></div>`
          : `<p class="muted">Todas as ${C.limite} vagas do plano estão em uso. Bloqueie alguém para liberar uma vaga ou fale com o DetailHub para aumentar o plano.</p>`}
        ${novo ? `<div class="note ok"><b>${esc(novo.nome)} foi adicionado</b>${novo.enviado ? `O acesso foi enviado para ${esc(novo.email)}. ` : ''}${novo.aviso ? esc(novo.aviso) + ' ' : ''}Se preferir, mande este link pelo WhatsApp (vale 7 dias):
          <div style="display:flex;gap:8px;margin-top:8px"><input id="cfg-link" readonly value="${esc(novo.link)}" style="flex:1"><button class="btn sm" data-a="cfgCopiar">Copiar</button></div></div>` : ''}
      </section>`;
  };

  ACT.cfgAbrir = () => { S.view = 'config'; S.cfg = null; S.cfgNovo = null; render(); window.scrollTo(0, 0); carregar(); };
  ACT.cfgSalvar = async (a) => {
    const tr = a.closest('tr');
    const j = await enviar({ acao: 'salvar', user_id: a.dataset.u, cargo_id: tr.querySelector('[data-k=cargo]').value, ativo: tr.querySelector('[data-k=ativo]').value === '1' });
    if (j) { toast('Acesso atualizado.'); carregar(); }
  };
  ACT.cfgCancelar = async (a) => { const j = await enviar({ acao: 'cancelar', convite_id: a.dataset.c }); if (j) { toast('Acesso cancelado.'); carregar(); } };
  ACT.cfgAdd = async () => {
    const j = await enviar({ acao: 'adicionar', nome: $('#cfg-nome').value, email: $('#cfg-email').value, cargo_id: $('#cfg-area').value, enviar: $('#cfg-enviar').checked });
    if (j) { S.cfgNovo = j; toast(`${j.nome} foi adicionado.`); carregar(); }
  };
  ACT.cfgCopiar = async () => { const el = $('#cfg-link'); try { await navigator.clipboard.writeText(el.value); toast('Link copiado.'); } catch { el.select(); } };
})();
