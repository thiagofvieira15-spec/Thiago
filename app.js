'use strict';

// ---------- Configuração ----------

const CLASSES = [
  { id: 'rf_pos', nome: 'Renda Fixa – Pós (Selic/CDI)', cor: '#2f7ed8', rendaFixa: true,
    exemplos: 'Tesouro Selic, CDB com liquidez diária, LCI/LCA pós-fixadas' },
  { id: 'rf_ipca', nome: 'Renda Fixa – Inflação/Pré', cor: '#7cb5ec', rendaFixa: true,
    exemplos: 'Tesouro IPCA+, Tesouro Prefixado, CDB/LCI de prazo maior' },
  { id: 'acoes', nome: 'Ações Brasil', cor: '#e8743b', rendaFixa: false,
    exemplos: 'ETF BOVA11 ou ações de empresas sólidas e pagadoras de dividendos' },
  { id: 'fiis', nome: 'Fundos Imobiliários', cor: '#19a979', rendaFixa: false,
    exemplos: 'ETF de FIIs (ex.: XFIX11) ou FIIs de tijolo e papel diversificados' },
  { id: 'inter', nome: 'Internacional', cor: '#945ecf', rendaFixa: false,
    exemplos: 'ETFs como IVVB11, WRLD11 ou BDRs de ETFs globais' },
  { id: 'cripto', nome: 'Cripto', cor: '#f4b400', rendaFixa: false,
    exemplos: 'ETFs de cripto como HASH11 ou BITH11' },
];

const PERFIS = {
  conservador: {
    nome: 'Conservador',
    desc: 'Prioriza segurança e liquidez. Aceita retornos menores para evitar oscilações.',
    alvo: { rf_pos: 50, rf_ipca: 30, acoes: 8, fiis: 7, inter: 5, cripto: 0 },
  },
  moderado: {
    nome: 'Moderado',
    desc: 'Busca equilíbrio entre segurança e crescimento. Tolera oscilações moderadas.',
    alvo: { rf_pos: 25, rf_ipca: 25, acoes: 20, fiis: 12, inter: 15, cripto: 3 },
  },
  arrojado: {
    nome: 'Arrojado',
    desc: 'Foco em crescimento de longo prazo. Aceita quedas fortes no curto prazo.',
    alvo: { rf_pos: 10, rf_ipca: 15, acoes: 35, fiis: 12, inter: 23, cripto: 5 },
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
  { id: 'reserva', texto: 'Você tem reserva de emergência (6 meses de gastos)?', opcoes: [
    ['Não tenho', 0], ['Tenho parte dela', 1], ['Sim, completa', 3]] },
];

const CHAVE = 'minha-carteira-v1';

// ---------- Estado ----------

let estado = carregar();

function estadoInicial() {
  return { ativos: [], respostas: {}, perfil: null, alvo: null };
}

function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return Object.assign(estadoInicial(), JSON.parse(bruto));
  } catch (e) { /* armazenamento indisponível */ }
  return estadoInicial();
}

function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) { /* ignora */ }
}

