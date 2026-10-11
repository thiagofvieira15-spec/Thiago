'use strict';

// Histórico do patrimônio (um registro por dia) e controle de proventos.
// Carregado depois de app.js e mercado.js.

const hojeISO = () => new Date().toISOString().slice(0, 10);

// Guarda (ou atualiza) o registro de hoje com o patrimônio investido e o total aplicado
function registrarHistorico() {
  const { total, custo } = totais();
  if (!total) return;
  estado.historico = estado.historico || [];
  const hoje = hojeISO();
  const reg = { d: hoje, v: Math.round(total * 100) / 100, c: Math.round(custo * 100) / 100 };
  const i = estado.historico.findIndex((h) => h.d === hoje);
  if (i >= 0) estado.historico[i] = reg;
  else estado.historico.push(reg);
  estado.historico.sort((a, b) => a.d.localeCompare(b.d));
  salvar();
}

// Rentabilidade no período pelo método de Dietz modificado (desconta os aportes)
function rentabilidadePeriodo(h) {
  const ini = h[0], fim = h[h.length - 1];
  const fluxo = fim.c - ini.c;
  const base = ini.v + fluxo / 2;
  if (base <= 0) return null;
  const dias = (Date.parse(fim.d) - Date.parse(ini.d)) / 86400000;
  // CDI aproximado pela Selic (o CDI costuma ficar ~0,10 ponto abaixo)
  const cdiAno = Math.max(0, cenario().selic - 0.1) / 100;
  return {
    dias,
    carteira: ((fim.v - ini.v - fluxo) / base) * 100,
    cdi: (Math.pow(1 + cdiAno, dias / 365) - 1) * 100,
    ganho: fim.v - ini.v - fluxo,
  };
}

// ---------- Gráficos (SVG simples, com dica ao passar o mouse) ----------

function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function escalaY(min, max) {
  if (min === max) { min *= 0.95; max *= 1.05; }
  const folga = (max - min) * 0.08;
  return [Math.max(0, min - folga), max + folga];
}

