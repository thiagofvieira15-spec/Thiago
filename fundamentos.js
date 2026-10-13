'use strict';

// Análise fundamentalista simplificada de ações e FIIs.
// Carregado antes de app.js; usa os utilitários de app.js apenas em tempo de execução.

// ETFs comuns da B3 (não têm análise de fundamentos própria)
const ETFS = new Set([
  'BOVA11', 'BOVV11', 'BOVB11', 'BOVX11', 'SMAL11', 'SMAC11', 'DIVO11', 'NSDV11', 'IVVB11', 'SPXI11', 'WRLD11',
  'ACWI11', 'NASD11', 'QQQM11', 'EURP11', 'XINA11', 'GOLD11', 'HASH11', 'BITH11', 'QBTC11', 'ETHE11', 'QETH11',
  'XFIX11', 'BBSD11', 'ECOO11', 'FIND11', 'GOVE11', 'MATB11', 'IMAB11', 'IRFM11', 'B5P211', 'FIXA11', 'IB5M11',
  'LFTS11', 'DEBB11', 'PIBB11', 'BRAX11', 'ISUS11', 'UTEC11', 'TECK11', 'USAL11', 'SPXB11', 'BIVB11', 'DNAI11',
]);

// ETFs negociados nos EUA (conta no exterior)
const ETFS_EUA = new Set([
  'VT', 'VTI', 'VOO', 'IVV', 'SPY', 'VXUS', 'VEA', 'VWO', 'QQQ', 'QQQM', 'SCHD', 'VIG', 'VYM', 'ACWI', 'IEFA', 'IEMG',
  'AVUV', 'AVDV', 'DGRO', 'BND', 'BNDX', 'AGG', 'TLT', 'IEF', 'SHY', 'TIP', 'VNQ', 'GLD', 'IAU', 'SGOV', 'BIL', 'IBIT',
]);

// ETFs e fundos de índice já são diversificados: não entram no limite de concentração
function ehFundoDiversificado(a) {
  const t = a.nome.replace(/F$/, '');
  return ETFS.has(t) || ETFS_EUA.has(a.nome);
}

function tipoAtivo(a) {
  const ticker = a.nome.replace(/F$/, '');
  if (classe(a.classe).rendaFixa) return 'rf';
  if (ETFS.has(ticker) || ETFS_EUA.has(a.nome)) return 'etf';
  if (a.classe === 'fiis') return 'fii';
  if (a.classe === 'acoes' && /^[A-Z][A-Z0-9]{3}\d{1,2}$/.test(ticker)) return 'acao';
  return 'outro';
}

