'use strict';

// Três carteiras: visão consolidada, objetivos de curto/médio prazo (carro, casamento...),
// ativos acima do % ideal (poda) e escudo fiscal (limite de R$ 20 mil/mês em vendas de ações).

const ISENCAO_ACOES = 20000;
const mesAtual = () => new Date().toISOString().slice(0, 7);
const mesesAte = (aaaamm) => {
  const [y, m] = aaaamm.split('-').map(Number);
  const h = new Date();
  return (y - h.getFullYear()) * 12 + (m - 1 - h.getMonth());
};
const mesBRCurto = (aaaamm) => { const [y, m] = aaaamm.split('-'); return `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][m - 1]}/${y}`; };

// Rendimento líquido mensal estimado da renda fixa pós (CDI ≈ Selic, IR de 15% para prazos longos)
const taxaLiquidaMes = () => Math.pow(1 + (cenario().selic / 100) * 0.85, 1 / 12) - 1;

// ---------- Objetivos ----------

function objetivos() {
  return (estado.objetivos || []).slice().sort((a, b) => a.data.localeCompare(b.data));
}

// Projeta os objetivos em sequência: o saldo da carteira de objetivos serve ao primeiro;
// o que sobrar depois da data dele passa para o seguinte
function projetarObjetivos() {
  const i = taxaLiquidaMes();
  let saldo = totais(ativosObjetivos()).total;
  let mesesPassados = 0;
  return objetivos().map((o) => {
    const n = Math.max(0, mesesAte(o.data) - mesesPassados);
    const fator = Math.pow(1 + i, n);
    const aporte = o.aporte || 0;
    const futuro = saldo * fator + (n ? aporte * ((fator - 1) / i) : 0);
    const necessario = n ? Math.max(0, ((o.valor - saldo * fator) * i) / (fator - 1)) : Math.max(0, o.valor - saldo);
    const r = { o, n, inicio: saldo, futuro, necessario, chega: futuro >= o.valor };
    saldo = Math.max(0, futuro - o.valor);
    mesesPassados += n;
    return r;
  });
}

function veiculoObjetivo(meses) {
  if (meses >= 10) return 'LCI/LCA pós-fixada (isenta de IR, mas com carência mínima de 9 meses) ou CDB/Tesouro Selic. Compare a taxa líquida.';
  if (meses >= 1) return 'CDB com liquidez diária (100% do CDI ou mais) ou Tesouro Selic. Faltam menos de 10 meses: LCI/LCA novas não vencem a tempo (carência de 9 meses).';
  return 'Prazo chegando: deixe tudo com liquidez diária.';
}

function aporteObjetivoAtual() {
  const p = projetarObjetivos().find((x) => x.n > 0);
  return p ? p.o.aporte || 0 : 0;
}

// ---------- Ativos acima do % ideal ----------

function aliquotaVenda(a) {
  if (a.classe === 'acoes' && !/11$/.test(a.nome)) return { ir: 0, nota: `isento se as vendas de ações do mês ficarem abaixo de ${fmt(ISENCAO_ACOES)}` };
  if (a.classe === 'fiis') return { ir: 0.2, nota: '20% sobre o lucro (DARF). Prefira rebalancear só com aportes e proventos' };
  if (classe(a.classe).rendaFixa) return { ir: 0.15, nota: 'IR regressivo: 15% se aplicado há mais de 2 anos (até 22,5% se menos)' };
  return { ir: 0.15, nota: '15% sobre o lucro' };
}

// Semáforo de poda (bandas 5/25 + trava do preço-teto), para cada ativo do longo prazo:
//  verde   = desvio de peso <= -15% e preço abaixo do teto (ações): prioridade de compra
//  amarelo = desvio >= +25% E preço > teto x 1,05 (ações), ou desvio >= +50% em qualquer caso: vender só o excesso
//  branco  = o resto (inclui quem subiu com os fundamentos, ainda abaixo do teto: congela aportes, não vende)
// Banda de outros ativos: renda fixa +20% (ex.: Renda+ acima de 30% da escada de 4), ETF/cripto 5/25 (5 p.p. ou 25%,
// o que for menor). FIIs nunca recebem sinal de venda por lucro (20% de IR): só congelam aportes.
const BANDA = { compra: -15, poda: 25, teto: 50, folgaTeto: 1.05, rf: 20 };

