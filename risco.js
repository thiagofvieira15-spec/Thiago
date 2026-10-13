'use strict';

// Risco da carteira: simula os últimos anos com os pesos de hoje, usando os preços mensais
// baixados pelo robô (dados/historico.json). Mostra oscilação, pior queda, quem mais pesa
// no risco, ativos que andam juntos e concentração por setor.

function seriePrecos(ticker) {
  const H = typeof MERCADO !== 'undefined' && MERCADO?.historico;
  const h = H && H[ticker];
  if (!h?.m?.length || !h.m0) return null;
  let [y, m] = h.m0.split('-').map(Number);
  const out = new Map();
  for (const v of h.m) {
    out.set(`${y}-${String(m).padStart(2, '0')}`, v);
    if (++m > 12) { m = 1; y++; }
  }
  // Ativos cotados em dólar: converte para reais mês a mês
  const emDolar = (typeof ETFS_EUA !== 'undefined' && ETFS_EUA.has(ticker)) || ticker === 'BTC';
  if (emDolar) {
    const usd = ticker === 'USDBRL' ? null : seriePrecos('USDBRL');
    if (!usd) return null;
    for (const [k, v] of out) {
      if (usd.has(k)) out.set(k, v * usd.get(k)); else out.delete(k);
    }
  }
  return out;
}

// Substitutos quando o ativo não tem histórico próprio
const PROXY_CLASSE = { acoes: 'BOVA11', fiis: 'XFIX11', inter: 'VT', cripto: 'BTC' };

function retornosMensais(precos, meses) {
  const r = [];
  for (let i = 1; i < meses.length; i++) r.push(precos.get(meses[i]) / precos.get(meses[i - 1]) - 1);
  return r;
}

const media = (v) => v.reduce((s, x) => s + x, 0) / v.length;
const covar = (a, b) => { const ma = media(a), mb = media(b); return a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0) / (a.length - 1); };
const desvio = (v) => Math.sqrt(covar(v, v));

function piorQueda(retornos) {
  let pico = 1, acum = 1, pior = 0, fimPior = -1;
  retornos.forEach((r, i) => {
    acum *= 1 + r;
    pico = Math.max(pico, acum);
    const q = acum / pico - 1;
    if (q < pior) { pior = q; fimPior = i; }
  });
  return { pct: pior * 100, fim: fimPior };
}

function setorRisco(a) {
  const tipo = tipoAtivo(a);
  if (tipo === 'acao') return fundAtivo(a).setor || 'Ações (setor não identificado)';
  if (tipo === 'fii') return `FIIs de ${tipoFII(a)}`;
  if (a.classe === 'inter') return 'Internacional';
  if (a.classe === 'cripto') return 'Cripto';
  if (tipo === 'etf') return 'ETFs Brasil';
  return classe(a.classe).nome;
}