// ---------- Utilidades ----------

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmt = (v) => brl.format(v || 0);
const pct = (v, casas = 1) => `${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
const num = (v) => (v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 8 });
const $ = (s) => document.querySelector(s);
const classe = (id) => CLASSES.find((c) => c.id === id);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function valorAtivo(a) { return a.qtd * (a.pa || a.pm); }
function custoAtivo(a) { return a.qtd * a.pm; }

function totais() {
  const porClasse = Object.fromEntries(CLASSES.map((c) => [c.id, 0]));
  let total = 0, custo = 0;
  for (const a of estado.ativos) {
    const v = valorAtivo(a);
    porClasse[a.classe] = (porClasse[a.classe] || 0) + v;
    total += v;
    custo += custoAtivo(a);
  }
  return { porClasse, total, custo };
}

// ---------- Abas ----------

document.querySelectorAll('.aba').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.aba').forEach((x) => x.classList.toggle('ativa', x === b));
  document.querySelectorAll('.painel').forEach((p) => p.classList.toggle('ativo', p.id === b.dataset.aba));
  if (b.dataset.aba === 'avaliacao') renderAvaliacao();
}));

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
  };
  if (id) {
    estado.ativos = estado.ativos.map((a) => (a.id === id ? ativo : a));
  } else {
    estado.ativos.push(ativo);
  }
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
    <div class="kpi"><div class="rotulo">Patrimônio atual</div><div class="valor">${fmt(total)}</div></div>
    <div class="kpi"><div class="rotulo">Total investido</div><div class="valor">${fmt(custo)}</div></div>
    <div class="kpi"><div class="rotulo">Resultado</div><div class="valor ${cls}">${fmt(resultado)}</div></div>
    <div class="kpi"><div class="rotulo">Rentabilidade</div><div class="valor ${cls}">${pct(rent, 2)}</div></div>
    <div class="kpi"><div class="rotulo">Perfil</div><div class="valor">${estado.perfil ? PERFIS[estado.perfil].nome : '—'}</div></div>`;

  const ativos = [...estado.ativos].sort((a, b) => valorAtivo(b) - valorAtivo(a));
  $('#tabela-ativos tbody').innerHTML = ativos.map((a) => {
    const v = valorAtivo(a);
    const r = v - custoAtivo(a);
    const rp = custoAtivo(a) > 0 ? (r / custoAtivo(a)) * 100 : 0;
    return `<tr>
      <td><strong>${esc(a.nome)}</strong></td>
      <td>${classe(a.classe)?.nome || a.classe}</td>
      <td class="num">${num(a.qtd)}</td>
      <td class="num">${fmt(a.pm)}</td>
      <td class="num">${fmt(a.pa)}</td>
      <td class="num">${fmt(v)}</td>
      <td class="num ${r >= 0 ? 'pos' : 'neg'}">${fmt(r)} (${pct(rp)})</td>
      <td class="num">${pct(total ? (v / total) * 100 : 0)}</td>
      <td>
        <button class="btn sec mini" data-acao="editar" data-id="${a.id}">Editar</button>
        <button class="btn perigo mini" data-acao="remover" data-id="${a.id}">Remover</button>
      </td>
    </tr>`;
  }).join('');
  $('#vazio').hidden = ativos.length > 0;
  $('#tabela-ativos').hidden = ativos.length === 0;
}

// Backup
$('#exportar').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' });
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
    salvar();
    renderTudo();
    alert('Backup importado com sucesso.');
  } catch (err) {
    alert('Arquivo inválido.');
  }
  e.target.value = '';
});

$('#limpar').addEventListener('click', () => {
  if (!confirm('Apagar todos os ativos e o perfil? Esta ação não pode ser desfeita.')) return;
  estado = estadoInicial();
  salvar();
  renderTudo();
});

// ---------- Perfil ----------

function renderPerguntas() {
  $('#form-perfil').innerHTML = PERGUNTAS.map((p) => `
    <fieldset class="pergunta">
      <legend>${p.texto}</legend>
      ${p.opcoes.map(([txt, pts], i) => `
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
  const pontos = PERGUNTAS.reduce((s, p) => s + p.opcoes[respostas[p.id]][1], 0);
  let perfil = pontos <= 7 ? 'conservador' : pontos <= 12 ? 'moderado' : 'arrojado';
  // Sem reserva de emergência, limita o perfil a moderado
  if (respostas.reserva === 0 && perfil === 'arrojado') perfil = 'moderado';
  estado.respostas = respostas;
  estado.perfil = perfil;
  estado.alvo = { ...PERFIS[perfil].alvo };
  salvar();
  renderPerfil();
  renderCarteira();
});