function sinalAtivo(a, meta = alvoAjustado()?.final, total = totais().total) {
  const ideal = idealAtivo(a, meta);
  if (!ideal || !total || a.travado) return null;
  const atual = (valorAtivo(a) / total) * 100;
  const desvio = ((atual - ideal) / ideal) * 100;
  const tipo = tipoAtivo(a);
  const v = tipo === 'acao' ? valuation(a) : null;
  const teto = v ? tetoMaior(v) : 0;
  const vsTeto = teto ? (preco(a) / teto - 1) * 100 : null;
  const excesso = ((atual - ideal) / 100) * total;
  const lucroFrac = preco(a) > 0 ? Math.max(0, (preco(a) - a.pm) / preco(a)) : 0;
  const { ir, nota } = aliquotaVenda(a);
  const base = { a, ideal, atual, desvio, teto, vsTeto, excesso, imposto: Math.max(0, excesso) * lucroFrac * ir, nota };
  let cor = 'branco', motivo = 'Dentro da faixa normal (-15% a +25% do ideal): não faça nada.';
  if (tipo === 'acao') {
    if (desvio >= BANDA.teto) { cor = 'amarelo'; motivo = `Passou de +${BANDA.teto}% do peso ideal: reduzir para controlar o risco, mesmo sendo boa.`; }
    else if (desvio >= BANDA.poda && teto && preco(a) > teto * BANDA.folgaTeto) { cor = 'amarelo'; motivo = `Peso ${f1(desvio)}% acima do ideal e preço ${f1(vsTeto)}% acima do preço-teto: vender só o excesso.`; }
    else if (desvio >= BANDA.poda) { motivo = `Peso ${f1(desvio)}% acima do ideal, mas ${teto ? 'ainda perto ou abaixo do preço-teto' : 'sem preço-teto calculado'}: subiu com os fundamentos. Não vender; congelar aportes.`; }
    else if (desvio <= BANDA.compra && (!teto || preco(a) < teto)) { cor = 'verde'; motivo = `Peso ${f1(-desvio)}% abaixo do ideal${teto ? ' e abaixo do preço-teto' : ''}: prioridade de compra.`; }
    else if (desvio <= BANDA.compra) { motivo = `Peso abaixo do ideal, mas acima do preço-teto: compra sem pressa.`; }
  } else if (tipo === 'fii') {
    if (desvio <= BANDA.compra) { cor = 'verde'; motivo = `Peso ${f1(-desvio)}% abaixo do ideal: prioridade para aportes e proventos.`; }
    else if (desvio >= BANDA.poda) { motivo = `Peso ${f1(desvio)}% acima do ideal: congelar aportes. Não vender (lucro em FII paga 20% de IR); o rebalanceamento vem dos outros FIIs.`; }
  } else {
    const limite = classe(a.classe).rendaFixa ? BANDA.rf : Math.min(BANDA.poda, (5 / ideal) * 100);
    if (desvio >= limite) { cor = 'amarelo'; motivo = classe(a.classe).rendaFixa ? `Peso ${f1(desvio)}% acima do ideal (mais de ${BANDA.rf}%): colher a marcação a mercado e voltar ao ideal.` : `Passou da banda 5/25 (${f1(atual - ideal)} p.p. acima): vender o excesso.`; }
    else if (desvio <= BANDA.compra) { cor = 'verde'; motivo = `Peso ${f1(-desvio)}% abaixo do ideal: prioridade de aporte.`; }
  }
  // Quanto vender para voltar ao % ideal
  let qtd = null;
  if (cor === 'amarelo' && excesso > 0) {
    qtd = TICKER_B3.test(a.nome) && preco(a) > 0 ? Math.floor(excesso / preco(a)) : null;
  }
  return { ...base, cor, motivo, qtd };
}

function semaforo() {
  const meta = alvoAjustado()?.final;
  const { total } = totais();
  if (!meta || !total) return [];
  return investidos().map((a) => sinalAtivo(a, meta, total)).filter(Boolean);
}

// Compatível com o quadro antigo: só os que pedem venda
function acimaDoIdeal() {
  return semaforo().filter((x) => x.cor === 'amarelo').sort((x, y) => y.excesso - x.excesso);
}

// ---------- Escudo fiscal ----------

function vendasDoMes(mes = mesAtual()) {
  return (estado.vendas || []).filter((v) => v.data.startsWith(mes));
}

function escudoFiscal() {
  const mes = vendasDoMes().filter((v) => v.tipo === 'acao');
  const vendido = mes.reduce((s, v) => s + v.valor, 0);
  const lucroMes = mes.reduce((s, v) => s + v.lucro, 0);
  const prejuizo = (estado.vendas || []).filter((v) => v.lucro < 0).reduce((s, v) => s - v.lucro, 0);
  return { vendido, livre: Math.max(0, ISENCAO_ACOES - vendido), lucroMes, prejuizo, n: mes.length };
}