// Cada indicador: chave, rótulo, unidade e função que devolve [nível, texto] (nível 1 bom, 0 neutro, -1 ruim)
const INDICADORES = {
  acao: [
    ['pl', 'P/L', 'x', (v, a) => {
      if (v < 0) return [-1, 'P/L negativo: a empresa teve prejuízo nos últimos 12 meses.'];
      const m = medSetor(a, 'pl');
      if (m) {
        if (v > 40) return [-1, `P/L de ${f1(v)}: muito alto, mesmo para o setor (mediana ${f1(m)}).`];
        return v <= m * 0.8 ? [1, `P/L de ${f1(v)}: abaixo da mediana do setor (${f1(m)}). Mais barata que as concorrentes.`]
          : v <= m * 1.25 ? [0, `P/L de ${f1(v)}: em linha com a mediana do setor (${f1(m)}).`]
          : [-1, `P/L de ${f1(v)}: acima da mediana do setor (${f1(m)}). O mercado já cobra pelo crescimento esperado.`];
      }
      return v <= 12 ? [1, `P/L de ${f1(v)}: preço baixo em relação ao lucro.`]
        : v <= 20 ? [0, `P/L de ${f1(v)}: preço moderado em relação ao lucro.`]
        : [-1, `P/L de ${f1(v)}: preço alto em relação ao lucro. Exige crescimento forte para se justificar.`];
    }],
    ['pvp', 'P/VP', 'x', (v, a) => {
      if (v <= 0) return [-1, 'Patrimônio líquido negativo.'];
      const m = medSetor(a, 'pvp');
      if (m) {
        return v <= m * 0.8 ? [1, `P/VP de ${f1(v)}: abaixo da mediana do setor (${f1(m)}).`]
          : v <= m * 1.25 ? [0, `P/VP de ${f1(v)}: em linha com a mediana do setor (${f1(m)}).`]
          : [-1, `P/VP de ${f1(v)}: acima da mediana do setor (${f1(m)}).`];
      }
      return v <= 1.5 ? [1, `P/VP de ${f1(v)}: negociada perto do valor patrimonial.`]
        : v <= 3 ? [0, `P/VP de ${f1(v)}: prêmio moderado sobre o patrimônio.`]
        : [-1, `P/VP de ${f1(v)}: prêmio alto sobre o patrimônio. Comum em empresas de alto retorno, mas aumenta o risco.`];
    }],
    ['dy', 'Dividend yield (12m)', '%', (v) => v >= 7 ? [1, `Dividend yield de ${f1(v)}%: boa geração de renda.`]
      : v >= 3 ? [0, `Dividend yield de ${f1(v)}%: renda moderada.`]
      : [0, `Dividend yield de ${f1(v)}%: paga pouco. Normal para empresas que reinvestem para crescer.`]],
    ['roe', 'ROE', '%', (v, a) => {
      const m = medSetor(a, 'roe');
      const comp = m ? ` (mediana do setor: ${f1(m)}%)` : '';
      if (v >= 20 || (m && v >= m * 1.15 && v >= 10)) return [1, `ROE de ${f1(v)}%: empresa muito rentável${comp}.`];
      if (v < 5 || (m && v < m * 0.7)) return [-1, `ROE de ${f1(v)}%: rentabilidade baixa${comp}. Com a Selic em ${f2(cenario().selic)}%, a renda fixa rende mais com menos risco.`];
      return [0, `ROE de ${f1(v)}%: rentabilidade razoável${comp}.`];
    }],
    ['margem', 'Margem líquida', '%', (v, a) => {
      if (v < 0) return [-1, `Margem líquida negativa (${f1(v)}%): a empresa opera com prejuízo.`];
      const m = medSetor(a, 'margem');
      if (m) {
        return v >= m * 1.15 ? [1, `Margem líquida de ${f1(v)}%: acima da mediana do setor (${f1(m)}%).`]
          : v >= m * 0.75 ? [0, `Margem líquida de ${f1(v)}%: em linha com o setor (${f1(m)}%).`]
          : [-1, `Margem líquida de ${f1(v)}%: abaixo do setor (${f1(m)}%), menos eficiente que as concorrentes.`];
      }
      return v >= 10 ? [1, `Margem líquida de ${f1(v)}%: negócio eficiente.`] : [0, `Margem líquida de ${f1(v)}%: margens apertadas.`];
    }],
    ['divPl', 'Dívida líquida / Patrimônio', 'x', (v, a) => a.fund?.banco ? [0, 'Banco: o endividamento faz parte do negócio e não é avaliado.']
      : v < 0 ? [1, 'Caixa líquido: a empresa tem mais dinheiro em caixa do que dívidas.']
      : v <= 1 ? [1, `Dívida líquida/patrimônio de ${f1(v)}: endividamento controlado.`]
      : v <= 2 ? [0, `Dívida líquida/patrimônio de ${f1(v)}: endividamento moderado.`]
      : [-1, `Dívida líquida/patrimônio de ${f1(v)}: endividamento alto. Com juros altos, a dívida pesa muito no resultado.`]],
    ['cresc', 'Crescimento da receita', '% a.a.', (v) => v >= 5 ? [1, `Receita crescendo ${f1(v)}% ao ano.`]
      : v >= -5 ? [0, `Receita estável (${f1(v)}% ao ano).`]
      : [-1, `Receita caindo ${f1(-v)}% ao ano.`]],
  ],
  fii: [
    ['pvp', 'P/VP', 'x', (v, a) => tipoFII(a) === 'papel' ? (v < 0.9 ? [0, `P/VP de ${f2(v)}: desconto grande para um fundo de crédito. O mercado desconfia de algum CRI da carteira; investigue.`]
      : v <= 1.03 ? [1, `P/VP de ${f2(v)}: preço justo para um fundo de crédito.`]
      : v <= 1.08 ? [0, `P/VP de ${f2(v)}: leve ágio. Em fundo de crédito, o ágio reduz o retorno sem aumentar o valor dos títulos.`]
      : [-1, `P/VP de ${f2(v)}: ágio alto para um fundo de crédito.`])
      : v < 0.85 ? [0, `P/VP de ${f2(v)}: bem abaixo do patrimônio. Pode ser oportunidade ou sinal de problema; investigue.`]
      : v <= 1.05 ? [1, `P/VP de ${f2(v)}: preço justo em relação ao patrimônio.`]
      : v <= 1.15 ? [0, `P/VP de ${f2(v)}: leve ágio sobre o patrimônio.`]
      : [-1, `P/VP de ${f2(v)}: ágio alto. Você paga bem mais que o valor dos imóveis ou títulos.`]],
    ['dy', 'Dividend yield (12m)', '%', (v) => {
      const cdi = cenario().selic;
      return v >= cdi * 0.85 ? [1, `Dividend yield de ${f1(v)}%: competitivo com o CDI (~${f2(cdi)}%), com isenção de IR.`]
        : v >= cdi * 0.65 ? [0, `Dividend yield de ${f1(v)}%: abaixo do CDI (~${f2(cdi)}%), compensado em parte pela isenção de IR.`]
        : [-1, `Dividend yield de ${f1(v)}%: baixo frente ao CDI (~${f2(cdi)}%).`];
    }],
    ['vacancia', 'Vacância', '%', (v) => v <= 5 ? [1, `Vacância de ${f1(v)}%: imóveis bem ocupados.`]
      : v <= 15 ? [0, `Vacância de ${f1(v)}%: moderada.`]
      : [-1, `Vacância de ${f1(v)}%: alta, o que reduz a renda distribuída.`]],
    ['nAtivos', 'Nº de imóveis / CRIs', '', (v) => v >= 8 ? [1, `${v} ativos no portfólio: boa diversificação.`]
      : v >= 3 ? [0, `${v} ativos no portfólio: diversificação moderada.`]
      : [-1, `Só ${v} ativo(s) no portfólio: risco concentrado em poucos inquilinos ou devedores.`]],
  ],
  etf: [
    ['taxa', 'Taxa de administração', '% a.a.', (v) => v <= 0.2 ? [1, `Taxa de ${f2(v)}% ao ano: muito barata. Quase todo o retorno do índice fica com você.`]
      : v <= 0.6 ? [0, `Taxa de ${f2(v)}% ao ano: razoável.`]
      : [-1, `Taxa de ${f2(v)}% ao ano: cara para um fundo de índice. Compare com alternativas.`]],
    ['nAtivos', 'Nº de ativos no fundo', '', (v) => v >= 1000 ? [1, `${Number(v).toLocaleString('pt-BR')} ativos: diversificação muito ampla.`]
      : v >= 50 ? [0, `${Number(v).toLocaleString('pt-BR')} ativos: diversificação razoável.`]
      : [-1, `Só ${v} ativos: fundo concentrado.`]],
    ['paises', 'Nº de países', '', (v) => v >= 20 ? [1, `Investe em ${v} países: diversificação global, sem depender de uma só economia.`]
      : v >= 2 ? [0, `Investe em ${v} países.`]
      : [0, 'Concentrado em um único país.']],
    ['pl', 'P/L médio da carteira', 'x', (v) => v <= 15 ? [1, `P/L médio de ${f1(v)}: ações baratas em relação ao lucro.`]
      : v <= 22 ? [0, `P/L médio de ${f1(v)}: preço em linha com a média histórica.`]
      : [-1, `P/L médio de ${f1(v)}: ações caras; retorno futuro tende a ser menor.`]],
    ['dy', 'Dividend yield', '%', (v) => [0, `Dividend yield de ${f1(v)}% ao ano. Em ETF de crescimento global, o retorno vem principalmente da valorização.`]],
  ],
};