function renderPerfil() {
  if (estado.perfil) {
    const p = PERFIS[estado.perfil];
    const semReserva = estado.respostas.reserva === 0;
    $('#resultado-perfil').innerHTML = `
      <div class="perfil-badge">${p.nome}</div>
      <p>${p.desc}</p>
      ${semReserva ? '<div class="alerta">Você ainda não tem reserva de emergência. Antes de investir em renda variável, monte uma reserva de 6 meses de gastos em renda fixa pós-fixada com liquidez diária.</div>' : ''}`;
  } else {
    $('#resultado-perfil').innerHTML = '';
  }

  const alvo = estado.alvo || {};
  $('#form-alvo').innerHTML = CLASSES.map((c) => `
    <label>${c.nome}
      <input type="number" min="0" max="100" step="1" data-classe="${c.id}" value="${alvo[c.id] ?? ''}" ${estado.alvo ? '' : 'disabled'}>
    </label>`).join('');
  atualizarSoma();
}

$('#form-alvo').addEventListener('input', (e) => {
  const c = e.target.dataset.classe;
  if (!c) return;
  estado.alvo[c] = parseFloat(e.target.value) || 0;
  salvar();
  atualizarSoma();
});

function somaAlvo() {
  return estado.alvo ? Object.values(estado.alvo).reduce((s, v) => s + v, 0) : 0;
}

function atualizarSoma() {
  if (!estado.alvo) {
    $('#soma-alvo').textContent = 'Responda o questionário para definir sua alocação-alvo.';
    $('#soma-alvo').className = 'soma';
    return;
  }
  const s = somaAlvo();
  $('#soma-alvo').textContent = `Soma: ${pct(s, 0)}${Math.abs(s - 100) > 0.01 ? ' (ajuste para 100%)' : ''}`;
  $('#soma-alvo').className = `soma ${Math.abs(s - 100) > 0.01 ? 'neg' : 'pos'}`;
}

// ---------- Avaliação ----------

function avaliar() {
  const { porClasse, total, custo } = totais();
  const alvo = estado.alvo;
  const linhas = CLASSES.map((c) => {
    const atual = total ? (porClasse[c.id] / total) * 100 : 0;
    const meta = alvo ? alvo[c.id] || 0 : 0;
    return { c, valor: porClasse[c.id], atual, meta, desvio: atual - meta };
  });
  const desvioTotal = linhas.reduce((s, l) => s + Math.abs(l.desvio), 0) / 2;
  const nota = Math.max(0, Math.round(100 - desvioTotal));

  const alertas = [];
  const pontosFortes = [];

  for (const l of linhas) {
    if (l.desvio > 5) alertas.push(`<strong>${l.c.nome}</strong> está ${pct(l.desvio)} acima da meta (${pct(l.atual)} contra ${pct(l.meta, 0)}). Pare de aportar nessa classe por enquanto.`);
    else if (l.desvio < -5) alertas.push(`<strong>${l.c.nome}</strong> está ${pct(-l.desvio)} abaixo da meta (${pct(l.atual)} contra ${pct(l.meta, 0)}). Priorize essa classe nos próximos aportes.`);
  }

  for (const a of estado.ativos) {
    const c = classe(a.classe);
    const peso = total ? (valorAtivo(a) / total) * 100 : 0;
    if (c && !c.rendaFixa && peso > 15) {
      alertas.push(`<strong>${esc(a.nome)}</strong> representa ${pct(peso)} da carteira. Concentração alta em um único ativo de renda variável aumenta o risco.`);
    }
  }

  const acoes = estado.ativos.filter((a) => a.classe === 'acoes');
  const temEtfAcoes = acoes.some((a) => /11$/.test(a.nome));
  if (acoes.length > 0 && acoes.length < 5 && !temEtfAcoes) {
    alertas.push(`Você tem só ${acoes.length} ação(ões). Considere ter ao menos 5 a 10 empresas de setores diferentes, ou usar um ETF.`);
  }
  const fiis = estado.ativos.filter((a) => a.classe === 'fiis');
  if (fiis.length > 0 && fiis.length < 3) {
    alertas.push(`Você tem só ${fiis.length} FII(s). Diversificar entre 3 ou mais fundos e segmentos reduz o risco de vacância e inadimplência.`);
  }

  if (estado.perfil === 'conservador' && (porClasse.cripto || 0) > 0) {
    alertas.push('Seu perfil é conservador, mas a carteira tem cripto, que é um ativo de altíssima volatilidade.');
  }
  if (estado.respostas.reserva === 0) {
    alertas.push('Sem reserva de emergência: monte-a antes de aumentar a renda variável.');
  }

  if (nota >= 90) pontosFortes.push('Carteira bem alinhada ao seu perfil.');
  const classesComValor = linhas.filter((l) => l.valor > 0).length;
  if (classesComValor >= 4) pontosFortes.push(`Boa diversificação entre classes (${classesComValor} classes diferentes).`);
  if (custo > 0 && total > custo) pontosFortes.push(`Carteira com resultado positivo de ${pct(((total - custo) / custo) * 100, 2)}.`);

  return { linhas, nota, alertas, pontosFortes, total };
}

