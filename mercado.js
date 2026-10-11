'use strict';

// Dados de mercado gerados automaticamente (dados/mercado.json) e importação de carteira.
// Carregado antes de app.js; usa os utilitários de app.js apenas em tempo de execução.

let MERCADO = null;

async function carregarMercado() {
  try {
    const r = await fetch(`dados/mercado.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    MERCADO = await r.json();
  } catch (e) {
    MERCADO = null; // aberto como arquivo local ou ainda sem dados
  }
  if (MERCADO) {
    aplicarMercado();
    salvar();
  }
  renderStatusMercado();
  renderCarteira();
  if (estado.perfil) renderDiagnostico();
  renderAnalise();
}

function dadoMercado(ticker) {
  if (!MERCADO) return null;
  const t = ticker.replace(/F$/, '');
  if (MERCADO.acoes?.[t]) return { tipo: 'acao', d: MERCADO.acoes[t] };
  if (MERCADO.fiis?.[t]) return { tipo: 'fii', d: MERCADO.fiis[t] };
  if (MERCADO.etfs?.[t]) return { tipo: 'etf', d: MERCADO.etfs[t] };
  return null;
}

const CAMPOS_FUND = ['pl', 'pvp', 'dy', 'roe', 'margem', 'divPl', 'cresc', 'vacancia', 'nAtivos'];

function aplicarMercado() {
  const quando = Date.parse(MERCADO.atualizadoEm) || Date.now();
  for (const a of estado.ativos) {
    if (classe(a.classe).rendaFixa) continue;
    const m = dadoMercado(a.nome);
    if (!m) continue;
    // Uma cotação mais recente (ex.: brapi) não é substituída
    if (!(a.cotadoEm > quando)) {
      a.pa = m.d.preco;
      a.varDia = m.d.varDia;
      a.cotadoEm = quando;
    }
    if (m.tipo === 'etf') continue;
    const manuais = a.fund?.manuais || [];
    a.fund = Object.assign({}, a.fund);
    for (const k of CAMPOS_FUND) {
      if (manuais.includes(k)) continue;
      if (Number.isFinite(m.d[k])) a.fund[k] = m.d[k];
    }
    if (m.d.segmento) a.fund.setor = m.d.segmento;
    if (m.d.banco) a.fund.banco = true;
    a.fund.atualizadoEm = quando;
  }
}

function renderStatusMercado() {
  const el = $('#status-mercado');
  if (!el) return;
  if (!MERCADO) {
    el.innerHTML = 'Os dados automáticos aparecem quando o site está publicado (GitHub Pages). Abrindo o arquivo direto no computador, use os preços digitados ou a brapi.';
    return;
  }
  const d = new Date(MERCADO.atualizadoEm);
  const n = (k) => Object.keys(MERCADO[k] || {}).length;
  const cobertos = estado.ativos.filter((a) => !classe(a.classe).rendaFixa && dadoMercado(a.nome)).length;
  const variaveis = estado.ativos.filter((a) => !classe(a.classe).rendaFixa).length;
  el.innerHTML = `<span class="ok">●</span> Cotações e indicadores de <strong>${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>
    (${n('acoes')} ações, ${n('fiis')} FIIs e ${n('etfs')} ETFs). ${variaveis ? `${cobertos} de ${variaveis} ativos de renda variável da sua carteira foram atualizados.` : ''}`;
}

// ---------- Importação (Investidor10 e outros) ----------

const ETF_CLASSE = {
  IVVB11: 'inter', SPXI11: 'inter', WRLD11: 'inter', ACWI11: 'inter', NASD11: 'inter', QQQM11: 'inter', EURP11: 'inter',
  XINA11: 'inter', USAL11: 'inter', SPXB11: 'inter', BIVB11: 'inter', TECK11: 'inter', UTEC11: 'inter', GOLD11: 'inter',
  HASH11: 'cripto', BITH11: 'cripto', QBTC11: 'cripto', ETHE11: 'cripto', QETH11: 'cripto',
  IMAB11: 'rf_ipca', B5P211: 'rf_ipca', IB5M11: 'rf_ipca', DEBB11: 'rf_ipca', IRFM11: 'rf_pre', FIXA11: 'rf_pre', LFTS11: 'rf_pos',
};

function classePorTicker(t) {
  t = t.replace(/F$/, '');
  if (ETF_CLASSE[t]) return ETF_CLASSE[t];
  if (ETFS.has(t)) return 'acoes';
  if (MERCADO?.fiis?.[t]) return 'fiis';
  if (MERCADO?.acoes?.[t]) return 'acoes';
  if (/^[A-Z]{4}3[2-59]$/.test(t)) return 'inter'; // BDR
  if (/11$/.test(t)) return 'fiis';
  return 'acoes';
}

function classeTesouro(nome) {
  if (/selic/i.test(nome)) return 'rf_pos';
  if (/ipca|renda\+|educa\+/i.test(nome)) return 'rf_ipca';
  return 'rf_pre';
}

// "R$ 1.234,56" -> 1234.56 ; "100" -> 100 ; "1,5" -> 1.5
function numeroBR(s) {
  let t = String(s).replace(/R\$|\s/g, '');
  if (!/^-?[\d.,]+$/.test(t)) return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
  else if (/^\d{1,3}\.\d{3}$/.test(t)) t = t.replace('.', ''); // "1.000" = mil
  return parseFloat(t);
}

const RE_TICKER = /^[A-Z]{4}\d{1,2}F?$/;
const RE_TESOURO = /Tesouro\s+(Selic|IPCA\+?|Prefixado|Renda\+|Educa\+)(\s+com\s+Juros\s+Semestrais)?(\s+Aposentadoria\s+Extra)?\s+\d{4}/i;

function interpretarTexto(texto) {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // 1) Planilha/tabela com cabeçalho (colunas separadas por tab ou ;)
  const sep = linhas.some((l) => l.includes('\t')) ? '\t' : linhas.some((l) => l.includes(';')) ? ';' : null;
  if (sep) {
    const iCab = linhas.findIndex((l) => /quant/i.test(l) && /m[eé]dio/i.test(l));
    if (iCab >= 0) {
      const cab = linhas[iCab].split(sep).map((c) => c.trim().toLowerCase());
      const col = (re) => cab.findIndex((c) => re.test(c));
      const cQ = col(/quant/), cPM = col(/m[eé]dio/), cPA = col(/atual|cota[cç][aã]o/);
      const itens = [];
      for (const l of linhas.slice(iCab + 1)) {
        const cel = l.split(sep).map((c) => c.trim());
        const nome = cel.map((c) => c.toUpperCase().split(/\s+/)[0]).find((c) => RE_TICKER.test(c)) || (l.match(RE_TESOURO) || [])[0];
        const qtd = numeroBR(cel[cQ]), pm = numeroBR(cel[cPM]);
        if (nome && qtd > 0 && pm > 0) itens.push(novoItem(nome, qtd, pm, cPA >= 0 ? numeroBR(cel[cPA]) : NaN));
      }
      if (itens.length) return itens;
    }
  }

  // 2) Texto livre: cada ticker seguido de quantidade e preço médio
  const pedacos = texto.replace(RE_TESOURO, (m) => ` §${m.replace(/\s+/g, '_')}§ `).split(/[\s;\t|]+/);
  const itens = [];
  let atual = null;
  for (const p of pedacos) {
    const tesouro = p.match(/^§(.+)§$/);
    const tk = p.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (tesouro || (RE_TICKER.test(tk) && tk === p.toUpperCase())) {
      if (atual) itens.push(atual);
      atual = { nome: tesouro ? tesouro[1].replace(/_/g, ' ') : tk, nums: [] };
      continue;
    }
    if (atual && !p.includes('%')) {
      const v = numeroBR(p);
      if (Number.isFinite(v)) atual.nums.push(v);
    }
  }
  if (atual) itens.push(atual);
  return itens
    .filter((i) => i.nums.length >= 2 && i.nums[0] > 0 && i.nums[1] > 0)
    .map((i) => novoItem(i.nome, i.nums[0], i.nums[1], i.nums[2]));
}

function novoItem(nome, qtd, pm, pa) {
  const tesouro = /^tesouro/i.test(nome);
  const ticker = tesouro ? nome : nome.toUpperCase();
  const m = tesouro ? null : dadoMercado(ticker);
  return {
    incluir: true,
    nome: tesouro ? nome.replace(/\s+/g, ' ').trim() : ticker,
    classe: tesouro ? classeTesouro(nome) : classePorTicker(ticker),
    qtd,
    pm,
    pa: m?.d.preco ?? (Number.isFinite(pa) && pa > 0 ? pa : pm),
  };
}

let itensImportacao = [];

function renderPreviaImportacao() {
  const el = $('#previa-importacao');
  if (!itensImportacao.length) {
    el.innerHTML = '<p class="neg">Não encontrei ativos no texto. Confira se copiou a tabela com ticker, quantidade e preço médio.</p>';
    return;
  }
  el.innerHTML = `
    <p>Encontrei <strong>${itensImportacao.length}</strong> ativo(s). Confira a classe, a quantidade e o preço médio antes de confirmar:</p>
    <div class="tabela-wrap"><table>
      <thead><tr><th></th><th>Ativo</th><th>Classe</th><th class="num">Quantidade</th><th class="num">Preço médio</th><th class="num">Preço atual</th></tr></thead>
      <tbody>${itensImportacao.map((it, i) => `<tr data-i="${i}">
        <td><input type="checkbox" data-c="incluir" ${it.incluir ? 'checked' : ''}></td>
        <td><strong>${esc(it.nome)}</strong></td>
        <td><select data-c="classe">${CLASSES.map((c) => `<option value="${c.id}" ${c.id === it.classe ? 'selected' : ''}>${c.curto}</option>`).join('')}</select></td>
        <td class="num"><input type="number" step="any" data-c="qtd" value="${it.qtd}" style="width:90px"></td>
        <td class="num"><input type="number" step="any" data-c="pm" value="${it.pm}" style="width:100px"></td>
        <td class="num">${fmt(it.pa)}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    <div class="linha-botoes" style="margin-top:12px">
      <button class="btn" type="button" id="confirmar-importacao" data-modo="substituir">Substituir minha carteira</button>
      <button class="btn sec" type="button" id="somar-importacao">Somar à carteira atual</button>
    </div>`;
}

$('#analisar-importacao').addEventListener('click', () => {
  itensImportacao = interpretarTexto($('#texto-importacao').value);
  renderPreviaImportacao();
});

$('#arquivo-importacao').addEventListener('change', async (e) => {
  const arq = e.target.files[0];
  if (!arq) return;
  $('#texto-importacao').value = await arq.text();
  itensImportacao = interpretarTexto($('#texto-importacao').value);
  renderPreviaImportacao();
  e.target.value = '';
});

$('#previa-importacao').addEventListener('change', (e) => {
  const tr = e.target.closest('tr[data-i]');
  if (!tr) return;
  const it = itensImportacao[tr.dataset.i];
  const c = e.target.dataset.c;
  if (c === 'incluir') it.incluir = e.target.checked;
  else if (c === 'classe') it.classe = e.target.value;
  else it[c] = parseFloat(e.target.value) || 0;
});

$('#previa-importacao').addEventListener('click', (e) => {
  const somar = e.target.id === 'somar-importacao';
  if (!somar && e.target.id !== 'confirmar-importacao') return;
  const escolhidos = itensImportacao.filter((i) => i.incluir && i.qtd > 0 && i.pm > 0);
  if (!escolhidos.length) return;
  if (!somar && estado.ativos.length && !confirm(`Substituir os ${estado.ativos.length} ativos atuais pelos ${escolhidos.length} importados?`)) return;

  const base = somar ? estado.ativos : [];
  for (const it of escolhidos) {
    const existente = base.find((a) => a.nome === it.nome);
    if (existente) {
      const qtd = existente.qtd + it.qtd;
      existente.pm = (existente.qtd * existente.pm + it.qtd * it.pm) / qtd;
      existente.qtd = qtd;
    } else {
      base.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, nome: it.nome, classe: it.classe, qtd: it.qtd, pm: it.pm, pa: it.pa });
    }
  }
  estado.ativos = base;
  if (MERCADO) aplicarMercado();
  salvar();
  itensImportacao = [];
  $('#texto-importacao').value = '';
  $('#previa-importacao').innerHTML = `<p class="ok">${escolhidos.length} ativo(s) importado(s). Renda fixa e Tesouro: confira o preço atual (saldo) na tabela abaixo.</p>`;
  renderCarteira();
  renderStatusMercado();
});
// Ativo cadastrado à mão recebe cotação e indicadores na hora
$('#form-ativo').addEventListener('submit', () => {
  if (!MERCADO) return;
  aplicarMercado();
  salvar();
  renderCarteira();
});

carregarMercado();