// FII de papel (crédito imobiliário/CRIs, ou fundo de fundos) ou de tijolo (imóveis)
function tipoFII(a) {
  const f = a.fund || {};
  if (f.tipoFII) return f.tipoFII;
  return f.nAtivos > 0 ? 'tijolo' : 'papel';
}

// Dados de referência de ETFs (fonte: sites dos gestores; valores aproximados — confira e corrija se necessário)
const ETF_INFO = {
  VT: { taxa: 0.06, nAtivos: 9800, paises: 49, pl: 20, dy: 1.9, nome: 'Vanguard Total World Stock', eua: true },
  VTI: { taxa: 0.03, nAtivos: 3600, paises: 1, pl: 25, dy: 1.2, eua: true },
  VOO: { taxa: 0.03, nAtivos: 500, paises: 1, pl: 25, dy: 1.2, eua: true },
  IVV: { taxa: 0.03, nAtivos: 500, paises: 1, pl: 25, dy: 1.2, eua: true },
  SPY: { taxa: 0.09, nAtivos: 500, paises: 1, pl: 25, dy: 1.2, eua: true },
  VXUS: { taxa: 0.05, nAtivos: 8500, paises: 48, pl: 15, dy: 2.9, eua: true },
  ACWI: { taxa: 0.32, nAtivos: 2300, paises: 47, pl: 20, dy: 1.7, eua: true },
  QQQ: { taxa: 0.20, nAtivos: 100, paises: 1, pl: 33, dy: 0.6, eua: true },
  SCHD: { taxa: 0.06, nAtivos: 100, paises: 1, pl: 17, dy: 3.6, eua: true },
  BOVA11: { taxa: 0.10, nAtivos: 85, paises: 1 },
  IVVB11: { taxa: 0.23, nAtivos: 500, paises: 1 },
  SMAL11: { taxa: 0.50, paises: 1 },
  DIVO11: { taxa: 0.50, paises: 1 },
  HASH11: { taxa: 0.70 },
};

