'use strict';

// ---------- Configuração ----------

const CLASSES = [
  { id: 'rf_pos', nome: 'Renda Fixa – Pós (Selic/CDI)', curto: 'RF Pós', cor: '#2f7ed8', rendaFixa: true },
  { id: 'rf_ipca', nome: 'Renda Fixa – Inflação (IPCA+)', curto: 'RF IPCA+', cor: '#7cb5ec', rendaFixa: true },
  { id: 'rf_pre', nome: 'Renda Fixa – Prefixada', curto: 'RF Pré', cor: '#5b6fbf', rendaFixa: true },
  { id: 'acoes', nome: 'Ações Brasil', curto: 'Ações', cor: '#e8743b', rendaFixa: false },
  { id: 'fiis', nome: 'Fundos Imobiliários', curto: 'FIIs', cor: '#19a979', rendaFixa: false },
  { id: 'inter', nome: 'Internacional', curto: 'Internacional', cor: '#945ecf', rendaFixa: false },
  { id: 'cripto', nome: 'Cripto', curto: 'Cripto', cor: '#f4b400', rendaFixa: false },
];

// Ideias genéricas por classe (produtos amplos e diversificados, não indicação de empresas)
const CATALOGO = {
  rf_pos: [
    ['Tesouro Selic', 'Base da reserva de emergência: liquidez diária e quase nenhuma oscilação. Com a Selic alta, rende bem.'],
    ['CDB de liquidez diária (≥ 100% do CDI)', 'Alternativa ao Tesouro Selic, coberta pelo FGC até R$ 250 mil por instituição.'],
    ['LCI/LCA pós-fixada', 'Isenta de IR para pessoa física. Compare com o CDB descontando o imposto.'],
  ],
  rf_ipca: [
    ['Tesouro IPCA+ (vencimento 2029–2035)', 'Protege da inflação e permite travar juro real alto. Leve até o vencimento para evitar marcação a mercado.'],
    ['Tesouro IPCA+ com Juros Semestrais', 'Mesma proteção, pagando cupons semestrais. Bom para quem busca renda.'],
    ['Debêntures incentivadas atreladas ao IPCA', 'Isentas de IR, mas com risco de crédito da empresa. Prefira emissores sólidos e diversifique.'],
  ],
  rf_pre: [
    ['Tesouro Prefixado (2029–2031)', 'Ganha valor se a Selic cair mais que o esperado. Perde se a inflação surpreender para cima.'],
    ['CDB prefixado de prazo médio', 'Taxa fixa conhecida. Respeite o limite do FGC.'],
  ],
  acoes: [
    ['ETF do Ibovespa (BOVA11)', 'Diversificação imediata nas maiores empresas brasileiras, com baixo custo.'],
    ['ETF de dividendos (DIVO11)', 'Empresas maduras, pagadoras de dividendos. Costuma oscilar menos que o índice.'],
    ['ETF de small caps (SMAL11)', 'Empresas menores, mais sensíveis à queda de juros. Mais volátil.'],
  ],
  fiis: [
    ['ETF de FIIs (XFIX11)', 'Exposição a vários fundos de uma vez, com renda mensal.'],
    ['FIIs de papel (CRI) diversificados', 'Rendem com CDI/IPCA altos. Atenção ao risco de crédito dos CRIs.'],
    ['FIIs de tijolo (logística/lajes)', 'Tendem a se valorizar com cortes de juros. Prefira imóveis de qualidade e boa vacância.'],
  ],
  inter: [
    ['ETF do S&P 500 (IVVB11)', 'Exposição às maiores empresas dos EUA, em dólar, negociada na B3.'],
    ['ETF global (WRLD11 / ACWI11)', 'Diversificação mundial em um único ativo.'],
    ['BDRs de ETFs globais', 'Alternativa para montar a exposição internacional sem abrir conta no exterior.'],
  ],
  cripto: [
    ['ETF de cripto (HASH11)', 'Cesta de criptoativos via B3. Mantenha uma fatia pequena.'],
    ['ETF de bitcoin (BITH11 / QBTC11)', 'Exposição só ao bitcoin. Volatilidade muito alta.'],
  ],
};

const PERFIS = {
  conservador: {
    nome: 'Conservador',
    desc: 'Prioriza segurança e liquidez. Aceita retornos menores para evitar oscilações.',
    alvo: { rf_pos: 45, rf_ipca: 25, rf_pre: 10, acoes: 8, fiis: 7, inter: 5, cripto: 0 },
  },
  moderado: {
    nome: 'Moderado',
    desc: 'Busca equilíbrio entre segurança e crescimento. Tolera oscilações moderadas.',
    alvo: { rf_pos: 22, rf_ipca: 20, rf_pre: 8, acoes: 20, fiis: 12, inter: 15, cripto: 3 },
  },
  arrojado: {
    nome: 'Arrojado',
    desc: 'Foco em crescimento de longo prazo. Aceita quedas fortes no curto prazo.',
    alvo: { rf_pos: 10, rf_ipca: 12, rf_pre: 5, acoes: 33, fiis: 12, inter: 23, cripto: 5 },
  },
};

const PERGUNTAS = [
  { id: 'idade', texto: 'Qual a sua idade?', opcoes: [
    ['Mais de 60 anos', 0], ['45 a 60 anos', 1], ['30 a 45 anos', 2], ['Menos de 30 anos', 3]] },
  { id: 'horizonte', texto: 'Por quanto tempo pretende deixar o dinheiro investido?', opcoes: [
    ['Menos de 2 anos', 0], ['De 2 a 5 anos', 1], ['De 5 a 10 anos', 2], ['Mais de 10 anos', 3]] },
  { id: 'queda', texto: 'Se sua carteira caísse 20% em um mês, o que você faria?', opcoes: [
    ['Venderia tudo', 0], ['Venderia uma parte', 1], ['Manteria e esperaria', 2], ['Aproveitaria para comprar mais', 3]] },
  { id: 'objetivo', texto: 'Qual seu principal objetivo?', opcoes: [
    ['Preservar o patrimônio', 0], ['Gerar renda complementar', 1], ['Crescimento moderado', 2], ['Máximo crescimento no longo prazo', 3]] },
  { id: 'experiencia', texto: 'Qual sua experiência com investimentos?', opcoes: [
    ['Nenhuma', 0], ['Poupança e renda fixa', 1], ['Já investi em ações ou FIIs', 2], ['Invisto em renda variável há anos', 3]] },
  { id: 'renda', texto: 'Qual sua situação de trabalho?', opcoes: [
    ['Sem renda fixa no momento', 0], ['Autônomo ou empresário (renda variável)', 1], ['CLT (carteira assinada)', 2], ['Funcionário público (estabilidade)', 3]] },
  { id: 'moradia', texto: 'Como são sua moradia e suas despesas fixas?', opcoes: [
    ['Sustento a família / tenho dependentes', 0], ['Pago aluguel ou financiamento', 1], ['Casa própria quitada', 2], ['Moro com os pais (despesas baixas)', 3]] },
  { id: 'reserva', texto: 'Você tem reserva de emergência?', opcoes: [
    ['Não tenho', 0], ['Tenho parte dela', 1], ['Sim, completa', 3]] },
];

// Meses de gastos recomendados para a reserva, conforme a estabilidade da renda e as despesas
function mesesReserva(r = estado.respostas) {
  const base = { 0: 12, 1: 12, 2: 6, 3: 3 }[r.renda] ?? 6;
  // Morando com os pais e com carteira assinada, as despesas obrigatórias são baixas
  return r.moradia === 3 && base === 6 ? 4 : r.moradia === 0 && base < 12 ? base + 3 : base;
}

const CAMPOS_CENARIO = [
  ['dataReferencia', 'Data de referência', 'date'],
  ['selic', 'Selic atual (% a.a.)', 'number'],
  ['tendenciaSelic', 'Tendência da Selic', ['corte', 'estavel', 'alta']],
  ['selicFocusFimAno', 'Selic esperada fim do ano (%)', 'number'],
  ['ipca12m', 'IPCA 12 meses (%)', 'number'],
  ['ipcaFocusAno', 'IPCA esperado no ano (%)', 'number'],
  ['tetoMetaIpca', 'Teto da meta de inflação (%)', 'number'],
  ['taxaIpcaLongo', 'Juro real do Tesouro IPCA+ (%)', 'number'],
  ['pibFocusAno', 'PIB esperado no ano (%)', 'number'],
  ['dolar', 'Dólar atual (R$)', 'number'],
  ['dolarFocusFimAno', 'Dólar esperado fim do ano (R$)', 'number'],
  ['riscoEleitoral', 'Período eleitoral / risco político', 'bool'],
  ['fedFunds', 'Juros nos EUA – Fed Funds (%)', 'number'],
  ['tendenciaFed', 'Tendência do Fed', ['corte', 'estavel', 'alta']],
  ['inflacaoEUA', 'Inflação nos EUA (%)', 'number'],
  ['riscoGeopolitico', 'Tensão geopolítica relevante', 'bool'],
];

const ROTULO_TENDENCIA = { corte: 'em queda', estavel: 'estável', alta: 'em alta' };
const CHAVE = 'minha-carteira-v1';
const LIMITE_CONCENTRACAO = 15; // % máximo de um único ativo de renda variável

// ---------- Estado ----------

let estado = carregar();

function estadoInicial() {
  return { ativos: [], respostas: {}, perfil: null, alvo: null, cenario: null, historico: [], proventos: [] };
}

function carregar() {
  let e = estadoInicial();
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) e = Object.assign(e, JSON.parse(bruto));
  } catch (err) { /* armazenamento indisponível */ }
  if (e.alvo) for (const c of CLASSES) if (e.alvo[c.id] === undefined) e.alvo[c.id] = 0;
  return e;
}