function moedaCurta(v) {
  if (Math.abs(v) >= 1e6) return `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(v) >= 1e3) return `R$ ${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return fmt(v);
}

function graficoLinhas(caixa, pontos, series) {
  caixa.innerHTML = '';
  const W = Math.max(300, caixa.clientWidth || 600), H = 230;
  const m = { l: 64, r: 16, t: 12, b: 28 };
  const vals = pontos.flatMap((p) => series.map((s) => p[s.k]));
  const [y0, y1] = escalaY(Math.min(...vals), Math.max(...vals));
  const x = (i) => m.l + (pontos.length === 1 ? (W - m.l - m.r) / 2 : (i / (pontos.length - 1)) * (W - m.l - m.r));
  const y = (v) => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Evolução do patrimônio' });
  for (let i = 0; i <= 4; i++) {
    const v = y0 + ((y1 - y0) * i) / 4;
    svg.append(svgEl('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'viz-grade' }));
    const t = svgEl('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'viz-eixo' });
    t.textContent = moedaCurta(v);
    svg.append(t);
  }
  [0, pontos.length - 1].filter((v, i, a) => a.indexOf(v) === i).forEach((i) => {
    const t = svgEl('text', { x: x(i), y: H - 8, 'text-anchor': i === 0 && pontos.length > 1 ? 'start' : 'end', class: 'viz-eixo' });
    t.textContent = dataBR(pontos[i].d);
    svg.append(t);
  });
  for (const s of series) {
    const d = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[s.k]).toFixed(1)}`).join('');
    svg.append(svgEl('path', { d, class: 'viz-linha', style: `stroke:var(${s.cor})` }));
    const u = pontos.length - 1;
    svg.append(svgEl('circle', { cx: x(u), cy: y(pontos[u][s.k]), r: 4, class: 'viz-ponto', style: `fill:var(${s.cor})` }));
  }
  const guia = svgEl('line', { y1: m.t, y2: H - m.b, class: 'viz-guia', visibility: 'hidden' });
  svg.append(guia);
  const alvo = svgEl('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' });
  svg.append(alvo);
  caixa.append(svg);

  const dica = document.createElement('div');
  dica.className = 'viz-dica';
  dica.hidden = true;
  caixa.append(dica);
  const mover = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    const i = pontos.length === 1 ? 0 : Math.max(0, Math.min(pontos.length - 1, Math.round(((px - m.l) / (W - m.l - m.r)) * (pontos.length - 1))));
    guia.setAttribute('x1', x(i)); guia.setAttribute('x2', x(i)); guia.setAttribute('visibility', 'visible');
    dica.innerHTML = `<strong>${dataBR(pontos[i].d)}</strong>${series.map((s) => `<div><span class="viz-amostra" style="background:var(${s.cor})"></span>${s.rotulo}: ${fmt(pontos[i][s.k])}</div>`).join('')}`;
    dica.hidden = false;
    const left = (x(i) / W) * r.width;
    dica.style.left = `${Math.min(left + 12, r.width - 190)}px`;
    dica.style.top = '8px';
  };
  alvo.addEventListener('pointermove', mover);
  alvo.addEventListener('pointerleave', () => { dica.hidden = true; guia.setAttribute('visibility', 'hidden'); });
}

function graficoBarras(caixa, itens) {
  caixa.innerHTML = '';
  const W = Math.max(300, caixa.clientWidth || 600), H = 200;
  const m = { l: 56, r: 8, t: 12, b: 28 };
  const max = Math.max(...itens.map((i) => i.v), 1) * 1.1;
  const passo = (W - m.l - m.r) / itens.length;
  const larg = Math.max(4, passo - 2); // 2px de espaço entre barras
  const y = (v) => m.t + (1 - v / max) * (H - m.t - m.b);
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Proventos por mês' });
  for (let i = 0; i <= 3; i++) {
    const v = (max * i) / 3;
    svg.append(svgEl('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'viz-grade' }));
    const t = svgEl('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'viz-eixo' });
    t.textContent = moedaCurta(v);
    svg.append(t);
  }
  const dica = document.createElement('div');
  dica.className = 'viz-dica';
  dica.hidden = true;
  itens.forEach((it, i) => {
    const x0 = m.l + i * passo + 1;
    const base = y(0), topo = y(it.v), h = base - topo;
    if (h > 0.5) {
      const r = Math.min(4, h, larg / 2);
      svg.append(svgEl('path', {
        d: `M${x0},${base}V${topo + r}Q${x0},${topo} ${x0 + r},${topo}H${x0 + larg - r}Q${x0 + larg},${topo} ${x0 + larg},${topo + r}V${base}Z`,
        class: 'viz-barra',
      }));
    }
    if (i % Math.ceil(itens.length / 6) === 0 || i === itens.length - 1) {
      const t = svgEl('text', { x: x0 + larg / 2, y: H - 8, 'text-anchor': 'middle', class: 'viz-eixo' });
      t.textContent = it.rotulo;
      svg.append(t);
    }
    const alvo = svgEl('rect', { x: m.l + i * passo, y: m.t, width: passo, height: H - m.t - m.b, fill: 'transparent' });
    alvo.addEventListener('pointerenter', () => {
      const r = svg.getBoundingClientRect();
      dica.innerHTML = `<strong>${it.rotulo}</strong><div>${fmt(it.v)}</div>`;
      dica.hidden = false;
      dica.style.left = `${Math.min(((x0 + larg) / W) * r.width + 6, r.width - 140)}px`;
      dica.style.top = '8px';
    });
    alvo.addEventListener('pointerleave', () => { dica.hidden = true; });
    svg.append(alvo);
  });
  caixa.append(svg, dica);
}

// ---------- Tela ----------

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function renderEvolucao() {
  const el = $('#evolucao-conteudo');
  if (!el) return;
  const h = estado.historico || [];
  const rent = h.length >= 2 ? rentabilidadePeriodo(h) : null;
  const provs = (estado.proventos || []).slice().sort((a, b) => b.data.localeCompare(a.data));
  const limite12 = new Date(); limite12.setFullYear(limite12.getFullYear() - 1);
  const total12 = provs.filter((p) => new Date(p.data) >= limite12).reduce((s, p) => s + p.valor, 0);
  const { custo } = totais();

  // Últimos 12 meses, do mais antigo ao mais recente
  const meses = [];
  const ref = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    meses.push({ chave, rotulo: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, v: 0 });
  }
  for (const p of provs) {
    const m = meses.find((x) => x.chave === p.data.slice(0, 7));
    if (m) m.v += p.valor;
  }

  const tickers = [...new Set(investidos().filter((a) => !classe(a.classe).rendaFixa).map((a) => a.nome))].sort();

  el.innerHTML = `
    <div class="card">
      <h2>Evolução do patrimônio</h2>
      ${h.length >= 2 ? `
        <div class="viz-legenda"><span><span class="viz-amostra" style="background:var(--serie-1)"></span>Patrimônio</span>
          <span><span class="viz-amostra" style="background:var(--serie-2)"></span>Total investido</span></div>
        <div class="viz-caixa" id="graf-patrimonio"></div>
        <details><summary class="dica">Ver em tabela</summary>
          <div class="tabela-wrap"><table><thead><tr><th>Data</th><th class="num">Patrimônio</th><th class="num">Investido</th><th class="num">Resultado</th></tr></thead>
          <tbody>${h.slice().reverse().map((p) => `<tr><td>${dataBR(p.d)}</td><td class="num">${fmt(p.v)}</td><td class="num">${fmt(p.c)}</td><td class="num ${p.v >= p.c ? 'pos' : 'neg'}">${fmt(p.v - p.c)}</td></tr>`).join('')}</tbody></table></div>
        </details>`
        : `<p class="dica">O histórico começou${h[0] ? ` em ${dataBR(h[0].d)}` : ''}. O site registra seu patrimônio uma vez por dia, sempre que você o abre; o gráfico aparece a partir do segundo dia.</p>`}
    </div>

    ${rent && rent.dias >= 1 ? `
    <div class="card">
      <h2>Rentabilidade desde ${dataBR(h[0].d)}</h2>
      <div class="resumo">
        <div class="kpi"><div class="rotulo">Sua carteira</div><div class="valor ${rent.carteira >= 0 ? 'pos' : 'neg'}">${pct(rent.carteira, 2)}</div></div>
        <div class="kpi"><div class="rotulo">CDI no período (aprox.)</div><div class="valor">${pct(rent.cdi, 2)}</div></div>
        <div class="kpi"><div class="rotulo">Ganho no período</div><div class="valor ${rent.ganho >= 0 ? 'pos' : 'neg'}">${fmt(rent.ganho)}</div></div>
      </div>
      <p class="dica">${rent.carteira >= rent.cdi ? 'A carteira está rendendo mais que o CDI no período.' : 'No período, a carteira rendeu menos que o CDI. Em prazos curtos isso é normal para renda variável; avalie em períodos de 1 ano ou mais.'}
        O cálculo desconta os aportes (método de Dietz). O CDI é estimado pela Selic atual. Os proventos não entram, porque saem da carteira.</p>
    </div>` : ''}

    <div class="card">
      <h2>Proventos recebidos</h2>
      <div class="resumo">
        <div class="kpi"><div class="rotulo">Últimos 12 meses</div><div class="valor pos">${fmt(total12)}</div></div>
        <div class="kpi"><div class="rotulo">Média mensal (12m)</div><div class="valor">${fmt(total12 / 12)}</div></div>
        <div class="kpi"><div class="rotulo">Rendimento sobre o investido (12m)</div><div class="valor">${pct(custo ? (total12 / custo) * 100 : 0, 2)}</div></div>
      </div>
      ${provs.length ? `<div class="viz-caixa" id="graf-proventos"></div>` : ''}
      <form id="form-provento" class="grade-form">
        <label>Data do pagamento <input type="date" id="prov-data" required value="${hojeISO()}"></label>
        <label>Ativo <input id="prov-ativo" list="lista-tickers" required placeholder="Ex.: ITSA4"></label>
        <datalist id="lista-tickers">${tickers.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
        <label>Valor recebido (R$) <input type="number" id="prov-valor" step="any" min="0" required placeholder="25,40"></label>
        <div class="acoes-form"><button class="btn" type="submit">Adicionar</button></div>
      </form>
      <details style="margin-top:10px"><summary class="dica">Colar vários de uma vez (ex.: do extrato da corretora ou do Investidor10)</summary>
        <p class="dica">Uma linha por pagamento com data, ativo e valor. Ex.: <code>15/09/2026 ITSA4 R$ 12,30</code></p>
        <textarea id="prov-texto" rows="4"></textarea>
        <button class="btn sec" type="button" id="prov-colar" style="margin-top:6px">Adicionar proventos</button>
        <p id="prov-status" class="dica"></p>
      </details>
      ${provs.length ? `<div class="tabela-wrap" style="margin-top:12px"><table>
        <thead><tr><th>Data</th><th>Ativo</th><th class="num">Valor</th><th></th></tr></thead>
        <tbody>${provs.slice(0, 50).map((p) => `<tr><td>${dataBR(p.data)}</td><td>${esc(p.ativo)}</td><td class="num">${fmt(p.valor)}</td>
          <td><button class="btn perigo mini" data-remover-prov="${esc(p.id)}">Remover</button></td></tr>`).join('')}</tbody>
      </table></div>${provs.length > 50 ? `<p class="dica">Mostrando os 50 mais recentes de ${provs.length}.</p>` : ''}` : '<p class="dica">Nenhum provento registrado ainda.</p>'}
    </div>`;

  if (h.length >= 2) graficoLinhas($('#graf-patrimonio'), h, [
    { k: 'v', rotulo: 'Patrimônio', cor: '--serie-1' },
    { k: 'c', rotulo: 'Total investido', cor: '--serie-2' },
  ]);
  if (provs.length) graficoBarras($('#graf-proventos'), meses);
}

function addProvento(data, ativo, valor) {
  estado.proventos = estado.proventos || [];
  estado.proventos.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, data, ativo: ativo.toUpperCase(), valor });
}

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'form-provento') return;
  e.preventDefault();
  const valor = parseFloat($('#prov-valor').value);
  if (!(valor > 0)) return;
  addProvento($('#prov-data').value, $('#prov-ativo').value.trim(), valor);
  salvar();
  renderEvolucao();
});

document.addEventListener('click', (e) => {
  const rem = e.target.closest('[data-remover-prov]');
  if (rem) {
    estado.proventos = (estado.proventos || []).filter((p) => p.id !== rem.dataset.removerProv);
    salvar();
    renderEvolucao();
    return;
  }
  if (e.target.id !== 'prov-colar') return;
  let n = 0;
  for (const linha of $('#prov-texto').value.split(/\r?\n/)) {
    const d = linha.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const t = linha.toUpperCase().match(/\b([A-Z][A-Z0-9]{3}\d{1,2})\b/);
    const nums = (linha.replace(/\d{2}\/\d{2}\/\d{4}/, '').match(/-?[\d.]*\d,\d{2}|\d+\.\d{2}\b/g) || []).map(numeroBR).filter((v) => v > 0);
    if (d && t && nums.length) {
      addProvento(`${d[3]}-${d[2]}-${d[1]}`, t[1], nums[nums.length - 1]);
      n++;
    }
  }
  salvar();
  renderEvolucao();
  $('#prov-status').textContent = n ? `${n} provento(s) adicionado(s).` : 'Nenhuma linha reconhecida. Use: data, ativo e valor em cada linha.';
});

window.addEventListener('resize', () => {
  if (document.querySelector('#evolucao.ativo')) renderEvolucao();
});

registrarHistorico();