// Indicadores efetivos: para ETFs, os dados de referência completam o que o usuário não preencheu
function fundAtivo(a) {
  if (tipoAtivo(a) !== 'etf') return a.fund || {};
  return Object.assign({}, ETF_INFO[a.nome.replace(/F$/, '')] || {}, a.fund || {});
}

// Mediana do setor da ação (calculada pelo robô a partir de todas as ações do mesmo setor)
function medSetor(a, k) {
  const setores = typeof MERCADO !== 'undefined' && MERCADO?.setores;
  const st = setores && a.fund?.setor && setores[a.fund.setor];
  return st && Number.isFinite(st[k]) && st[k] > 0 ? st[k] : null;
}

// Preço-teto: Graham (valor intrínseco) e Bazin (dividendos / 6%)
const TAXA_BAZIN = 6;
function valuation(a) {
  const tipo = tipoAtivo(a);
  const f = fundAtivo(a);
  const p = preco(a);
  if (!p) return null;
  if (tipo === 'acao') {
    const lpa = f.pl > 0 ? p / f.pl : null;
    const vpa = f.pvp > 0 ? p / f.pvp : null;
    const graham = lpa && vpa ? Math.sqrt(22.5 * lpa * vpa) : null;
    const bazin = f.dy > 0 ? ((f.dy / 100) * p) / (TAXA_BAZIN / 100) : null;
    // P/L médio da própria empresa nos últimos anos: só para quem teve lucro em todos os anos
    const h = histAtivo(a);
    const hist = lpa && h?.plMed && lucroConsistente(h) ? lpa * h.plMed : null;
    if (!graham && !bazin && !hist) return null;
    return { tipo, p, graham, bazin, hist, plMed: h?.plMed };
  }
  if (tipo === 'fii' && f.pvp > 0) return { tipo, p, vp: p / f.pvp };
  return null;
}

// Histórico de 5 anos (preços mensais, lucros e P/L de cada ano), baixado pelo robô
function histAtivo(a) {
  const h = typeof MERCADO !== 'undefined' && MERCADO?.historico;
  return (h && h[a.nome.replace(/F$/, '')]) || null;
}

function lucroConsistente(h) {
  const l = Object.values(h?.lucros || {});
  return l.length >= 4 && l.every((v) => v > 0);
}

// Maior preço-teto entre os métodos disponíveis
const tetoMaior = (v) => (v ? Math.max(v.graham || 0, v.bazin || 0, v.hist || 0) : 0);

// Comparação com o próprio passado: P/L de hoje contra a mediana dos últimos anos e evolução do lucro
function pontosHistorico(a) {
  const h = histAtivo(a);
  if (!h) return [];
  const out = [];
  const f = fundAtivo(a);
  if (h.plMed && f.pl > 0) {
    const r = f.pl / h.plMed;
    out.push(r <= 0.85 ? [1, `P/L de ${f1(f.pl)} abaixo da média da própria empresa nos últimos anos (${f1(h.plMed)}): mais barata que o normal dela.`]
      : r <= 1.2 ? [0, `P/L de ${f1(f.pl)} perto da média da própria empresa nos últimos anos (${f1(h.plMed)}).`]
      : [-1, `P/L de ${f1(f.pl)} acima da média da própria empresa nos últimos anos (${f1(h.plMed)}): mais cara que o normal dela.`]);
  }
  const anos = Object.keys(h.lucros || {}).sort();
  if (anos.length >= 4) {
    const l = anos.map((k) => h.lucros[k]);
    const prej = l.filter((v) => v <= 0).length;
    const ini = l[0], fim = l[l.length - 1];
    const cagr = ini > 0 && fim > 0 ? (Math.pow(fim / ini, 1 / (l.length - 1)) - 1) * 100 : null;
    if (prej) out.push([-1, `Teve prejuízo em ${prej} dos últimos ${l.length} anos (${anos[0]}–${anos[anos.length - 1]}): lucro instável.`]);
    else if (cagr !== null && cagr >= 5) out.push([1, `Lucro em todos os últimos ${l.length} anos, crescendo ${f1(cagr)}% ao ano.`]);
    else if (cagr !== null && cagr <= -10) out.push([-1, `Lucro em todos os anos, mas caindo ${f1(-cagr)}% ao ano desde ${anos[0]}.`]);
    else out.push([0, `Lucro em todos os últimos ${l.length} anos${cagr !== null ? `, variando ${f1(cagr)}% ao ano` : ''}.`]);
  }
  return out;
}