function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (err) { /* ignora */ }
}

function cenario() {
  // Ordem: dados de referência < dados automáticos (Banco Central/Tesouro) < ajustes feitos pelo usuário
  const auto = typeof MERCADO !== 'undefined' && MERCADO?.macro ? MERCADO.macro : {};
  return Object.assign({}, CENARIO_PADRAO, auto, estado.cenario || {});
}

// ---------- Utilidades ----------

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmt = (v) => brl.format(v || 0);
const pct = (v, casas = 1) => `${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
const num = (v) => (v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 8 });
const $ = (s) => document.querySelector(s);
const classe = (id) => CLASSES.find((c) => c.id === id);
const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const preco = (a) => a.pa || a.pm;
const valorAtivo = (a) => a.qtd * preco(a);
const custoAtivo = (a) => a.qtd * a.pm;

// Três carteiras independentes: longo prazo (a única que entra na alocação, no risco e no plano),
// objetivos de curto/médio prazo (carro, casamento...) e reserva de emergência
const CAIXAS = { longo: 'Longo prazo', objetivos: 'Objetivos', reserva: 'Reserva de emergência' };
const caixaDe = (a) => (CAIXAS[a.caixa] ? a.caixa : a.reserva ? 'reserva' : 'longo');
const investidos = () => estado.ativos.filter((a) => caixaDe(a) === 'longo');
const reservas = () => estado.ativos.filter((a) => caixaDe(a) === 'reserva');
const ativosObjetivos = () => estado.ativos.filter((a) => caixaDe(a) === 'objetivos');

// Peso do ativo dentro da classe (0 a 100; sem peso = 100, ou seja, pesos iguais)
const pesoAtivo = (a) => (Number.isFinite(a.peso) ? a.peso : 100);
// % ideal do ativo na carteira de longo prazo = meta da classe x peso / soma dos pesos da classe
function idealAtivo(a, meta = alvoAjustado()?.final) {
  if (!meta || caixaDe(a) !== 'longo') return null;
  const soma = investidos().filter((x) => x.classe === a.classe).reduce((s, x) => s + pesoAtivo(x), 0);
  return soma ? (meta[a.classe] * pesoAtivo(a)) / soma : 0;
}

function totais(ativos = investidos()) {
  const porClasse = Object.fromEntries(CLASSES.map((c) => [c.id, 0]));
  let total = 0, custo = 0;
  for (const a of ativos) {
    const v = valorAtivo(a);
    porClasse[a.classe] = (porClasse[a.classe] || 0) + v;
    total += v;
    custo += custoAtivo(a);
  }
  return { porClasse, total, custo };
}

function somaAlvo(alvo = estado.alvo) {
  return alvo ? Object.values(alvo).reduce((s, v) => s + v, 0) : 0;
}

// ---------- Motor de cenário ----------

// Cada sinal ativo gera inclinações (em pontos percentuais) sobre a alocação-base do perfil.
function sinaisCenario(cx = cenario()) {
  const sinais = [];
  const jurosReal = ((1 + cx.selic / 100) / (1 + cx.ipcaFocusAno / 100) - 1) * 100;

  if (jurosReal >= 6) {
    sinais.push({
      preco: true,
      titulo: `Juro real muito alto (~${pct(jurosReal)} ao ano)`,
      texto: 'A renda fixa paga muito acima da inflação, então o prêmio para correr risco na bolsa fica menor. Faz sentido reforçar a renda fixa e ser seletivo em ações.',
      efeitos: { rf_pos: 3, rf_ipca: 2, acoes: -3, fiis: -2 },
    });
  } else if (jurosReal <= 3) {
    sinais.push({
      preco: true,
      titulo: `Juro real baixo (~${pct(jurosReal)} ao ano)`,
      texto: 'Com renda fixa pagando pouco acima da inflação, ativos reais como ações e FIIs ficam relativamente mais atrativos.',
      efeitos: { rf_pos: -4, acoes: 2, fiis: 2 },
    });
  }

  if (cx.taxaIpcaLongo >= 6) {
    sinais.push({
      preco: true,
      titulo: `Tesouro IPCA+ pagando ~${pct(cx.taxaIpcaLongo)} acima da inflação`,
      texto: 'Taxas reais raramente ficam neste nível. É uma oportunidade de travar juro real alto por vários anos, levando o título até o vencimento.',
      efeitos: { rf_ipca: 3, rf_pos: -3 },
    });
  }

  if (cx.tendenciaSelic === 'corte') {
    sinais.push({
      titulo: 'Ciclo de cortes da Selic',
      texto: 'Com juros caindo, o pós-fixado passa a render menos ao longo do tempo. Prefixados, FIIs e ações tendem a se beneficiar.',
      efeitos: { rf_pos: -5, rf_pre: 2, fiis: 2, acoes: 1 },
    });
  } else if (cx.tendenciaSelic === 'alta') {
    sinais.push({
      titulo: 'Selic em alta',
      texto: 'Juros subindo favorecem o pós-fixado e pressionam prefixados, FIIs e ações.',
      efeitos: { rf_pos: 5, rf_pre: -2, fiis: -2, acoes: -1 },
    });
  }

  if (cx.ipca12m > cx.tetoMetaIpca || cx.ipcaFocusAno > cx.tetoMetaIpca) {
    sinais.push({
      titulo: 'Inflação acima do teto da meta',
      texto: `IPCA em ${pct(cx.ipca12m, 2)} (12m) e expectativa de ${pct(cx.ipcaFocusAno, 2)} no ano, contra teto de ${pct(cx.tetoMetaIpca)}. Proteção contra inflação (IPCA+) ganha prioridade sobre prefixados.`,
      efeitos: { rf_ipca: 2, rf_pre: -2 },
    });
  }

  if (cx.dolar < cx.dolarFocusFimAno * 0.97) {
    sinais.push({
      preco: true,
      titulo: `Dólar abaixo do esperado (${fmt(cx.dolar)} hoje contra ${fmt(cx.dolarFocusFimAno)} previsto)`,
      texto: 'Momento favorável para aumentar a exposição internacional e dolarizar parte do patrimônio, como proteção contra riscos locais.',
      efeitos: { inter: 3, rf_pos: -3 },
    });
  } else if (cx.dolar > cx.dolarFocusFimAno * 1.05) {
    sinais.push({
      preco: true,
      titulo: `Dólar acima do esperado (${fmt(cx.dolar)})`,
      texto: 'Com o dólar caro, evite acelerar compras internacionais. Prefira aportes graduais.',
      efeitos: { inter: -2, rf_pos: 2 },
    });
  }

  if (cx.pibFocusAno < 1.5) {
    sinais.push({
      titulo: `Crescimento fraco (PIB esperado de ${pct(cx.pibFocusAno)})`,
      texto: 'Economia desacelerando tende a pesar sobre os lucros das empresas e a vacância de imóveis.',
      efeitos: { acoes: -2, fiis: -1, rf_pos: 3 },
    });
  }

  if (cx.tendenciaFed === 'alta' || (cx.fedFunds >= 3.5 && cx.inflacaoEUA >= 3)) {
    sinais.push({
      titulo: `Aperto monetário nos EUA (Fed Funds ${pct(cx.fedFunds, 2)}, ${ROTULO_TENDENCIA[cx.tendenciaFed]})`,
      texto: 'Juros americanos mais altos drenam liquidez de ativos de risco, especialmente cripto e mercados emergentes.',
      efeitos: { cripto: -2, acoes: -1, rf_pos: 3 },
    });
  } else if (cx.tendenciaFed === 'corte') {
    sinais.push({
      titulo: 'Fed cortando juros',
      texto: 'Liquidez global maior costuma favorecer bolsas, emergentes e cripto.',
      efeitos: { acoes: 1, cripto: 1, rf_pos: -2 },
    });
  }

  if (cx.riscoEleitoral) {
    sinais.push({
      titulo: 'Período eleitoral / risco político',
      texto: 'Eleições costumam trazer volatilidade forte em bolsa, juros e câmbio. Evite perseguir ralis. Mantenha liquidez e faça compras em etapas.',
      efeitos: { acoes: -2, rf_pos: 2 },
    });
  }

  if (cx.riscoGeopolitico) {
    sinais.push({
      titulo: 'Tensão geopolítica',
      texto: 'Conflitos pressionam petróleo e inflação global. Proteção inflacionária e menor exposição a ativos muito voláteis ajudam.',
      efeitos: { cripto: -1, rf_ipca: 1 },
    });
  }

  return { sinais, jurosReal };
}

// Quanto o cenário mexe nas metas: desligado (metas fixas), leve (só sinais de preço, até ±3) ou normal (todos, até ±8)
const MODOS_CENARIO = {
  desligado: { nome: 'Desligado', desc: 'Usa só a sua alocação-base. Você rebalanceia pelos aportes, sem tentar prever o mercado.', limite: 0 },
  leve: { nome: 'Leve', desc: 'Só os sinais de preço (juro real, taxa do Tesouro IPCA+ e dólar), com no máximo 3 pontos de ajuste por classe.', limite: 3 },
  normal: { nome: 'Normal', desc: 'Todos os sinais do cenário (juros, inflação, dólar, eleição, EUA, geopolítica), com até 8 pontos de ajuste por classe.', limite: 8 },
};
const modoCenario = () => (MODOS_CENARIO[estado.modoCenario] ? estado.modoCenario : 'desligado');
const rotuloMeta = (curto) => (modoCenario() === 'desligado' ? 'Meta' : curto ? 'Meta no cenário' : 'Meta ajustada ao cenário');

// Aplica as inclinações à alocação-base, conforme o modo escolhido no Perfil
function alvoAjustado() {
  if (!estado.alvo) return null;
  const modo = modoCenario();
  const limite = MODOS_CENARIO[modo].limite;
  const sinais = modo === 'desligado' ? [] : sinaisCenario().sinais.filter((x) => modo === 'normal' || x.preco);
  const base = {};
  const s = somaAlvo() || 100;
  for (const c of CLASSES) base[c.id] = ((estado.alvo[c.id] || 0) / s) * 100;

  const incl = Object.fromEntries(CLASSES.map((c) => [c.id, 0]));
  for (const sinal of sinais) for (const [k, v] of Object.entries(sinal.efeitos)) incl[k] += v;

  const bruto = {};
  for (const c of CLASSES) {
    const i = Math.max(-limite, Math.min(limite, incl[c.id]));
    // Classe zerada pelo perfil continua zerada; o cenário reduz, mas não elimina, uma classe do perfil
    bruto[c.id] = base[c.id] === 0 ? 0 : Math.max(base[c.id] * 0.4, base[c.id] + i);
  }
  const soma = Object.values(bruto).reduce((a, b) => a + b, 0) || 1;
  const final = {};
  for (const c of CLASSES) final[c.id] = Math.round((bruto[c.id] / soma) * 1000) / 10;
  return { base, final, incl };
}

// ---------- Abas ----------

function abrirAba(id) {
  document.querySelectorAll('.aba').forEach((x) => x.classList.toggle('ativa', x.dataset.aba === id));
  document.querySelectorAll('.painel').forEach((p) => p.classList.toggle('ativo', p.id === id));
  if (id === 'diagnostico') renderDiagnostico();
  if (id === 'cenario') renderCenario();
  if (id === 'analise') renderAnalise();
  if (id === 'rotina' && typeof renderRotina === 'function') renderRotina();
  if (id === 'cronograma' && typeof renderCronograma === 'function') renderCronograma();
  if (id === 'estrategia' && typeof renderEstrategia === 'function') renderEstrategia();
  if (id === 'evolucao' && typeof renderEvolucao === 'function') renderEvolucao();
  window.scrollTo(0, 0);
}

document.querySelectorAll('.aba').forEach((b) => b.addEventListener('click', () => abrirAba(b.dataset.aba)));
document.addEventListener('click', (e) => {
  const l = e.target.closest('[data-ir]');
  if (l) { e.preventDefault(); abrirAba(l.dataset.ir); }
});

// ---------- Carteira ----------

$('#ativo-classe').innerHTML = CLASSES.map((c) => `<option value="${c.id}">${c.nome}</option>`).join('');

$('#form-ativo').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = $('#ativo-id').value;
  const pm = parseFloat($('#ativo-pm').value);
  const paBruto = $('#ativo-pa').value;
  const ativo = {
    id: id || String(Date.now()),
    nome: $('#ativo-nome').value.trim().toUpperCase(),
    classe: $('#ativo-classe').value,
    qtd: parseFloat($('#ativo-qtd').value),
    pm,
    pa: paBruto === '' ? pm : parseFloat(paBruto),
    caixa: $('#ativo-caixa').value,
    peso: $('#ativo-peso').value === '' ? undefined : Math.max(0, Math.min(100, parseFloat($('#ativo-peso').value))),
    travado: $('#ativo-travado').checked || undefined,
  };
  // Mantém os fundamentos já preenchidos ao editar
  estado.ativos = id ? estado.ativos.map((a) => (a.id === id ? { ...ativo, fund: a.fund } : a)) : [...estado.ativos, ativo];
  salvar();
  limparForm();
  renderCarteira();
});

$('#cancelar-edicao').addEventListener('click', limparForm);

function limparForm() {
  $('#form-ativo').reset();
  $('#ativo-id').value = '';
  $('#form-titulo').textContent = 'Adicionar ativo';
  $('#cancelar-edicao').hidden = true;
}

function editar(id) {
  const a = estado.ativos.find((x) => x.id === id);
  if (!a) return;
  $('#ativo-id').value = a.id;
  $('#ativo-nome').value = a.nome;
  $('#ativo-classe').value = a.classe;
  $('#ativo-qtd').value = a.qtd;
  $('#ativo-pm').value = a.pm;
  $('#ativo-pa').value = a.pa;
  $('#ativo-caixa').value = caixaDe(a);
  $('#ativo-peso').value = Number.isFinite(a.peso) ? a.peso : '';
  $('#ativo-travado').checked = !!a.travado;
  $('#form-titulo').textContent = `Editar ${a.nome}`;
  $('#cancelar-edicao').hidden = false;
  $('#form-ativo').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function remover(id) {
  const a = estado.ativos.find((x) => x.id === id);
  if (!a || !confirm(`Remover ${a.nome}?`)) return;
  estado.ativos = estado.ativos.filter((x) => x.id !== id);
  salvar();
  renderCarteira();
}

$('#tabela-ativos tbody').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-acao]');
  if (!b) return;
  if (b.dataset.acao === 'editar') editar(b.dataset.id);
  if (b.dataset.acao === 'remover') remover(b.dataset.id);
});

function renderCarteira() {
  const { total, custo } = totais();
  const resultado = total - custo;
  const rent = custo > 0 ? (resultado / custo) * 100 : 0;
  const cls = resultado >= 0 ? 'pos' : 'neg';

  $('#resumo').innerHTML = `
    <div class="kpi"><div class="rotulo">Patrimônio investido</div><div class="valor">${fmt(total)}</div></div>
    <div class="kpi"><div class="rotulo">Total investido</div><div class="valor">${fmt(custo)}</div></div>
    <div class="kpi"><div class="rotulo">Resultado</div><div class="valor ${cls}">${fmt(resultado)}</div></div>
    <div class="kpi"><div class="rotulo">Rentabilidade</div><div class="valor ${cls}">${pct(rent, 2)}</div></div>
    ${ativosObjetivos().length ? `<div class="kpi"><div class="rotulo">Objetivos (fora da alocação)</div><div class="valor">${fmt(totais(ativosObjetivos()).total)}</div></div>` : ''}
    ${reservas().length ? `<div class="kpi"><div class="rotulo">Reserva de emergência (fora da alocação)</div><div class="valor">${fmt(totais(reservas()).total)}</div></div>` : ''}`;

  const ordemCaixa = { longo: 0, objetivos: 1, reserva: 2 };
  const meta = alvoAjustado()?.final;
  const ativos = [...estado.ativos].sort((a, b) => ordemCaixa[caixaDe(a)] - ordemCaixa[caixaDe(b)] || valorAtivo(b) - valorAtivo(a));
  $('#tabela-ativos tbody').innerHTML = ativos.map((a) => {
    const v = valorAtivo(a);
    const r = v - custoAtivo(a);
    const rp = custoAtivo(a) > 0 ? (r / custoAtivo(a)) * 100 : 0;
    return `<tr>
      <td><strong>${esc(a.nome)}</strong>${caixaDe(a) === 'reserva' ? ' <span class="tag avaliar">Reserva</span>' : caixaDe(a) === 'objetivos' ? ' <span class="tag comprar">Objetivos</span>' : ''}${a.travado ? ' <span class="tag manter">sem liquidez</span>' : ''}</td>
      <td>${classe(a.classe)?.curto || esc(a.classe)}</td>
      <td class="num">${num(a.qtd)}</td>
      <td class="num">${fmt(a.pm)}</td>
      <td class="num" title="${a.cotadoEm ? 'Cotação de ' + new Date(a.cotadoEm).toLocaleString('pt-BR') : 'Preço informado manualmente'}">${fmt(a.pa)}${a.cotadoEm ? ' <span class="auto">●</span>' : ''}</td>
      <td class="num ${a.varDia > 0 ? 'pos' : a.varDia < 0 ? 'neg' : ''}">${Number.isFinite(a.varDia) && a.cotadoEm ? `${a.varDia > 0 ? '+' : ''}${pct(a.varDia, 2)}` : '—'}</td>
      <td class="num">${fmt(v)}</td>
      <td class="num ${r >= 0 ? 'pos' : 'neg'}">${fmt(r)} (${pct(rp)})</td>
      <td class="num">${caixaDe(a) !== 'longo' ? '—' : pct(total ? (v / total) * 100 : 0)}</td>
      <td class="num">${caixaDe(a) !== 'longo' || !meta ? '—' : `${pct(idealAtivo(a, meta), 2)}<br><span class="motivo">peso ${pesoAtivo(a)}</span>`}</td>
      <td>
        <button class="btn sec mini" data-acao="editar" data-id="${esc(a.id)}">Editar</button>
        <button class="btn perigo mini" data-acao="remover" data-id="${esc(a.id)}">Remover</button>
      </td>
    </tr>`;
  }).join('');
  $('#vazio').hidden = ativos.length > 0;
  $('#tabela-ativos').hidden = ativos.length === 0;
  if (typeof renderStatusMercado === 'function') renderStatusMercado();
  if (typeof registrarHistorico === 'function') registrarHistorico();
}

$('#exportar').addEventListener('click', () => {
  // O token da API não vai para o backup
  const { tokenBrapi, ...dados } = estado;
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `carteira-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#importar').addEventListener('change', async (e) => {
  const arq = e.target.files[0];
  if (!arq) return;
  try {
    const dados = JSON.parse(await arq.text());
    if (!Array.isArray(dados.ativos)) throw new Error('formato');
    estado = Object.assign(estadoInicial(), dados);
    if (estado.alvo) for (const c of CLASSES) if (estado.alvo[c.id] === undefined) estado.alvo[c.id] = 0;
    // Aplica na hora as cotações e indicadores automáticos aos ativos importados
    if (typeof MERCADO !== 'undefined' && MERCADO) aplicarMercado();
    salvar();
    renderTudo();
    if (typeof renderStatusMercado === 'function') renderStatusMercado();
    alert('Backup importado com sucesso.');
  } catch (err) {
    alert('Arquivo inválido.');
  }
  e.target.value = '';
});