function textoNota(n) {
  if (n >= 90) return 'Excelente alinhamento';
  if (n >= 75) return 'Bom, com pequenos ajustes';
  if (n >= 55) return 'Precisa de rebalanceamento';
  return 'Muito desalinhada ao perfil';
}

function renderAvaliacao() {
  const alvo = $('#avaliacao-conteudo');
  if (!estado.perfil) {
    alvo.innerHTML = '<div class="card"><p>Primeiro responda o questionário na aba <strong>Perfil</strong>.</p></div>';
    return;
  }
  if (!estado.ativos.length) {
    alvo.innerHTML = '<div class="card"><p>Cadastre seus ativos na aba <strong>Carteira</strong> para ver a avaliação.</p></div>';
    return;
  }
  const { linhas, nota, alertas, pontosFortes } = avaliar();
  const escala = Math.max(100, ...linhas.map((l) => Math.max(l.atual, l.meta)));

  alvo.innerHTML = `
    <div class="card">
      <h2>Nota de aderência ao perfil ${PERFIS[estado.perfil].nome}</h2>
      <div class="nota">${nota}<small> / 100</small></div>
      <p>${textoNota(nota)}</p>
      <p class="dica">A nota mede quanto a carteira está próxima da sua alocação-alvo. ${100 - nota} pontos equivalem à fatia do patrimônio que estaria na classe errada.</p>
    </div>
    <div class="card">
      <h2>Atual x meta por classe</h2>
      <div class="barras">
        ${linhas.map((l) => `
          <div class="barra-linha">
            <div class="cab">
              <span>${l.c.nome}</span>
              <span class="num">${pct(l.atual)} <span style="color:var(--suave)">/ meta ${pct(l.meta, 0)}</span>
                <span class="${Math.abs(l.desvio) <= 5 ? 'ok' : 'neg'}"> (${l.desvio >= 0 ? '+' : ''}${pct(l.desvio)})</span></span>
            </div>
            <div class="trilho">
              <div class="preench" style="width:${(l.atual / escala) * 100}%;background:${l.c.cor}"></div>
              <div class="marca" style="left:${(l.meta / escala) * 100}%" title="Meta"></div>
            </div>
          </div>`).join('')}
      </div>
      <p class="dica">A barra mostra o percentual atual. O traço vertical marca a meta.</p>
    </div>
    <div class="card">
      <h2>Pontos de atenção</h2>
      ${alertas.length ? alertas.map((a) => `<div class="alerta">${a}</div>`).join('') : '<p class="ok">Nenhum ponto de atenção relevante.</p>'}
      ${pontosFortes.length ? `<h3>Pontos fortes</h3><ul>${pontosFortes.map((p) => `<li>${p}</li>`).join('')}</ul>` : ''}
    </div>`;
}

// ---------- Aporte ----------

function sugerirAporte(valor) {
  const { porClasse, total } = totais();
  const soma = somaAlvo();
  const novoTotal = total + valor;

  // Quanto falta em cada classe para atingir a meta após o aporte
  const deficits = CLASSES.map((c) => {
    const meta = ((estado.alvo[c.id] || 0) / soma) * novoTotal;
    return { c, falta: Math.max(0, meta - (porClasse[c.id] || 0)) };
  });
  const somaDef = deficits.reduce((s, d) => s + d.falta, 0);

  return deficits
    .map((d) => {
      const valorClasse = somaDef > 0 ? (d.falta / somaDef) * valor : 0;
      return { ...d, valor: valorClasse, ativos: distribuirNaClasse(d.c.id, valorClasse) };
    })
    .filter((d) => d.valor >= 0.01)
    .sort((a, b) => b.valor - a.valor);
}