function pontoValuation(a) {
  const v = valuation(a);
  if (!v || v.tipo !== 'acao') return null;
  const teto = tetoMaior(v);
  const margem = (teto / v.p - 1) * 100;
  if (margem >= 0) return [1, `Preço abaixo do preço-teto (${fmt(teto)}): margem de segurança de ${f1(margem)}%.`];
  if (margem >= -33) return [0, `Preço ${f1(-margem)}% acima do maior preço-teto (${fmt(teto)}). Sem margem de segurança, mas não exagerado.`];
  return [-1, `Preço ${f1(-margem)}% acima do maior preço-teto (${fmt(teto)}). Pelos métodos de Graham e Bazin, está cara.`];
}

// Consistência dos dividendos (histórico de 5 anos baixado pelo robô do Fundamentus)
function histDividendos(a) {
  const h = typeof MERCADO !== 'undefined' && MERCADO?.dividendos;
  return (h && h[a.nome.replace(/F$/, '')]) || null;
}

function pontoDividendos(a) {
  const h = histDividendos(a);
  if (!h) return null;
  const dy = fundAtivo(a).dy || 0;
  const vezes = h.pico ? `${f1(h.pico)}x` : '';
  if (h.pico > 1.8 && dy >= 3) return [-1, `Dividendos dos últimos 12 meses são ${vezes} a média dos últimos 5 anos: provavelmente extraordinários. Não conte com esse dividend yield (${f1(dy)}%) daqui para frente.`];
  if (h.anos >= 5) {
    if (h.pico >= 0.6 || !h.pico) return [1, `Pagou dividendos em todos os últimos 5 anos${h.pico && h.pico <= 1.5 ? ', em valores estáveis' : ''}: renda consistente.`];
    return [0, `Pagou dividendos em todos os últimos 5 anos, mas os 12 meses recentes estão ${f1((1 - h.pico) * 100)}% abaixo da média: os pagamentos caíram.`];
  }
  if (h.anos >= 3) return [0, `Pagou dividendos em ${h.anos} dos últimos 5 anos: renda irregular.`];
  if (dy < 3) return [0, `Pagou dividendos em só ${h.anos} dos últimos 5 anos: empresa que reinveste o lucro em vez de distribuir.`];
  return [-1, `Pagou dividendos em só ${h.anos} dos últimos 5 anos: o dividend yield atual (${f1(dy)}%) pode não se repetir.`];
}

const f1 = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const f2 = (v) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function avaliarFundamentos(a) {
  const tipo = tipoAtivo(a);
  const defs = INDICADORES[tipo];
  if (!defs) return { tipo, nivel: null, pontos: [], preenchidos: 0 };
  const f = fundAtivo(a);
  const pontos = [];
  for (const [k, , , fn] of defs) {
    if (Number.isFinite(f[k])) {
      const [nivel, texto] = fn(f[k], a);
      pontos.push({ nivel, texto });
    }
  }
  const pv = tipo === 'acao' ? pontoValuation(a) : null;
  if (pv) pontos.push({ nivel: pv[0], texto: pv[1] });
  const pd = tipo === 'acao' ? pontoDividendos(a) : null;
  if (pd) pontos.push({ nivel: pd[0], texto: pd[1] });
  if (tipo === 'acao') for (const [nivel, texto] of pontosHistorico(a)) pontos.push({ nivel, texto });
  if (pontos.length < 2) return { tipo, nivel: null, pontos, preenchidos: pontos.length };
  const media = pontos.reduce((s, p) => s + p.nivel, 0) / pontos.length;
  const nota = Math.round((media + 1) * 5 * 10) / 10; // 0 a 10
  const nivel = nota >= 6.5 ? 'bom' : nota >= 4 ? 'neutro' : 'fraco';
  return { tipo, nota, nivel, pontos, preenchidos: pontos.length };
}

const ROTULO_NIVEL = { bom: 'Fundamentos sólidos', neutro: 'Fundamentos medianos', fraco: 'Fundamentos fracos' };
const TAG_NIVEL = { bom: 'comprar', neutro: 'manter', fraco: 'vender' };

// ---------- Busca na brapi.dev ----------

// Aceita número puro ou objeto { raw }
const bruto = (v) => (v && typeof v === 'object' ? v.raw : v);
const numero = (v) => (Number.isFinite(bruto(v)) ? bruto(v) : undefined);
// Campos no estilo Yahoo vêm como fração (0,15 = 15%)
const fracaoParaPct = (v) => (numero(v) === undefined ? undefined : numero(v) * 100);
// Campos que podem vir em fração ou já em %
const talvezPct = (v) => (numero(v) === undefined ? undefined : Math.abs(numero(v)) < 1 ? numero(v) * 100 : numero(v));

