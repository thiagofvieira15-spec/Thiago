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

function acimaDoIdeal() {
  const meta = alvoAjustado()?.final;
  const { total } = totais();
  if (!meta || !total) return [];
  return investidos().filter((a) => !a.travado).map((a) => {
    const ideal = idealAtivo(a, meta);
    const atual = (valorAtivo(a) / total) * 100;
    const excesso = ((atual - ideal) / 100) * total;
    const lucroFrac = preco(a) > 0 ? Math.max(0, (preco(a) - a.pm) / preco(a)) : 0;
    const { ir, nota } = aliquotaVenda(a);
    return { a, ideal, atual, excesso, imposto: excesso * lucroFrac * ir, nota };
  }).filter((x) => x.ideal > 0 && x.atual > x.ideal * 1.25 && x.atual - x.ideal >= 0.5)
    .sort((x, y) => y.excesso - x.excesso);
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

function cardPoda() {
  const lista = acimaDoIdeal();
  if (!lista.length) return '';
  return `<div class="card">
    <h2>Acima do % ideal</h2>
    <div class="tabela-wrap"><table>
      <thead><tr><th>Ativo</th><th class="num">Hoje</th><th class="num">Ideal</th><th class="num">Excesso</th><th>Imposto se vender</th></tr></thead>
      <tbody>${lista.map((x) => `<tr>
        <td><strong>${esc(x.a.nome)}</strong></td>
        <td class="num">${pct(x.atual, 2)}</td><td class="num">${pct(x.ideal, 2)}</td>
        <td class="num">${fmt(x.excesso)}</td>
        <td class="motivo">${x.imposto >= 1 ? `~${fmt(x.imposto)} (${esc(x.nota)})` : esc(x.nota)}</td></tr>`).join('')}</tbody>
    </table></div>
    <p class="dica">Mais de 25% acima do % ideal. Primeiro pare de aportar nesses ativos; venda só se o excesso for grande ou se fizer parte do plano (ex.: colher a marcação a mercado de um título IPCA+ longo e mandar o líquido para os objetivos).</p>
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