// Dentro da classe, direciona o dinheiro para os ativos menores, buscando pesos iguais
function distribuirNaClasse(classeId, valor) {
  const ativos = estado.ativos.filter((a) => a.classe === classeId);
  if (!ativos.length || valor <= 0) return [];
  const atuais = ativos.map((a) => ({ a, v: valorAtivo(a), add: 0 }));
  const alvoIgual = (atuais.reduce((s, x) => s + x.v, 0) + valor) / atuais.length;
  const faltas = atuais.map((x) => Math.max(0, alvoIgual - x.v));
  const somaF = faltas.reduce((s, f) => s + f, 0);
  atuais.forEach((x, i) => { x.add = somaF > 0 ? (faltas[i] / somaF) * valor : valor / atuais.length; });
  return atuais.filter((x) => x.add >= 0.01).sort((p, q) => q.add - p.add);
}

$('#form-aporte').addEventListener('submit', (e) => {
  e.preventDefault();
  const saida = $('#resultado-aporte');
  if (!estado.alvo) {
    saida.innerHTML = '<div class="card"><p>Primeiro defina seu perfil na aba <strong>Perfil</strong>.</p></div>';
    return;
  }
  if (Math.abs(somaAlvo() - 100) > 0.01) {
    saida.innerHTML = '<div class="card"><p class="neg">A alocação-alvo precisa somar 100%. Ajuste na aba Perfil.</p></div>';
    return;
  }
  const valor = parseFloat($('#valor-aporte').value);
  if (!(valor > 0)) return;

  const sugestao = sugerirAporte(valor);
  const reservaAviso = estado.respostas.reserva !== undefined && estado.respostas.reserva < 2
    ? '<div class="alerta">Você ainda não completou a reserva de emergência. Considere direcionar o aporte para renda fixa pós-fixada com liquidez diária até completá-la.</div>' : '';

  saida.innerHTML = `
    <div class="card">
      <h2>Como dividir ${fmt(valor)}</h2>
      ${reservaAviso}
      <div class="tabela-wrap"><table>
        <thead><tr><th>Classe</th><th class="num">Valor</th><th class="num">% do aporte</th></tr></thead>
        <tbody>
          ${sugestao.map((s) => `<tr>
            <td><span style="color:${s.c.cor}">●</span> ${s.c.nome}</td>
            <td class="num">${fmt(s.valor)}</td>
            <td class="num">${pct((s.valor / valor) * 100)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>
    ${sugestao.map((s) => `
      <div class="card">
        <h3 style="margin-top:0"><span style="color:${s.c.cor}">●</span> ${s.c.nome}: ${fmt(s.valor)}</h3>
        ${s.ativos.length ? `
          <div class="tabela-wrap"><table>
            <thead><tr><th>Ativo</th><th class="num">Valor sugerido</th><th class="num">Preço atual</th><th class="num">Qtd aprox.</th></tr></thead>
            <tbody>
              ${s.ativos.map((x) => `<tr>
                <td>${esc(x.a.nome)}</td>
                <td class="num">${fmt(x.add)}</td>
                <td class="num">${fmt(x.a.pa)}</td>
                <td class="num">${s.c.rendaFixa ? '—' : num(Math.floor(x.add / (x.a.pa || x.a.pm)))}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>
          <p class="dica">Dentro da classe, o valor vai primeiro para os ativos com menor posição, para equilibrar os pesos.</p>`
          : `<p class="dica">Você ainda não tem ativos nesta classe. Opções comuns: ${s.c.exemplos}.</p>`}
      </div>`).join('')}`;
});

// ---------- Início ----------

function renderTudo() {
  renderCarteira();
  renderPerguntas();
  renderPerfil();
  renderAvaliacao();
  $('#resultado-aporte').innerHTML = '';
}

renderTudo();