async function brapiGet(ticker, params, token) {
  const q = new URLSearchParams(params);
  if (token) q.set('token', token);
  const r = await fetch(`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?${q}`);
  if (!r.ok) {
    const e = new Error(`HTTP ${r.status}`);
    e.status = r.status;
    throw e;
  }
  const d = await r.json();
  const res = d.results && d.results[0];
  if (!res) throw new Error('sem dados');
  return res;
}

// Dividend yield de 12 meses a partir do histórico de proventos
function dyDosProventos(res, preco) {
  const lista = res.dividendsData?.cashDividends;
  if (!Array.isArray(lista) || !preco) return undefined;
  const limite = Date.now() - 365 * 24 * 3600 * 1000;
  const soma = lista
    .filter((p) => Date.parse(p.paymentDate || p.lastDatePrior) >= limite)
    .reduce((s, p) => s + (Number(p.rate) || 0), 0);
  return soma > 0 ? (soma / preco) * 100 : undefined;
}

async function buscarFundamentos(a, token) {
  const ticker = a.nome.replace(/F$/, '');
  const tipo = tipoAtivo(a);
  let res;
  // Tenta com módulos de fundamentos; se o plano não permitir, cai para versões mais simples
  const tentativas = tipo === 'acao'
    ? [{ modules: 'summaryProfile,defaultKeyStatistics,financialData', dividends: 'true' }, { dividends: 'true' }, {}]
    : [{ dividends: 'true' }, {}];
  let ultimoErro;
  for (const params of tentativas) {
    try { res = await brapiGet(ticker, params, token); break; } catch (e) { ultimoErro = e; }
  }
  if (!res) throw ultimoErro;

  const ks = res.defaultKeyStatistics || {};
  const fd = res.financialData || {};
  const sp = res.summaryProfile || {};
  const preco = numero(res.regularMarketPrice);

  const novo = {};
  const set = (k, v) => { if (Number.isFinite(v)) novo[k] = Math.round(v * 100) / 100; };

  if (tipo === 'acao') {
    set('pl', numero(res.priceEarnings) ?? numero(ks.trailingPE) ?? numero(fd.trailingPE));
    set('pvp', numero(ks.priceToBook));
    set('dy', talvezPct(ks.dividendYield) ?? dyDosProventos(res, preco));
    set('roe', fracaoParaPct(fd.returnOnEquity));
    set('margem', fracaoParaPct(fd.profitMargins));
    // debtToEquity no padrão Yahoo vem em % (85 = 0,85x)
    if (numero(fd.debtToEquity) !== undefined) set('divPl', numero(fd.debtToEquity) / 100);
    set('cresc', fracaoParaPct(fd.revenueGrowth) ?? fracaoParaPct(fd.earningsGrowth));
    const setor = sp.sector || sp.sectorDisp;
    if (setor) novo.setor = setor;
    if (/financ|bank|banco/i.test(`${setor || ''} ${sp.industry || ''}`)) novo.banco = true;
  } else if (tipo === 'fii') {
    set('dy', dyDosProventos(res, preco));
    // Alguns retornos trazem P/VP também para FIIs
    set('pvp', numero(res.priceToBook) ?? numero(ks.priceToBook));
  }
  if (preco) Object.assign(a, { pa: preco, varDia: numero(res.regularMarketChangePercent), cotadoEm: Date.now() });

  const encontrados = Object.keys(novo).filter((k) => k !== 'setor' && k !== 'banco');
  // Dados digitados manualmente têm prioridade sobre os automáticos
  const manuais = a.fund?.manuais || [];
  a.fund = Object.assign({}, a.fund);
  for (const [k, v] of Object.entries(novo)) if (!manuais.includes(k)) a.fund[k] = v;
  a.fund.atualizadoEm = Date.now();
  return encontrados;
}

// ---------- Tela de análise ----------