// ---------- Telas ----------

function cardCaixas() {
  const lp = totais().total, ob = totais(ativosObjetivos()).total, rs = totais(reservas()).total;
  if (!ob && !rs && !(estado.objetivos || []).length) return '';
  const proj = projetarObjetivos();
  const metaReserva = estado.metaReserva || 0;
  return `<div class="card">
    <h2>Suas 3 carteiras</h2>
    <div class="resumo">
      <div class="kpi"><div class="rotulo">Longo prazo</div><div class="valor">${fmt(lp)}</div><div class="motivo">entra na alocação e no plano</div></div>
      <div class="kpi"><div class="rotulo">Objetivos</div><div class="valor">${fmt(ob)}</div><div class="motivo">${proj[0] ? `próximo: ${esc(proj[0].o.nome)}` : 'cadastre um objetivo'}</div></div>
      <div class="kpi"><div class="rotulo">Reserva</div><div class="valor">${fmt(rs)}</div><div class="motivo">${metaReserva ? `${pct(Math.min(100, (rs / metaReserva) * 100))} de ${fmt(metaReserva)}` : 'fora da alocação'}</div></div>
      <div class="kpi"><div class="rotulo">Patrimônio total</div><div class="valor">${fmt(lp + ob + rs)}</div></div>
    </div>
    ${proj.map((p) => {
      const prog = Math.min(100, (p.inicio / p.o.valor) * 100);
      return `<div class="barra-linha" style="margin-top:12px">
        <div class="cab"><span><strong>${esc(p.o.nome)}</strong> · ${fmt(p.o.valor)} em ${mesBRCurto(p.o.data)}</span><span class="num">${p.n} meses</span></div>
        <div class="trilho"><div class="preench" style="width:${prog}%;background:var(--serie-1)"></div></div>
        <p class="dica" style="margin-top:4px">${p.chega ? `<span class="ok">No caminho:</span> aportando ${fmt(p.o.aporte || 0)}/mês, chega a ~${fmt(p.futuro)}.`
          : `<span class="neg">Faltaria ~${fmt(p.o.valor - p.futuro)}.</span> Para chegar, aporte ~${fmt(p.necessario)}/mês (hoje: ${fmt(p.o.aporte || 0)}).`}
          Onde aplicar: ${veiculoObjetivo(p.n)}</p>
      </div>`;
    }).join('')}
    <p class="dica">Rendimento estimado de ${pct(taxaLiquidaMes() * 100, 2)} ao mês líquido (Selic de ${f2(cenario().selic)}% com IR de 15%). Edite os objetivos na aba Carteira.</p>
  </div>`;
}

const ICONE_SINAL = { verde: '🟢', branco: '⚪', amarelo: '🟡' };