function analisarRisco() {
  if (typeof MERCADO === 'undefined' || !MERCADO?.historico) return null;
  const ativos = investidos();
  const { total } = totais();
  if (!total) return null;
  const selic = cenario().selic;
  const cdiMes = Math.pow(1 + selic / 100, 1 / 12) - 1;

  // Série de cada ativo de renda variável (própria ou substituta)
  const itens = [];
  const semDados = [];
  for (const a of ativos) {
    const w = valorAtivo(a) / total;
    if (classe(a.classe).rendaFixa) { itens.push({ a, w, rf: true }); continue; }
    const t = a.nome.replace(/F$/, '');
    let s = seriePrecos(t), proxy = null;
    if (!s && PROXY_CLASSE[a.classe]) { proxy = PROXY_CLASSE[a.classe]; s = seriePrecos(proxy); }
    if (!s) { semDados.push(a.nome); continue; }
    itens.push({ a, w, s, proxy });
  }
  const rv = itens.filter((x) => !x.rf);
  if (!rv.length) return null;
  // Meses em comum a todos (até 60)
  let meses = [...rv[0].s.keys()];
  for (const x of rv.slice(1)) meses = meses.filter((k) => x.s.has(k));
  meses.sort();
  meses = meses.slice(-61);
  if (meses.length < 25) return { poucos: true, meses: meses.length };

  const n = meses.length - 1;
  for (const x of itens) x.r = x.rf ? Array(n).fill(cdiMes) : retornosMensais(x.s, meses);
  const somaW = itens.reduce((s, x) => s + x.w, 0);
  const carteira = Array.from({ length: n }, (_, i) => itens.reduce((s, x) => s + (x.w / somaW) * x.r[i], 0));
  const varC = covar(carteira, carteira);
  const vol = Math.sqrt(varC) * Math.sqrt(12) * 100;
  const queda = piorQueda(carteira);
  let piorMes = 0;
  carteira.forEach((r, i) => { if (r < carteira[piorMes]) piorMes = i; });

  // Por ativo: oscilação, pior queda, participação no risco
  for (const x of rv) {
    x.vol = desvio(x.r) * Math.sqrt(12) * 100;
    x.queda = piorQueda(x.r).pct;
    x.risco = varC > 0 ? ((x.w / somaW) * covar(x.r, carteira)) / varC * 100 : 0;
    x.ret12 = (x.r.slice(-12).reduce((p, r) => p * (1 + r), 1) - 1) * 100;
  }
  const pesoRV = rv.reduce((s, x) => s + x.w, 0);
  const volMedia = rv.reduce((s, x) => s + x.w * x.vol, 0) / (pesoRV || 1);

  // Pares que andam juntos (só ações e FIIs com histórico próprio)
  const pares = [];
  const proprios = rv.filter((x) => !x.proxy && ['acao', 'fii'].includes(tipoAtivo(x.a)));
  for (let i = 0; i < proprios.length; i++) {
    for (let j = i + 1; j < proprios.length; j++) {
      const a = proprios[i], b = proprios[j];
      const c = covar(a.r, b.r) / (desvio(a.r) * desvio(b.r));
      if (c >= 0.65) pares.push({ a: a.a.nome, b: b.a.nome, c });
    }
  }
  pares.sort((x, y) => y.c - x.c);

  // Concentração por setor (em % do patrimônio investido)
  const setores = {};
  for (const a of ativos) {
    if (classe(a.classe).rendaFixa) continue;
    const s = setorRisco(a);
    setores[s] = (setores[s] || 0) + (valorAtivo(a) / total) * 100;
  }
  const listaSetores = Object.entries(setores).sort((x, y) => y[1] - x[1]);

  return { meses, n, vol, queda, piorMes: { pct: carteira[piorMes] * 100, mes: meses[piorMes + 1] }, mesQueda: meses[queda.fim + 1],
    volMedia, rv, pares: pares.slice(0, 5), listaSetores, semDados, pesoRV: pesoRV * 100 };
}

const mesBR = (k) => { const [y, m] = k.split('-'); return `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][m - 1]}/${y}`; };
const FINANCEIRO = /financ|banco|seguro|previd|holding|intermedi/i;