function renderAnalise() {
  const alvo = $('#analise-conteudo');
  const ativos = estado.ativos.filter((a) => ['acao', 'fii', 'etf'].includes(tipoAtivo(a)));
  if (!ativos.length) {
    alvo.innerHTML = '<div class="card"><p>Cadastre ações ou FIIs na aba <a href="#" data-ir="carteira">Carteira</a> para analisar os fundamentos.</p></div>';
    return;
  }
  const ordem = { fraco: 0, neutro: 1, bom: 2 };
  const lista = ativos
    .map((a) => ({ a, av: avaliarFundamentos(a) }))
    .sort((x, y) => (ordem[x.av.nivel] ?? 3) - (ordem[y.av.nivel] ?? 3) || x.a.nome.localeCompare(y.a.nome));

  const contagem = { bom: 0, neutro: 0, fraco: 0 };
  lista.forEach(({ av }) => { if (av.nivel) contagem[av.nivel]++; });

  alvo.innerHTML = `
    <div class="card">
      <h2>Análise dos ativos</h2>
      <p class="dica" style="margin-top:0">Os indicadores são preenchidos automaticamente (Fundamentus), sem cadastro. Você pode corrigir ou completar qualquer valor; o que você digitar fica marcado com ✎ e não é sobrescrito.</p>
      ${estado.tokenBrapi ? '<button class="btn sec" id="buscar-fundamentos">Atualizar também pela brapi</button>' : ''}
      <p id="status-fundamentos" class="dica"></p>
      <div class="resumo" style="margin:12px 0 0">
        <div class="kpi"><div class="rotulo">Fundamentos sólidos</div><div class="valor pos">${contagem.bom}</div></div>
        <div class="kpi"><div class="rotulo">Medianos</div><div class="valor">${contagem.neutro}</div></div>
        <div class="kpi"><div class="rotulo">Fracos</div><div class="valor neg">${contagem.fraco}</div></div>
      </div>
    </div>
    ${typeof cardIdeias === 'function' ? cardIdeias() : ''}
    ${lista.map(({ a, av }) => renderCartaoAtivo(a, av)).join('')}
    <p class="dica">Os critérios são referências gerais. Setores diferentes têm padrões diferentes: bancos têm P/VP e dívida próprios, empresas de crescimento têm P/L mais alto. Use a análise como ponto de partida, não como veredito.</p>`;
}

function renderValuation(a) {
  const v = valuation(a);
  if (!v) return '';
  const linha = (rot, val, dica) => {
    if (!val) return '';
    const m = (val / v.p - 1) * 100;
    return `<tr><td>${rot}<br><span class="motivo">${dica}</span></td><td class="num">${fmt(val)}</td>
      <td class="num ${m >= 0 ? 'pos' : 'neg'}">${m >= 0 ? '+' : ''}${f1(m)}%</td></tr>`;
  };
  if (v.tipo === 'fii') {
    return `<div class="tabela-wrap"><table>
      <thead><tr><th>Valor de referência</th><th class="num">Valor</th><th class="num">Em relação ao preço</th></tr></thead>
      <tbody>${linha('Valor patrimonial por cota', v.vp, 'Quanto valem os imóveis/títulos do fundo por cota')}</tbody>
    </table></div>`;
  }
  return `<div class="tabela-wrap"><table>
    <thead><tr><th>Preço-teto (preço atual ${fmt(v.p)})</th><th class="num">Valor</th><th class="num">Margem</th></tr></thead>
    <tbody>
      ${linha('Graham', v.graham, '√(22,5 × LPA × VPA): valor justo para empresas de lucro estável')}
      ${linha(`Bazin (${TAXA_BAZIN}%)`, v.bazin, `Dividendos por ação ÷ ${TAXA_BAZIN}%: para quem busca renda`)}
      ${linha('Média histórica', v.hist, `Lucro por ação × P/L médio da própria empresa (${v.plMed ? f1(v.plMed) : '—'}): o preço "normal" dela`)}
    </tbody>
  </table></div>
  <p class="dica">Margem positiva = preço abaixo do teto. Graham subestima empresas de crescimento (ex.: WEGE3), por isso há também a média histórica (só para empresas com lucro em todos os anos); Bazin só faz sentido para boas pagadoras de dividendos. Com a Selic em ${f2(cenario().selic)}%, um dividend yield de ${TAXA_BAZIN}% é modesto, então use o Bazin com cautela.</p>`;
}