function cardPoda() {
  const lista = semaforo();
  if (!lista.length) return '';
  const vender = lista.filter((x) => x.cor === 'amarelo').sort((x, y) => y.excesso - x.excesso);
  const comprar = lista.filter((x) => x.cor === 'verde').sort((x, y) => x.desvio - y.desvio);
  const ef = escudoFiscal();
  const vendaAcoes = vender.filter((x) => tipoAtivo(x.a) === 'acao').reduce((s, x) => s + (x.qtd ? x.qtd * preco(x.a) : 0), 0);
  // Classes inteiras: regra de +5 p.p. absolutos
  const dg = diagnosticar(5);
  const classes = dg.linhas.filter((l) => l.meta > 0 && l.atual - l.meta >= 5);
  return `<div class="card">
    <h2>Quando vender (bandas 5/25 + preço-teto)</h2>
    ${vender.length ? `<h3>🟡 Vender o excesso</h3><div class="tabela-wrap"><table>
      <thead><tr><th>Ativo</th><th class="num">Hoje / ideal</th><th class="num">Desvio</th><th class="num">Vender</th><th>Por quê</th></tr></thead>
      <tbody>${vender.map((x) => `<tr>
        <td><strong>${esc(x.a.nome)}</strong></td>
        <td class="num">${pct(x.atual, 2)}<br><span class="motivo">${pct(x.ideal, 2)}</span></td>
        <td class="num neg">+${f1(x.desvio)}%</td>
        <td class="num">${x.qtd != null ? `<strong>${x.qtd}</strong> un.<br><span class="motivo">${fmt(x.qtd * preco(x.a))}</span>` : `<strong>${fmt(x.excesso)}</strong>`}</td>
        <td class="motivo">${esc(x.motivo)}${x.imposto >= 1 ? ` IR estimado ~${fmt(x.imposto)}.` : ''}</td></tr>`).join('')}</tbody>
    </table></div>
    ${vendaAcoes ? `<p class="${vendaAcoes > ef.livre ? 'alerta' : 'dica'}">Vendas de ações sugeridas: ${fmt(vendaAcoes)}. Limite isento livre no mês: ${fmt(ef.livre)}.${vendaAcoes > ef.livre ? ' Divida entre dois meses para não pagar IR.' : ' Fica isento.'}</p>` : ''}
    <p class="dica">Venda só o excesso, para voltar ao % ideal, e use o dinheiro na compra mais atrasada (🟢). Nunca zere uma ação por ter subido; zerar só se a empresa piorar.</p>`
    : '<p class="ok" style="margin-top:0">Nenhum ativo no ponto de venda. Ações só são vendidas com peso 25% acima do ideal e preço acima do preço-teto (ou 50% acima do ideal em qualquer caso).</p>'}
    ${classes.length ? `<p class="alerta">Classe inteira fora da banda (+5 p.p.): ${classes.map((l) => `${l.c.nome} ${pct(l.atual)} contra ${pct(l.meta)}`).join('; ')}.</p>` : ''}
    ${comprar.length ? `<h3>🟢 Prioridade de compra</h3><p style="margin:0">${comprar.map((x) => `<strong>${esc(x.a.nome)}</strong> (${f1(x.desvio)}%)`).join(' · ')}</p>` : ''}
    <details style="margin-top:10px"><summary class="dica">Semáforo de todos os ativos</summary>
      <div class="tabela-wrap"><table>
        <thead><tr><th></th><th>Ativo</th><th class="num">Desvio do ideal</th><th class="num">vs. preço-teto</th><th>Leitura</th></tr></thead>
        <tbody>${lista.sort((x, y) => y.desvio - x.desvio).map((x) => `<tr><td>${ICONE_SINAL[x.cor]}</td><td>${esc(x.a.nome)}</td>
          <td class="num ${x.desvio >= 25 ? 'neg' : x.desvio <= -15 ? 'pos' : ''}">${x.desvio > 0 ? '+' : ''}${f1(x.desvio)}%</td>
          <td class="num">${x.vsTeto != null ? `${x.vsTeto > 0 ? '+' : ''}${f1(x.vsTeto)}%` : '—'}</td>
          <td class="motivo">${esc(x.motivo)}</td></tr>`).join('')}</tbody>
      </table></div>
    </details>
  </div>`;
}