function cardRisco() {
  const r = analisarRisco();
  if (!r) return '';
  if (r.poucos) return `<div class="card"><h2>Risco da carteira</h2><p class="dica" style="margin-top:0">O histórico de preços ainda está sendo baixado (${r.meses} meses em comum). Volte em alguns dias.</p></div>`;
  const anos = Math.round((r.n / 12) * 10) / 10;
  const alertas = [];
  for (const [s, p] of r.listaSetores) {
    if (p > 10 && !/Internacional|FIIs/.test(s)) alertas.push(`${s}: ${pct(p)} do patrimônio em um único setor.`);
  }
  const fin = r.listaSetores.filter(([s]) => FINANCEIRO.test(s)).reduce((t, [, p]) => t + p, 0);
  const nomesFin = r.listaSetores.filter(([s]) => FINANCEIRO.test(s)).map(([s]) => s);
  if (fin > 8 && nomesFin.length > 1) alertas.push(`Setor financeiro somado (${nomesFin.join(', ')}): ${pct(fin)} do patrimônio. São negócios diferentes, mas sofrem juntos em crises de crédito.`);
  const maxSetor = Math.max(...r.listaSetores.map(([, p]) => p), 1);
  const topRisco = r.rv.slice().sort((x, y) => y.risco - x.risco).slice(0, 5);

  return `<div class="card">
    <h2>Risco da carteira</h2>
    <p class="dica" style="margin-top:0">Simulação dos últimos ${f1(anos)} anos com os pesos de hoje (renda fixa rendendo o CDI atual).</p>
    <div class="resumo">
      <div class="kpi"><div class="rotulo">Oscilação anual</div><div class="valor">${f1(r.vol)}%</div><div class="motivo">${r.vol < 6 ? 'baixa' : r.vol < 12 ? 'moderada' : 'alta'} · ações e FIIs sozinhos: ${f1(r.volMedia)}%</div></div>
      <div class="kpi"><div class="rotulo">Pior queda acumulada</div><div class="valor neg">${f1(r.queda.pct)}%</div><div class="motivo">${r.mesQueda ? `até ${mesBR(r.mesQueda)}` : ''} · hoje seria ${fmt((r.queda.pct / 100) * totais().total)}</div></div>
      <div class="kpi"><div class="rotulo">Pior mês</div><div class="valor neg">${f1(r.piorMes.pct)}%</div><div class="motivo">${mesBR(r.piorMes.mes)}</div></div>
    </div>
    ${alertas.map((a) => `<p class="alerta">${esc(a)}</p>`).join('')}

    <h3>Concentração por setor (% do patrimônio)</h3>
    <div class="barras">${r.listaSetores.slice(0, 8).map(([s, p]) => `<div class="barra-linha">
      <div class="cab"><span>${esc(s)}</span><span class="num">${pct(p)}</span></div>
      <div class="trilho"><div class="preench" style="width:${(p / maxSetor) * 100}%;background:var(--serie-1)"></div></div></div>`).join('')}</div>

    <h3>Quem mais pesa no risco</h3>
    <div class="tabela-wrap"><table>
      <thead><tr><th>Ativo</th><th class="num">% carteira</th><th class="num">% do risco</th><th class="num">Oscilação a.a.</th><th class="num">Pior queda</th><th class="num">12 meses</th></tr></thead>
      <tbody>${topRisco.map((x) => `<tr><td><strong>${esc(x.a.nome)}</strong>${x.proxy ? `<br><span class="motivo">estimado por ${x.proxy}</span>` : ''}</td>
        <td class="num">${pct(x.w * 100)}</td><td class="num"><strong>${pct(x.risco)}</strong></td><td class="num">${f1(x.vol)}%</td>
        <td class="num neg">${f1(x.queda)}%</td><td class="num ${x.ret12 >= 0 ? 'pos' : 'neg'}">${x.ret12 >= 0 ? '+' : ''}${f1(x.ret12)}%</td></tr>`).join('')}</tbody>
    </table></div>
    <p class="dica">Quando a % do risco é bem maior que a % da carteira, o ativo oscila muito ou anda junto com o resto.</p>

    ${r.pares.length ? `<h3>Ativos que andam juntos</h3>
    <ul class="limpa">${r.pares.map((p) => `<li><strong>${esc(p.a)}</strong> e <strong>${esc(p.b)}</strong>: correlação de ${f2(p.c)}. Na prática, diversificam pouco entre si.</li>`).join('')}</ul>` : ''}
    <details><summary>Oscilação de todos os ativos</summary>
      <div class="tabela-wrap"><table>
        <thead><tr><th>Ativo</th><th class="num">Oscilação a.a.</th><th class="num">Pior queda</th><th class="num">12 meses</th></tr></thead>
        <tbody>${r.rv.slice().sort((x, y) => y.vol - x.vol).map((x) => `<tr><td>${esc(x.a.nome)}${x.proxy ? ` <span class="motivo">(por ${x.proxy})</span>` : ''}</td><td class="num">${f1(x.vol)}%</td><td class="num neg">${f1(x.queda)}%</td><td class="num">${f1(x.ret12)}%</td></tr>`).join('')}</tbody>
      </table></div>
    </details>
    <p class="dica">Variação mensal de preço (Fundamentus, Nasdaq, Banco Central e Kraken), sem contar proventos; ativos em dólar convertidos para reais. Tesouro IPCA+ entra como renda fixa sem oscilação (supõe que você leva até o vencimento); vendido antes, ele oscila bastante.${r.semDados.length ? ` Sem histórico: ${esc(r.semDados.join(', '))}.` : ''}</p>
  </div>`;
}