function renderCartaoAtivo(a, av) {
  const peso = totais().total ? (valorAtivo(a) / totais().total) * 100 : 0;
  const f = fundAtivo(a);
  const info = ETF_INFO[a.nome.replace(/F$/, '')];
  const manuais = f.manuais || [];
  const defs = INDICADORES[av.tipo];
  return `<div class="card">
    <h3 style="margin-top:0">${esc(a.nome)}
      <span class="tag manter">${av.tipo === 'fii' ? `FII de ${tipoFII(a)}` : { etf: 'ETF', acao: 'Ação' }[av.tipo]}</span>
      ${typeof tagsEstilo === 'function' ? tagsEstilo(a) : ''}
      ${av.nivel ? `<span class="tag ${TAG_NIVEL[av.nivel]}">${ROTULO_NIVEL[av.nivel]} · ${f1(av.nota)}/10</span>` : '<span class="tag avaliar">Preencha ao menos 2 indicadores</span>'}
    </h3>
    <p class="dica" style="margin-top:0">${info?.nome ? `${esc(info.nome)} · ` : ''}${pct(peso)} da carteira${f.setor ? ` · Setor: ${esc(f.setor)}` : ''}${f.atualizadoEm ? ` · Dados de ${new Date(f.atualizadoEm).toLocaleDateString('pt-BR')}` : ''}</p>
    <form class="grade-form form-fund" data-id="${esc(a.id)}">
      ${defs.map(([k, rot, un]) => `<label>${rot}${un ? ` (${un})` : ''}${manuais.includes(k) ? ' ✎' : ''}
        <input type="number" step="any" data-k="${k}" value="${Number.isFinite(f[k]) ? f[k] : ''}" placeholder="—">
      </label>`).join('')}
      ${av.tipo === 'acao' ? `<label class="check"><input type="checkbox" data-k="banco" ${f.banco ? 'checked' : ''}> É banco ou seguradora</label>` : ''}
    </form>
    ${renderValuation(a)}
    ${av.pontos.length ? `<ul class="limpa pontos">${av.pontos.map((p) => `<li class="${p.nivel > 0 ? 'pos' : p.nivel < 0 ? 'neg' : ''}">${p.nivel > 0 ? '▲' : p.nivel < 0 ? '▼' : '●'} <span>${esc(p.texto)}</span></li>`).join('')}</ul>` : ''}
    ${av.tipo === 'etf' && info?.eua ? `<div class="alerta">ETF domiciliado nos EUA: 30% de imposto retido na fonte sobre os dividendos; no Brasil, 15% de IR sobre o ganho na declaração anual (Lei 14.754/2023). Acima de US$ 60 mil investidos nos EUA, há risco de imposto sobre herança americano: para patrimônio grande, avalie ETFs equivalentes domiciliados na Irlanda (ex.: VWRA).</div>` : ''}
    ${av.tipo === 'etf' ? '<p class="dica">Dados de referência dos gestores (aproximados). Confira no site do fundo e corrija se necessário.</p>' : ''}
    ${av.tipo === 'fii' ? '<p class="dica">P/VP, vacância e número de ativos estão no relatório gerencial do fundo ou em sites como Status Invest, Funds Explorer e Investidor10.</p>' : ''}
  </div>`;
}

document.addEventListener('change', (e) => {
  const form = e.target.closest('.form-fund');
  if (!form) return;
  const a = estado.ativos.find((x) => x.id === form.dataset.id);
  const k = e.target.dataset.k;
  if (!a || !k) return;
  a.fund = Object.assign({ manuais: [] }, a.fund);
  a.fund.manuais = a.fund.manuais || [];
  if (k === 'banco') {
    a.fund.banco = e.target.checked;
  } else {
    const v = parseFloat(e.target.value);
    if (Number.isFinite(v)) {
      a.fund[k] = v;
      if (!a.fund.manuais.includes(k)) a.fund.manuais.push(k);
    } else {
      delete a.fund[k];
      a.fund.manuais = a.fund.manuais.filter((x) => x !== k);
    }
  }
  salvar();
  renderAnalise();
});

document.addEventListener('click', async (e) => {
  if (e.target.id !== 'buscar-fundamentos') return;
  const btn = e.target;
  const st = $('#status-fundamentos');
  const token = estado.tokenBrapi || '';
  const alvos = estado.ativos.filter((a) => ['acao', 'fii'].includes(tipoAtivo(a)));
  if (!alvos.length) return;
  btn.disabled = true;
  const ok = [], falhas = [];
  let bloqueado = false;
  for (const a of alvos) {
    st.textContent = `Buscando ${a.nome}... (${ok.length + falhas.length + 1}/${alvos.length})`;
    try {
      const achados = await buscarFundamentos(a, token);
      (achados.length ? ok : falhas).push(a.nome);
    } catch (err) {
      if (err.status === 401 || err.status === 403) bloqueado = true;
      falhas.push(a.nome);
    }
  }
  salvar();
  renderAnalise();
  renderCarteira();
  let msg = `Fundamentos encontrados para ${ok.length} de ${alvos.length} ativos.`;
  if (falhas.length) msg += ` Sem dados: ${falhas.join(', ')} (preencha manualmente).`;
  if (bloqueado) msg += token ? ' O token não tem acesso a alguns dados.' : ' Informe um token da brapi na aba Carteira.';
  $('#status-fundamentos').textContent = msg;
});