function renderGestaoObjetivos() {
  const el = $('#objetivos-conteudo');
  if (!el) return;
  const ef = escudoFiscal();
  el.innerHTML = `
  <div class="card">
    <h2>Objetivos de curto e médio prazo</h2>
    <p class="dica" style="margin-top:0">Marque na lista de ativos, em "Carteira", os títulos que guardam esse dinheiro como <strong>Objetivos</strong>. Eles ficam fora da alocação de longo prazo.</p>
    ${objetivos().length ? `<div class="tabela-wrap"><table>
      <thead><tr><th>Objetivo</th><th class="num">Valor</th><th>Quando</th><th class="num">Aporte/mês</th><th></th></tr></thead>
      <tbody>${objetivos().map((o) => `<tr><td>${esc(o.nome)}</td><td class="num">${fmt(o.valor)}</td><td>${mesBRCurto(o.data)}</td><td class="num">${fmt(o.aporte || 0)}</td>
        <td><button class="btn perigo mini" type="button" data-remover-obj="${esc(o.id)}">Remover</button></td></tr>`).join('')}</tbody>
    </table></div>` : ''}
    <form id="form-objetivo" class="grade-form">
      <label>Objetivo<input id="obj-nome" required placeholder="Ex.: carro à vista"></label>
      <label>Valor (R$)<input id="obj-valor" type="number" min="0" step="100" required></label>
      <label>Mês e ano<input id="obj-data" type="month" required></label>
      <label>Aporte mensal (R$)<input id="obj-aporte" type="number" min="0" step="50"></label>
      <div class="acoes-form"><button class="btn" type="submit">Adicionar</button></div>
    </form>
    <form id="form-meta-reserva" class="grade-form" style="margin-top:12px">
      <label>Meta da reserva de emergência (R$)<input id="meta-reserva" type="number" min="0" step="500" value="${estado.metaReserva || ''}"></label>
      <div class="acoes-form"><button class="btn sec" type="submit">Salvar</button></div>
    </form>
  </div>

  <div class="card">
    <h2>Vendas de ações neste mês (isenção de ${fmt(ISENCAO_ACOES)})</h2>
    <div class="barra-linha">
      <div class="cab"><span>${fmt(ef.vendido)} vendidos em ${mesBRCurto(mesAtual())}</span><span class="num">livre: ${fmt(ef.livre)}</span></div>
      <div class="trilho"><div class="preench" style="width:${Math.min(100, (ef.vendido / ISENCAO_ACOES) * 100)}%;background:${ef.vendido > ISENCAO_ACOES ? 'var(--negativo)' : 'var(--serie-1)'}"></div></div>
    </div>
    <p class="dica">${ef.vendido > ISENCAO_ACOES ? '<span class="neg">Passou do limite: o lucro das vendas deste mês paga 15% de IR (DARF até o último dia útil do mês seguinte).</span>' : `${ef.lucroMes >= 0 ? `Lucro do mês: ${fmt(ef.lucroMes)} (isento)` : `Prejuízo do mês: ${fmt(-ef.lucroMes)}`}. `}Prejuízo registrado para compensar: ${fmt(ef.prejuizo)}. Vendas de FIIs com lucro pagam 20% sempre; ETFs e BDRs, 15% sem isenção.</p>
    <form id="form-venda" class="grade-form">
      <label>Ativo<input id="venda-ativo" required placeholder="Ex.: B3SA3"></label>
      <label>Valor vendido (R$)<input id="venda-valor" type="number" min="0" step="any" required></label>
      <label>Lucro ou prejuízo (R$)<input id="venda-lucro" type="number" step="any" placeholder="automático se vazio"></label>
      <div class="acoes-form"><button class="btn" type="submit">Registrar venda</button></div>
    </form>
    ${vendasDoMes().length ? `<ul class="limpa">${vendasDoMes().map((v) => `<li>${new Date(v.data).toLocaleDateString('pt-BR')}: ${esc(v.ativo)} · ${fmt(v.valor)} · ${v.lucro >= 0 ? 'lucro' : 'prejuízo'} ${fmt(Math.abs(v.lucro))} <button class="btn perigo mini" type="button" data-remover-venda="${esc(v.id)}">x</button></li>`).join('')}</ul>` : ''}
  </div>`;
}

document.addEventListener('submit', (e) => {
  if (e.target.id === 'form-objetivo') {
    e.preventDefault();
    estado.objetivos = [...(estado.objetivos || []), {
      id: String(Date.now()), nome: $('#obj-nome').value.trim(), valor: Number($('#obj-valor').value) || 0,
      data: $('#obj-data').value, aporte: Number($('#obj-aporte').value) || 0,
    }];
  } else if (e.target.id === 'form-meta-reserva') {
    e.preventDefault();
    estado.metaReserva = Number($('#meta-reserva').value) || 0;
  } else if (e.target.id === 'form-venda') {
    e.preventDefault();
    const nome = $('#venda-ativo').value.trim().toUpperCase();
    const valor = Number($('#venda-valor').value) || 0;
    const a = estado.ativos.find((x) => x.nome === nome);
    const informado = $('#venda-lucro').value;
    // Sem lucro informado, estima pelo preço médio cadastrado
    const lucro = informado !== '' ? Number(informado) : a && preco(a) > 0 ? valor * (1 - a.pm / preco(a)) : 0;
    const tipo = a ? (tipoAtivo(a) === 'acao' ? 'acao' : a.classe) : /^[A-Z]{4}\d$/.test(nome) ? 'acao' : 'outro';
    estado.vendas = [...(estado.vendas || []), { id: String(Date.now()), data: new Date().toISOString(), ativo: nome, valor, lucro: Math.round(lucro * 100) / 100, tipo }];
  } else return;
  salvar();
  renderGestaoObjetivos();
  if (estado.perfil) renderDiagnostico();
});

document.addEventListener('click', (e) => {
  const o = e.target.closest('[data-remover-obj]');
  const v = e.target.closest('[data-remover-venda]');
  if (!o && !v) return;
  if (o) estado.objetivos = (estado.objetivos || []).filter((x) => x.id !== o.dataset.removerObj);
  if (v) estado.vendas = (estado.vendas || []).filter((x) => x.id !== v.dataset.removerVenda);
  salvar();
  renderGestaoObjetivos();
  if (estado.perfil) renderDiagnostico();
});

renderGestaoObjetivos();