$('#limpar').addEventListener('click', () => {
  if (!confirm('Apagar todos os ativos, o perfil e os ajustes de cenário? Esta ação não pode ser desfeita.')) return;
  estado = estadoInicial();
  salvar();
  renderTudo();
});

// ---------- Cotações (brapi.dev) ----------

const TICKER_B3 = /^[A-Z][A-Z0-9]{3}\d{1,2}F?$/;

function tickerCotavel(a) {
  return !classe(a.classe)?.rendaFixa && TICKER_B3.test(a.nome);
}

async function cotar(ticker, token) {
  const url = `https://brapi.dev/api/quote/${encodeURIComponent(ticker.replace(/F$/, ''))}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  const r = await fetch(url);
  if (!r.ok) {
    const erro = new Error(`HTTP ${r.status}`);
    erro.status = r.status;
    throw erro;
  }
  const dados = await r.json();
  const q = dados.results && dados.results[0];
  if (!q || !Number.isFinite(q.regularMarketPrice)) throw new Error('sem preço');
  return { preco: q.regularMarketPrice, varDia: q.regularMarketChangePercent };
}

async function atualizarCotacoes() {
  const st = $('#status-cotacoes');
  const token = estado.tokenBrapi || '';
  const alvos = estado.ativos.filter(tickerCotavel);
  if (!alvos.length) {
    st.textContent = 'Nenhum ativo com ticker da B3 para atualizar.';
    return;
  }
  $('#btn-cotacoes').disabled = true;
  const ok = [], falhas = [];
  let semToken = false;
  // Plano gratuito: 1 ativo por requisição; faz 3 por vez
  const fila = [...alvos];
  async function trabalhador() {
    while (fila.length) {
      const a = fila.shift();
      st.textContent = `Atualizando cotações... (${ok.length + falhas.length + 1}/${alvos.length})`;
      try {
        const q = await cotar(a.nome, token);
        const atual = estado.ativos.find((x) => x.id === a.id);
        if (atual) Object.assign(atual, { pa: q.preco, varDia: q.varDia, cotadoEm: Date.now() });
        ok.push(a.nome);
      } catch (err) {
        if (err.status === 401 || err.status === 403) semToken = true;
        falhas.push(a.nome);
      }
    }
  }
  await Promise.all([trabalhador(), trabalhador(), trabalhador()]);
  salvar();
  renderCarteira();
  $('#btn-cotacoes').disabled = false;
  let msg = `${ok.length} de ${alvos.length} cotações atualizadas às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`;
  if (falhas.length) msg += ` Sem cotação: ${falhas.join(', ')}.`;
  if (semToken) msg += token ? ' Token inválido ou sem permissão para esses ativos.' : ' É necessário um token da brapi.dev para esses ativos.';
  else if (falhas.length && !ok.length) msg += ' Verifique sua conexão ou se os tickers estão corretos.';
  st.textContent = msg;
}

$('#form-cotacoes').addEventListener('submit', (e) => {
  e.preventDefault();
  atualizarCotacoes();
});

$('#token-brapi').addEventListener('change', (e) => {
  estado.tokenBrapi = e.target.value.trim();
  salvar();
});

$('#auto-cotacoes').addEventListener('change', (e) => {
  estado.autoCotacoes = e.target.checked;
  salvar();
});

// ---------- Perfil ----------

function renderPerguntas() {
  $('#form-perfil').innerHTML = PERGUNTAS.map((p) => `
    <fieldset class="pergunta">
      <legend>${p.texto}</legend>
      ${p.opcoes.map(([txt], i) => `
        <label><input type="radio" name="${p.id}" value="${i}" ${estado.respostas[p.id] === i ? 'checked' : ''}> ${txt}</label>
      `).join('')}
    </fieldset>`).join('') + '<button class="btn" type="submit">Descobrir meu perfil</button>';
}

$('#form-perfil').addEventListener('submit', (e) => {
  e.preventDefault();
  const respostas = {};
  for (const p of PERGUNTAS) {
    const marcada = document.querySelector(`input[name="${p.id}"]:checked`);
    if (!marcada) { alert('Responda todas as perguntas.'); return; }
    respostas[p.id] = Number(marcada.value);
  }
  // O perfil vem da disposição a correr risco; estabilidade e despesas medem a capacidade (mostrada à parte)
  const pontos = ['idade', 'horizonte', 'queda', 'objetivo', 'experiencia']
    .reduce((s, id) => s + PERGUNTAS.find((p) => p.id === id).opcoes[respostas[id]][1], 0);
  let perfil = pontos <= 6 ? 'conservador' : pontos <= 10 ? 'moderado' : 'arrojado';
  // Sem reserva de emergência, limita o perfil a moderado
  if (respostas.reserva === 0 && perfil === 'arrojado') perfil = 'moderado';
  estado.respostas = respostas;
  estado.perfil = perfil;
  estado.alvo = { ...PERFIS[perfil].alvo };
  salvar();
  renderPerfil();
});

function semReserva() { return estado.respostas.reserva === 0 && !reservas().length; }
function reservaIncompleta() { return estado.respostas.reserva !== undefined && estado.respostas.reserva < 2; }

// Capacidade de assumir risco: 'alta', 'media' ou 'baixa'
function capacidadeRisco(r = estado.respostas) {
  if (r.renda === undefined || r.moradia === undefined) return null;
  if (r.renda <= 1 || r.moradia === 0 || r.reserva === 0) return 'baixa';
  if (r.renda >= 2 && r.moradia >= 2 && r.reserva === 2) return 'alta';
  return 'media';
}

const PROXIMO_PERFIL = { conservador: 'moderado', moderado: 'arrojado' };

function textoSituacao() {
  const r = estado.respostas;
  if (r.renda === undefined || r.moradia === undefined) return '';
  const pontos = [];
  if (r.renda === 3) pontos.push('A estabilidade do serviço público dá segurança à sua renda. Uma queda na bolsa não ameaça seu sustento, o que aumenta sua capacidade de assumir risco no longo prazo.');
  else if (r.renda === 2) pontos.push('Renda de carteira assinada é relativamente estável, mas sujeita a demissão. A reserva de emergência é sua proteção.');
  else pontos.push('Com renda variável ou incerta, a reserva precisa ser maior e a carteira deve ter boa liquidez.');
  if (r.moradia === 3) pontos.push('Morando com os pais, suas despesas fixas são baixas: é a melhor fase para poupar uma parte grande da renda e deixar os juros compostos trabalharem.');
  else if (r.moradia === 0) pontos.push('Com dependentes, priorize proteção (reserva maior e seguro de vida) antes de aumentar o risco.');
  pontos.push(`Reserva de emergência recomendada para você: <strong>${mesesReserva()} meses de gastos</strong>.`);
  const cap = capacidadeRisco();
  const prox = PROXIMO_PERFIL[estado.perfil];
  if (cap === 'alta' && prox) {
    pontos.push(`Sua <strong>capacidade</strong> de assumir risco é alta, maior que sua disposição atual. Se quiser buscar mais retorno no longo prazo, você pode usar a alocação do perfil ${PERFIS[prox].nome}. <button class="btn sec mini" type="button" id="subir-perfil" data-perfil="${prox}">Usar alocação ${PERFIS[prox].nome}</button>`);
  } else if (cap === 'baixa' && estado.perfil === 'arrojado') {
    pontos.push('Sua disposição é arrojada, mas sua situação financeira pede cautela. Considere a alocação Moderada até ter renda estável e reserva completa.');
  }
  return `<div class="sinal"><div class="titulo">Sua situação</div><ul class="limpa motivo">${pontos.map((t) => `<li>${t}</li>`).join('')}</ul></div>`;
}

function renderPerfil() {
  if (estado.perfil) {
    const p = PERFIS[estado.perfil];
    $('#resultado-perfil').innerHTML = `
      <div class="perfil-badge">${p.nome}</div>
      <p>${p.desc}</p>
      ${textoSituacao()}
      ${semReserva() ? `<div class="alerta">Você ainda não tem reserva de emergência. Antes de investir em renda variável, monte uma reserva de ${mesesReserva()} meses de gastos em renda fixa pós-fixada com liquidez diária.</div>` : ''}
      <p><a href="#" data-ir="diagnostico">Ver diagnóstico da carteira →</a></p>`;
  } else {
    $('#resultado-perfil').innerHTML = '';
  }

  const alvo = estado.alvo || {};
  $('#form-alvo').innerHTML = CLASSES.map((c) => `
    <label>${c.nome}
      <input type="number" min="0" max="100" step="1" data-classe="${c.id}" value="${alvo[c.id] ?? ''}" ${estado.alvo ? '' : 'disabled'}>
    </label>`).join('');
  atualizarSoma();
  const modo = modoCenario();
  $('#modo-cenario').innerHTML = Object.entries(MODOS_CENARIO).map(([k, m]) => `
    <label class="check"><input type="radio" name="modo-cenario" value="${k}" ${k === modo ? 'checked' : ''}>
      <span><strong>${m.nome}</strong>${k === 'desligado' ? ' (recomendado)' : ''}<br><span class="motivo">${m.desc}</span></span></label>`).join('');
}

$('#modo-cenario').addEventListener('change', (e) => {
  if (e.target.name !== 'modo-cenario') return;
  estado.modoCenario = e.target.value;
  salvar();
  renderTudo();
});

$('#resultado-perfil').addEventListener('click', (e) => {
  const b = e.target.closest('#subir-perfil');
  if (!b) return;
  estado.perfil = b.dataset.perfil;
  estado.alvo = { ...PERFIS[estado.perfil].alvo };
  salvar();
  renderPerfil();
});

$('#form-alvo').addEventListener('input', (e) => {
  const c = e.target.dataset.classe;
  if (!c) return;
  estado.alvo[c] = parseFloat(e.target.value) || 0;
  salvar();
  atualizarSoma();
});

function atualizarSoma() {
  const el = $('#soma-alvo');
  if (!estado.alvo) {
    el.textContent = 'Responda o questionário para definir sua alocação-base.';
    el.className = 'soma';
    return;
  }
  const s = somaAlvo();
  const errado = Math.abs(s - 100) > 0.01;
  el.textContent = `Soma: ${pct(s, 0)}${errado ? ' (ajuste para 100%)' : ''}`;
  el.className = `soma ${errado ? 'neg' : 'pos'}`;
}

// ---------- Cenário ----------

function renderCenario() {
  const cx = cenario();
  const { sinais, jurosReal } = sinaisCenario(cx);
  const aj = alvoAjustado();
  const editado = estado.cenario && Object.keys(estado.cenario).length > 0;
  const MERCADO = typeof window.MERCADO_ATUAL !== 'undefined' ? window.MERCADO_ATUAL : null;

  const kpis = [
    ['Selic', `${pct(cx.selic, 2)}`, ROTULO_TENDENCIA[cx.tendenciaSelic]],
    ['IPCA 12 meses', pct(cx.ipca12m, 2), `teto da meta ${pct(cx.tetoMetaIpca)}`],
    ['Juro real (Selic − IPCA esp.)', pct(jurosReal), `IPCA+ longo ~${pct(cx.taxaIpcaLongo)}`],
    ['Dólar', `${fmt(cx.dolar)}`, `esperado ${fmt(cx.dolarFocusFimAno)}`],
    ['PIB esperado', pct(cx.pibFocusAno, 2), 'ano corrente'],
    ['Juros EUA (Fed)', pct(cx.fedFunds, 2), ROTULO_TENDENCIA[cx.tendenciaFed]],
  ];

  $('#cenario-conteudo').innerHTML = `
    <div class="card">
      <h2>Cenário de referência: ${dataBR(cx.dataReferencia)}${editado ? ' <span class="tag avaliar">editado por você</span>' : ''}</h2>
      <div class="resumo">
        ${kpis.map(([r, v, s]) => `<div class="kpi"><div class="rotulo">${r}</div><div class="valor">${v}</div><div class="rotulo">${esc(s)}</div></div>`).join('')}
      </div>
      ${MERCADO?.macro ? `<p class="dica"><span class="ok">●</span> Selic, IPCA, dólar, expectativas do Boletim Focus, taxa do Tesouro IPCA+, juros e inflação dos EUA atualizados automaticamente (Banco Central, Tesouro Direto e Federal Reserve). Riscos eleitoral e geopolítico seguem o comentário de ${dataBR(CENARIO_PADRAO.dataReferencia)}.</p>` : ''}
      ${!editado && cx.resumo ? `<p class="dica" style="margin-bottom:0">Comentário de ${dataBR(CENARIO_PADRAO.dataReferencia)}:</p><ul class="limpa">${cx.resumo.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    </div>
    <div class="card">
      <h2>Como o cenário afeta a alocação</h2>
      <p class="dica" style="margin-top:0">Ajuste pelo cenário: <strong>${MODOS_CENARIO[modoCenario()].nome}</strong>. ${modoCenario() === 'desligado' ? 'Os sinais abaixo são só informativos: suas metas não mudam.' : modoCenario() === 'leve' ? 'Só os sinais de preço (marcados) mexem nas metas.' : ''} Mude em <a href="#" data-ir="perfil">Perfil</a>.</p>
      ${sinais.length ? sinais.map(renderSinal).join('') : '<p>Nenhum sinal relevante. A alocação-base do perfil é mantida.</p>'}
    </div>
    ${aj ? `
    <div class="card">
      <h2>Alocação do perfil × ${rotuloMeta(true).toLowerCase()}</h2>
      <div class="tabela-wrap"><table>
        <thead><tr><th>Classe</th><th class="num">Base do perfil</th><th class="num">Ajuste</th><th class="num">${rotuloMeta(true)}</th></tr></thead>
        <tbody>${CLASSES.map((c) => {
          const d = aj.final[c.id] - aj.base[c.id];
          return `<tr><td><span style="color:${c.cor}">●</span> ${c.nome}</td>
            <td class="num">${pct(aj.base[c.id])}</td>
            <td class="num ${d > 0.05 ? 'pos' : d < -0.05 ? 'neg' : ''}">${d > 0 ? '+' : ''}${pct(d)}</td>
            <td class="num"><strong>${pct(aj.final[c.id])}</strong></td></tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>` : '<div class="card"><p>Responda o questionário na aba <a href="#" data-ir="perfil">Perfil</a> para ver a alocação ajustada ao cenário.</p></div>'}
    ${!editado && cx.fontes ? `<div class="card"><h2>Fontes</h2><ul class="limpa">${cx.fontes.map(([t, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul></div>` : ''}`;

  renderFormCenario(cx);
}

function renderSinal(s) {
  return `<div class="sinal">
    <div class="titulo">${esc(s.titulo)}${s.preco ? ' <span class="tag manter">sinal de preço</span>' : ''}</div>
    <div class="motivo">${esc(s.texto)}</div>
    <div class="efeitos">${Object.entries(s.efeitos).map(([k, v]) =>
      `<span class="chip ${v > 0 ? 'mais' : 'menos'}">${classe(k).curto} ${v > 0 ? '+' : ''}${v}</span>`).join('')}</div>
  </div>`;
}

function renderFormCenario(cx) {
  $('#form-cenario').innerHTML = CAMPOS_CENARIO.map(([k, rot, tipo]) => {
    if (Array.isArray(tipo)) {
      return `<label>${rot}<select data-k="${k}">${tipo.map((o) => `<option value="${o}" ${cx[k] === o ? 'selected' : ''}>${ROTULO_TENDENCIA[o]}</option>`).join('')}</select></label>`;
    }
    if (tipo === 'bool') {
      return `<label class="check"><input type="checkbox" data-k="${k}" ${cx[k] ? 'checked' : ''}> ${rot}</label>`;
    }
    return `<label>${rot}<input type="${tipo}" step="any" data-k="${k}" value="${esc(cx[k])}"></label>`;
  }).join('');
}

$('#form-cenario').addEventListener('change', (e) => {
  const k = e.target.dataset.k;
  if (!k) return;
  const campo = CAMPOS_CENARIO.find((c) => c[0] === k);
  let v;
  if (campo[2] === 'bool') v = e.target.checked;
  else if (campo[2] === 'number') v = parseFloat(e.target.value);
  else v = e.target.value;
  if (campo[2] === 'number' && !Number.isFinite(v)) return;
  estado.cenario = Object.assign({}, estado.cenario, { [k]: v });
  salvar();
  renderCenario();
});

$('#restaurar-cenario').addEventListener('click', () => {
  estado.cenario = null;
  salvar();
  renderCenario();
  $('#status-bcb').textContent = 'Dados padrão restaurados.';
});

// Séries do SGS/BCB: 432 = meta Selic, 13522 = IPCA 12 meses, 1 = dólar PTAX venda
async function serieBCB(codigo) {
  const r = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados/ultimos/1?formato=json`);
  if (!r.ok) throw new Error(r.status);
  const [d] = await r.json();
  return parseFloat(String(d.valor).replace(',', '.'));
}

$('#buscar-bcb').addEventListener('click', async () => {
  const st = $('#status-bcb');
  st.textContent = 'Buscando dados no Banco Central...';
  const novos = {};
  const pedidos = [['selic', 432], ['ipca12m', 13522], ['dolar', 1]];
  const res = await Promise.allSettled(pedidos.map(([, c]) => serieBCB(c)));
  res.forEach((r, i) => { if (r.status === 'fulfilled' && Number.isFinite(r.value)) novos[pedidos[i][0]] = r.value; });
  if (!Object.keys(novos).length) {
    st.textContent = 'Não foi possível acessar a API do Banco Central a partir deste navegador. Atualize os campos manualmente.';
    return;
  }
  novos.dataReferencia = new Date().toISOString().slice(0, 10);
  estado.cenario = Object.assign({}, estado.cenario, novos);
  salvar();
  renderCenario();
  $('#status-bcb').textContent = `Atualizado: ${Object.keys(novos).filter((k) => k !== 'dataReferencia').join(', ')}. Revise tendências e expectativas manualmente.`;
});

// ---------- Diagnóstico ----------

function diagnosticar(tol = 5) {
  const { porClasse, total } = totais();
  const aj = alvoAjustado();
  const linhas = CLASSES.map((c) => {
    const atual = total ? (porClasse[c.id] / total) * 100 : 0;
    const meta = aj.final[c.id];
    return { c, valor: porClasse[c.id], atual, meta, desvio: atual - meta };
  });
  const nota = Math.max(0, Math.round(100 - linhas.reduce((s, l) => s + Math.abs(l.desvio), 0) / 2));
  const porId = Object.fromEntries(linhas.map((l) => [l.c.id, l]));

  // Recomendação por ativo
  const acoes = investidos().map((a) => {
    const c = classe(a.classe);
    const l = porId[a.classe];
    const peso = total ? (valorAtivo(a) / total) * 100 : 0;
    let acao = 'manter', motivo = 'Classe próxima da meta para o seu perfil e o cenário atual.';

    if (a.classe === 'cripto' && estado.perfil === 'conservador') {
      acao = 'vender'; motivo = 'Cripto é muito volátil e incompatível com o perfil conservador.';
    } else if (!c.rendaFixa && !ehFundoDiversificado(a) && peso > LIMITE_CONCENTRACAO) {
      acao = 'reduzir'; motivo = `Representa ${pct(peso)} da carteira, acima do limite de ${LIMITE_CONCENTRACAO}% para um único ativo de renda variável.`;
    } else if (l.meta === 0 && l.atual > 0) {
      acao = 'vender'; motivo = 'Sua alocação-base não prevê esta classe (meta zero).';
    } else if (l.desvio > tol) {
      acao = 'reduzir'; motivo = `${c.curto} está ${pct(l.desvio)} acima da meta. Pare de aportar aqui e considere vender parte para rebalancear.`;
      if (a.classe === 'rf_pos') motivo += ' Mantenha intacta a parte que é sua reserva de emergência.';
    } else if (l.desvio < -tol) {
      acao = 'comprar'; motivo = `${c.curto} está ${pct(-l.desvio)} abaixo da meta. Priorize nos próximos aportes.`;
    } else if (!c.rendaFixa && peso < 1 && total > 0) {
      acao = 'avaliar'; motivo = 'Posição muito pequena (< 1% da carteira). Aumente até um peso relevante ou concentre em outro ativo da classe.';
    } else if (l.desvio < -1) {
      acao = 'comprar'; motivo = `${c.curto} está levemente abaixo da meta. Pode receber aportes.`;
    }

    // Fundamentos (ações e FIIs) refinam a recomendação
    const av = avaliarFundamentos(a);
    if (av.nivel === 'fraco') {
      const ruins = av.pontos.filter((p) => p.nivel < 0).map((p) => p.texto).slice(0, 2).join(' ');
      if (acao === 'manter' || acao === 'comprar') {
        acao = 'avaliar';
        motivo = `Fundamentos fracos (${f1(av.nota)}/10). ${ruins} Antes de aportar mais, revise a tese. Se não melhorar, considere trocar por outro ativo da classe.`;
      } else if (acao === 'reduzir') {
        motivo += ` Os fundamentos também estão fracos (${f1(av.nota)}/10): priorize reduzir este ativo.`;
      }
    } else if (av.nivel === 'bom' && acao === 'comprar') {
      motivo += ` Fundamentos sólidos (${f1(av.nota)}/10).`;
    } else if (av.nivel === null && (av.tipo === 'acao' || av.tipo === 'fii') && acao === 'comprar') {
      motivo += ' Confira os fundamentos na aba Análise de ativos antes de comprar.';
    }
    return { a, peso, acao, motivo, av };
  }).sort((x, y) => ORDEM_ACAO[x.acao] - ORDEM_ACAO[y.acao] || y.peso - x.peso);

  // Sugestões de inclusão: classes abaixo da meta com poucos ou nenhum ativo
  const inclusoes = linhas
    .filter((l) => l.desvio < -tol / 2 && l.meta > 0)
    .map((l) => ({ l, qtd: investidos().filter((a) => a.classe === l.c.id).length }))
    .sort((x, y) => x.l.desvio - y.l.desvio);

  const alertas = [];
  if (semReserva()) alertas.push(`Você não tem reserva de emergência. Antes de qualquer outro movimento, acumule ${mesesReserva()} meses de gastos em Tesouro Selic ou CDB com liquidez diária.`);
  const nAcoes = investidos().filter((a) => a.classe === 'acoes').length;
  const temEtf = investidos().some((a) => a.classe === 'acoes' && /11$/.test(a.nome));
  if (nAcoes > 0 && nAcoes < 5 && !temEtf) alertas.push(`Só ${nAcoes} ação(ões) na carteira. Diversifique em 5 a 10 empresas de setores diferentes ou use um ETF.`);
  const nFiis = investidos().filter((a) => a.classe === 'fiis').length;
  if (nFiis > 0 && nFiis < 3) alertas.push(`Só ${nFiis} FII(s). Diversifique entre ao menos 3 fundos de segmentos distintos.`);
  const cx = cenario();
  if (cx.riscoEleitoral && porId.acoes.desvio > 0) alertas.push('Ações acima da meta em período eleitoral. Após um rali forte, considere realizar parte do lucro.');
  if (porId.rf_pre.atual > 0 && (cx.ipca12m > cx.tetoMetaIpca)) alertas.push('Com inflação acima do teto, prefixados correm o risco de perder para a inflação se ela continuar subindo. Evite aumentar essa posição.');

  return { linhas, nota, acoes, inclusoes, alertas, total };
}

const ORDEM_ACAO = { vender: 0, reduzir: 1, comprar: 2, avaliar: 3, manter: 4 };
const ROTULO_ACAO = { vender: 'Vender', reduzir: 'Reduzir', comprar: 'Comprar mais', avaliar: 'Avaliar', manter: 'Manter' };

function textoNota(n) {
  if (n >= 90) return 'Excelente: bem alinhada ao perfil e ao cenário';
  if (n >= 75) return 'Boa, com pequenos ajustes';
  if (n >= 55) return 'Precisa de rebalanceamento';
  return 'Muito desalinhada ao perfil e ao cenário';
}

function renderDiagnostico() {
  const alvo = $('#diagnostico-conteudo');
  if (!estado.perfil) {
    alvo.innerHTML = `<div class="card"><h2>Comece por aqui</h2>
      <ol class="limpa">
        <li>Responda o questionário na aba <a href="#" data-ir="perfil">Perfil</a>.</li>
        <li>Cadastre seus investimentos na aba <a href="#" data-ir="carteira">Carteira</a>.</li>
        <li>Volte aqui para ver se a carteira está adequada ao cenário atual e o que comprar ou vender.</li>
      </ol></div>`;
    return;
  }
  if (!investidos().length) {
    alvo.innerHTML = '<div class="card"><p>Cadastre seus investimentos na aba <a href="#" data-ir="carteira">Carteira</a> para ver o diagnóstico.</p></div>';
    return;
  }
  const { linhas, nota, acoes, inclusoes, alertas, total } = diagnosticar();
  const { sinais } = sinaisCenario();
  const cx = cenario();
  const escala = Math.max(...linhas.map((l) => Math.max(l.atual, l.meta)), 1);

  alvo.innerHTML = `
    ${typeof cardLembretes === 'function' ? cardLembretes() : ''}
    ${typeof cardCaixas === 'function' ? cardCaixas() : ''}
    <div class="cols bloco">
      <div class="card">
        <h2>Nota da carteira</h2>
        <div class="nota">${nota}<small> / 100</small></div>
        <p>${textoNota(nota)}</p>
        <p class="dica">Perfil ${PERFIS[estado.perfil].nome}, cenário de ${dataBR(cx.dataReferencia)}. A nota mede a proximidade da carteira (${fmt(total)}) com a ${rotuloMeta().toLowerCase()}.</p>
      </div>
      <div class="card">
        <h2>Leitura do cenário</h2>
        <ul class="limpa">${sinais.slice(0, 5).map((s) => `<li>${esc(s.titulo)}</li>`).join('')}</ul>
        <p><a href="#" data-ir="cenario">Ver detalhes do cenário →</a></p>
      </div>
    </div>

    ${alertas.length ? `<div class="card"><h2>Pontos de atenção</h2>${alertas.map((a) => `<div class="alerta">${esc(a)}</div>`).join('')}</div>` : ''}

    <div class="card">
      <h2>Alocação atual × ${rotuloMeta(true).toLowerCase()}</h2>
      <div class="barras">
        ${linhas.filter((l) => l.atual > 0 || l.meta > 0).map((l) => `
          <div class="barra-linha">
            <div class="cab">
              <span>${l.c.nome}</span>
              <span class="num">${pct(l.atual)} <span style="color:var(--suave)">/ meta ${pct(l.meta)}</span>
                <span class="${Math.abs(l.desvio) <= 5 ? 'ok' : 'neg'}"> (${l.desvio >= 0 ? '+' : ''}${pct(l.desvio)})</span></span>
            </div>
            <div class="trilho">
              <div class="preench" style="width:${(l.atual / escala) * 100}%;background:${l.c.cor}"></div>
              <div class="marca" style="left:${(l.meta / escala) * 100}%" title="Meta"></div>
            </div>
          </div>`).join('')}
      </div>
      <p class="dica">A barra mostra o percentual atual. O traço vertical marca a ${rotuloMeta().toLowerCase()}.</p>
    </div>

    <div class="card">
      <h2>O que fazer com cada ativo</h2>
      <div class="tabela-wrap"><table>
        <thead><tr><th>Ativo</th><th>Classe</th><th class="num">% carteira</th><th>Ação</th><th>Por quê</th></tr></thead>
        <tbody>${acoes.map((x) => `<tr>
          <td><strong>${esc(x.a.nome)}</strong>${x.av.nivel ? `<br><span class="motivo ${x.av.nivel === 'bom' ? 'pos' : x.av.nivel === 'fraco' ? 'neg' : ''}">Fundamentos ${f1(x.av.nota)}/10</span>` : ''}</td>
          <td>${classe(x.a.classe).curto}</td>
          <td class="num">${pct(x.peso)}</td>
          <td><span class="tag ${x.acao}">${ROTULO_ACAO[x.acao]}</span></td>
          <td class="motivo">${esc(x.motivo)}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      <p class="dica">Para saber quanto vender e onde aplicar, use o <a href="#" data-ir="plano">Plano de ação</a>.</p>
    </div>

    ${typeof cardPoda === 'function' ? cardPoda() : ''}

    ${typeof cardPerfilAcoes === 'function' ? cardPerfilAcoes() : ''}

    ${typeof cardRisco === 'function' ? cardRisco() : ''}

    ${inclusoes.length ? `
    <div class="card">
      <h2>O que incluir na carteira</h2>
      ${inclusoes.map(({ l, qtd }) => `
        <h3><span style="color:${l.c.cor}">●</span> ${l.c.nome}: faltam ${pct(-l.desvio)} (≈ ${fmt((-l.desvio / 100) * total)})</h3>
        ${qtd ? `<p class="dica">Você já tem ${qtd} ativo(s) nesta classe. Pode reforçá-los ou diversificar com:</p>` : ''}
        ${CATALOGO[l.c.id].map(([n, d]) => `<div class="sugestao"><strong>${esc(n)}</strong><span class="motivo">${esc(d)}</span></div>`).join('')}
      `).join('')}
    </div>` : ''}`;
}

// ---------- Plano de ação ----------

function gerarPlano(aporte, permitirVendas, tol, reserva = 0) {
  const { total } = totais();
  const meta = alvoAjustado().final;
  const novoTotal = total + aporte;
  const vendas = new Map(); // id -> { a, valor, motivo }

  const addVenda = (a, valor, motivo) => {
    if (a.travado) return; // sem liquidez (ex.: CDB que só vence no fim): nunca sugere venda
    const max = valorAtivo(a) - (vendas.get(a.id)?.valor || 0);
    const v = Math.min(valor, max);
    if (v < 1) return;
    const atual = vendas.get(a.id);
    vendas.set(a.id, { a, valor: (atual?.valor || 0) + v, motivo: atual ? `${atual.motivo} ${motivo}` : motivo });
  };

  // Vendas seguem só o semáforo: 🟡 vender o excesso (bandas 5/25 + preço-teto) e 🔴 venda total
  // por perda de fundamentos. Queda de preço, FIIs com lucro e ativos sem liquidez nunca entram.
  if (permitirVendas && total > 0 && typeof semaforo === 'function') {
    for (const x of semaforo()) {
      if (x.cor === 'vermelho') addVenda(x.a, valorAtivo(x.a), `🔴 ${x.motivo}`);
      else if (x.cor === 'amarelo') {
        const valor = x.qtd != null ? x.qtd * preco(x.a) : x.excesso;
        if (valor >= 1) addVenda(x.a, valor, `🟡 ${x.motivo}`);
      }
    }
  }

  const totalVendas = [...vendas.values()].reduce((s, v) => s + v.valor, 0);
  const caixa = aporte + totalVendas;

  // Valor por classe após as vendas
  const apos = Object.fromEntries(CLASSES.map((c) => [c.id, 0]));
  for (const a of investidos()) apos[a.classe] += valorAtivo(a) - (vendas.get(a.id)?.valor || 0);

  const deficits = CLASSES.map((c) => ({ c, falta: Math.max(0, (meta[c.id] / 100) * novoTotal - apos[c.id]) }));
  const somaDef = deficits.reduce((s, d) => s + d.falta, 0);
  const compras = deficits
    .map((d) => {
      const valor = somaDef > 0 ? (d.falta / somaDef) * caixa : 0;
      return { ...d, valor, ativos: distribuirNaClasse(d.c.id, valor, vendas) };
    })
    .filter((d) => d.valor >= 1)
    .sort((x, y) => y.valor - x.valor);

  // Alocação final
  const final = { ...apos };
  for (const cp of compras) final[cp.c.id] += cp.valor;

  return { vendas: [...vendas.values()].sort((x, y) => y.valor - x.valor), totalVendas, caixa, compras, final, novoTotal, meta };
}

// Filtro de qualidade para receber aporte: nota de pelo menos 6 e, em ações, preço até 33% acima do maior preço-teto.
// Devolve o motivo quando o ativo fica de fora.
const NOTA_MINIMA_APORTE = 6;
function motivoSemAporte(a) {
  if (typeof deterioracao === 'function' && deterioracao(a).length >= 2) return 'perda de fundamentos (venda total)';
  const av = avaliarFundamentos(a);
  if (av.nota != null && av.nota < NOTA_MINIMA_APORTE) return `nota ${f1(av.nota)}/10`;
  if (tipoAtivo(a) === 'acao') {
    const v = valuation(a);
    const teto = tetoMaior(v);
    if (teto && v.p > teto * 1.33) return `preço ${f1((v.p / teto - 1) * 100)}% acima do preço-teto`;
  }
  return null;
}

// Dentro da classe, direciona o dinheiro para os ativos mais abaixo do seu % ideal (peso de 0 a 100),
// só entre os que passam no filtro de qualidade. Ativos vendidos, com peso 0 ou sem liquidez não recebem compras.
function distribuirNaClasse(classeId, valor, vendas) {
  const rf = classe(classeId).rendaFixa;
  let ativos = investidos().filter((a) => a.classe === classeId && !vendas.has(a.id) && !a.travado && pesoAtivo(a) > 0);
  // Em renda fixa, só distribui entre títulos com peso definido (ex.: escada de vencimentos do IPCA+);
  // sem pesos, o que importa é o tipo de título: o plano sugere opções da classe
  if (rf) {
    ativos = ativos.filter((a) => Number.isFinite(a.peso));
    if (!ativos.length) return [];
  }
  const excluidos = [];
  if (!rf) {
    const aprovados = ativos.filter((a) => {
      const m = motivoSemAporte(a);
      if (m) excluidos.push({ a, motivo: m });
      return !m;
    });
    // Se ninguém passar no filtro, ao menos evita os de fundamentos fracos
    if (aprovados.length) ativos = aprovados;
    else {
      excluidos.length = 0;
      const saudaveis = ativos.filter((a) => avaliarFundamentos(a).nivel !== 'fraco');
      if (saudaveis.length) ativos = saudaveis;
    }
  }
  if (!ativos.length || valor <= 0) return Object.assign([], { excluidos });
  const atuais = ativos.map((a) => ({ a, v: valorAtivo(a), add: 0 }));
  const somaV = atuais.reduce((s, x) => s + x.v, 0);
  const somaP = atuais.reduce((s, x) => s + pesoAtivo(x.a), 0);
  const totalDepois = somaV + valor;
  atuais.forEach((x) => {
    x.pesoAntes = somaV ? (x.v / somaV) * 100 : 0;
    x.alvo = (totalDepois * pesoAtivo(x.a)) / somaP;
  });
  // Ações e FIIs da B3: compra cota inteira, sempre no ativo mais longe (em %) do seu alvo
  if (!rf && atuais.every((x) => TICKER_B3.test(x.a.nome) && preco(x.a) > 0)) {
    let caixa = valor;
    for (;;) {
      const cabe = atuais.filter((x) => preco(x.a) <= caixa);
      if (!cabe.length) break;
      const falta = (x) => (x.alvo - x.v - x.add) / x.alvo;
      const mais = cabe.reduce((m, x) => (falta(x) > falta(m) ? x : m));
      mais.add += preco(mais.a);
      caixa -= preco(mais.a);
    }
    return Object.assign(atuais.filter((x) => x.add > 0).sort((p, q) => q.add - p.add), { excluidos, sobra: caixa });
  }
  const faltas = atuais.map((x) => Math.max(0, x.alvo - x.v));
  const somaF = faltas.reduce((s, f) => s + f, 0);
  atuais.forEach((x, i) => { x.add = somaF > 0 ? (faltas[i] / somaF) * valor : (valor * pesoAtivo(x.a)) / somaP; });
  return Object.assign(atuais.filter((x) => x.add >= 1).sort((p, q) => q.add - p.add), { excluidos });
}

function notaIR(a) {
  const c = a.classe;
  if (c === 'acoes' && !/11$/.test(a.nome)) return 'Ações: vendas de até R$ 20 mil no mês são isentas de IR sobre o lucro. Acima disso, 15%.';
  if (c === 'acoes' || c === 'inter' || c === 'cripto') return 'ETF/BDR: 15% de IR sobre o lucro, sem isenção de R$ 20 mil.';
  if (c === 'fiis') return 'FIIs: 20% de IR sobre o lucro na venda.';
  return 'Renda fixa: IR regressivo de 22,5% a 15% (LCI/LCA isentas). Vender títulos antes do vencimento pode gerar perda por marcação a mercado.';
}

$('#form-plano').addEventListener('submit', (e) => {
  e.preventDefault();
  const saida = $('#resultado-plano');
  if (!estado.alvo) {
    saida.innerHTML = '<div class="card"><p>Primeiro defina seu perfil na aba <a href="#" data-ir="perfil">Perfil</a>.</p></div>';
    return;
  }
  if (Math.abs(somaAlvo() - 100) > 0.01) {
    saida.innerHTML = '<div class="card"><p class="neg">A alocação-base precisa somar 100%. Ajuste na aba Perfil.</p></div>';
    return;
  }
  const salario = parseFloat($('#valor-aporte').value) || 0;
  const proventos = parseFloat($('#valor-proventos').value) || 0;
  const campoObj = $('#valor-objetivos').value;
  const paraObjetivos = Math.min(salario, campoObj === '' ? (typeof aporteObjetivoAtual === 'function' ? aporteObjetivoAtual() : 0) : parseFloat(campoObj) || 0);
  // Proventos podem ser reinvestidos só nos FIIs (ex.: "bola de neve" dos fundos de papel)
  const proventosFiis = $('#proventos-fiis').checked ? proventos : 0;
  const aporte = salario + proventos - proventosFiis - paraObjetivos;
  const permitir = $('#permitir-vendas').checked;
  const tol = parseFloat($('#tolerancia').value) || 0;
  const reserva = parseFloat($('#reserva-valor').value) || 0;
  estado.reservaValor = reserva;
  salvar();
  if (aporte <= 0 && !permitir && !paraObjetivos) {
    saida.innerHTML = '<div class="card"><p>Informe um aporte ou marque "Permitir vendas" para rebalancear.</p></div>';
    return;
  }
  if (!investidos().length && aporte <= 0) {
    saida.innerHTML = '<div class="card"><p>Cadastre seus ativos ou informe um aporte.</p></div>';
    return;
  }

  const p = gerarPlano(aporte, permitir, tol, reserva);
  if (proventosFiis > 0) {
    const ativosFii = distribuirNaClasse('fiis', proventosFiis, new Map(p.vendas.map((v) => [v.a.id, v])));
    const cFii = classe('fiis');
    const existente = p.compras.find((cp) => cp.c.id === 'fiis');
    if (existente) {
      // Junta com o que o plano já mandava para FIIs
      existente.valor += proventosFiis;
      existente.ativos = distribuirNaClasse('fiis', existente.valor, new Map(p.vendas.map((v) => [v.a.id, v])));
    } else p.compras.push({ c: cFii, valor: proventosFiis, ativos: ativosFii, proventos: true });
    p.caixa += proventosFiis;
    p.final.fiis += proventosFiis;
  }
  const { porClasse, total } = totais();

  saida.innerHTML = `
    ${reservaIncompleta() ? '<div class="alerta">Sua reserva de emergência não está completa. Considere direcionar o aporte primeiro para Tesouro Selic ou CDB com liquidez diária até completá-la.</div>' : ''}
    ${paraObjetivos > 0 ? (() => {
      const prox = typeof projetarObjetivos === 'function' ? projetarObjetivos().find((x) => x.n > 0) : null;
      return `<div class="card"><h2>Objetivos: ${fmt(paraObjetivos)}</h2><p style="margin:0">${prox ? `Para <strong>${esc(prox.o.nome)}</strong> (${prox.n} meses). ${veiculoObjetivo(prox.n)}` : 'Aplique com liquidez diária.'}</p></div>`;
    })() : ''}
    <div class="resumo">
      <div class="kpi"><div class="rotulo">Aporte no longo prazo</div><div class="valor">${fmt(aporte)}</div>${proventos ? `<div class="motivo">${proventosFiis ? `+ ${fmt(proventosFiis)} de proventos nos FIIs` : `inclui ${fmt(proventos)} de proventos`}</div>` : ''}</div>
      <div class="kpi"><div class="rotulo">Vendas sugeridas</div><div class="valor ${p.totalVendas ? 'neg' : ''}">${fmt(p.totalVendas)}</div></div>
      <div class="kpi"><div class="rotulo">Total para comprar</div><div class="valor pos">${fmt(p.caixa)}</div></div>
    </div>

    ${permitir ? `
    <div class="card">
      <h2>1. Vender / reduzir</h2>
      ${p.vendas.length ? `<div class="tabela-wrap"><table>
        <thead><tr><th>Ativo</th><th class="num">Valor a vender</th><th class="num">Qtd aprox.</th><th>Motivo</th><th>Imposto</th></tr></thead>
        <tbody>${p.vendas.map((v) => {
          const lucro = (preco(v.a) - v.a.pm) * (v.valor / preco(v.a));
          return `<tr>
          <td><strong>${esc(v.a.nome)}</strong></td>
          <td class="num">${fmt(v.valor)}</td>
          <td class="num">${classe(v.a.classe).rendaFixa ? '—' : TICKER_B3.test(v.a.nome) ? num(Math.round(v.valor / preco(v.a))) : f2(v.valor / preco(v.a))}</td>
          <td class="motivo">${esc(v.motivo)}</td>
          <td class="motivo">${lucro > 0 ? `Lucro estimado de ${fmt(lucro)}. ` : 'Sem lucro nesta venda. '}${notaIR(v.a)}</td>
        </tr>`;
        }).join('')}</tbody>
      </table></div>
      ${(() => {
        if (typeof escudoFiscal !== 'function') return '';
        const vendAcoes = p.vendas.filter((v) => tipoAtivo(v.a) === 'acao').reduce((s, v) => s + v.valor, 0);
        const ef = escudoFiscal();
        return vendAcoes ? `<p class="${vendAcoes > ef.livre ? 'alerta' : 'dica'}">Vendas de ações neste plano: ${fmt(vendAcoes)}. Limite isento ainda livre no mês: ${fmt(ef.livre)}.${vendAcoes > ef.livre ? ' Passaria do limite de R$ 20 mil: divida as vendas entre dois meses.' : ''}</p>` : '';
      })()}
      <p class="dica">Se o imposto for alto, você pode apenas parar de aportar nesses ativos e rebalancear aos poucos com os aportes.</p>`
      : '<p class="ok">Nenhuma venda necessária: a carteira está dentro da tolerância.</p>'}
    </div>` : ''}

    <div class="card">
      <h2>${permitir ? '2. ' : ''}Comprar / aportar</h2>
      ${p.compras.length ? p.compras.map((cp) => `
        <h3><span style="color:${cp.c.cor}">●</span> ${cp.c.nome}: ${fmt(cp.valor)}${cp.proventos ? ' <span class="motivo">(proventos reinvestidos)</span>' : ''}</h3>
        ${cp.ativos.length ? `<div class="tabela-wrap"><table>
          <thead><tr><th>Ativo</th><th class="num">Valor</th><th class="num">Preço atual</th><th class="num">Qtd aprox.</th></tr></thead>
          <tbody>${cp.ativos.map((x) => `<tr>
            <td>${esc(x.a.nome)}<br><span class="motivo">${f1(x.pesoAntes)}% da classe hoje</span></td>
            <td class="num">${fmt(x.add)}</td>
            <td class="num">${fmt(preco(x.a))}</td>
            <td class="num">${cp.c.rendaFixa ? '—' : TICKER_B3.test(x.a.nome) ? num(Math.round(x.add / preco(x.a))) : f2(x.add / preco(x.a))}</td>
          </tr>`).join('')}</tbody>
        </table></div>
        ${cp.ativos.sobra >= 1 ? `<p class="dica">Sobram ${fmt(cp.ativos.sobra)} (não completam uma cota): deixe na renda fixa pós e use no próximo aporte.</p>` : ''}
        ${cp.ativos.excluidos?.length ? `<p class="dica">Sem aporte agora: ${cp.ativos.excluidos.map((x) => `${esc(x.a.nome)} (${esc(x.motivo)})`).join(', ')}.</p>` : ''}
        <p class="dica">Ou diversifique com: ${CATALOGO[cp.c.id].map((i) => esc(i[0])).join(' · ')}</p>`
        : !cp.c.rendaFixa && investidos().some((a) => a.classe === cp.c.id) ? `<p class="dica">${cp.ativos.excluidos?.length && !cp.ativos.sobra ? `Nenhum ativo da classe passou no filtro de qualidade (${cp.ativos.excluidos.map((x) => `${esc(x.a.nome)}: ${esc(x.motivo)}`).join('; ')}).` : `Valor pequeno demais para comprar uma cota: deixe na renda fixa pós e some ao próximo aporte.`}</p>`
        : `<p class="dica">${cp.c.rendaFixa ? 'Escolha o título com a melhor taxa disponível na sua corretora. Opções:' : 'Você não tem ativos nesta classe. Opções:'}</p>
          ${CATALOGO[cp.c.id].map(([n, d]) => `<div class="sugestao"><strong>${esc(n)}</strong><span class="motivo">${esc(d)}</span></div>`).join('')}`}
      `).join('') : '<p>Nada a comprar.</p>'}
    </div>

    <div class="card">
      <h2>Resultado após o plano</h2>
      <div class="tabela-wrap"><table>
        <thead><tr><th>Classe</th><th class="num">Hoje</th><th class="num">Depois</th><th class="num">${rotuloMeta(true)}</th></tr></thead>
        <tbody>${CLASSES.filter((c) => porClasse[c.id] > 0 || p.meta[c.id] > 0).map((c) => `<tr>
          <td><span style="color:${c.cor}">●</span> ${c.nome}</td>
          <td class="num">${pct(total ? (porClasse[c.id] / total) * 100 : 0)}</td>
          <td class="num"><strong>${pct(p.novoTotal ? (p.final[c.id] / p.novoTotal) * 100 : 0)}</strong></td>
          <td class="num">${pct(p.meta[c.id])}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`;
});

// ---------- Início ----------

function renderTudo() {
  $('#token-brapi').value = estado.tokenBrapi || '';
  $('#auto-cotacoes').checked = !!estado.autoCotacoes;
  $('#reserva-valor').value = estado.reservaValor || '';
  renderCarteira();
  renderPerguntas();
  renderPerfil();
  renderCenario();
  renderDiagnostico();
  renderAnalise();
  if (typeof renderIA === 'function') renderIA();
  if (typeof renderEvolucao === 'function') renderEvolucao();
  if (typeof renderAcompanhamento === 'function') renderAcompanhamento();
  if (typeof renderGestaoObjetivos === 'function') renderGestaoObjetivos();
  if (typeof renderRotina === 'function') renderRotina();
  if (typeof renderPlanejamento === 'function') renderPlanejamento();
  $('#resultado-plano').innerHTML = '';
}

renderTudo();
if (estado.autoCotacoes && estado.ativos.some(tickerCotavel)) atualizarCotacoes();
