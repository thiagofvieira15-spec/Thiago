'use strict';

const reais0 = (v) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;

// Metas e projeção: quanto a carteira pode valer no prazo do objetivo, em cenários
// pessimista, mediano e otimista (simulação com retornos aleatórios, em reais de hoje).

// Retorno real esperado (acima da inflação, % a.a.) e oscilação anual de cada classe.
// Premissas conservadoras de longo prazo, não previsões.
function premissasClasses() {
  const cx = cenario();
  return {
    rf_pos: { ret: 4.5, vol: 1 },
    rf_ipca: { ret: Math.min(cx.taxaIpcaLongo || 6, 6), vol: 3 },
    rf_pre: { ret: 5, vol: 3 },
    acoes: { ret: 6, vol: 24 },
    fiis: { ret: 5, vol: 14 },
    inter: { ret: 5.5, vol: 17 },
    cripto: { ret: 5, vol: 70 },
  };
}

function aleatorio(semente) {
  let s = semente >>> 0;
  const u = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return () => Math.sqrt(-2 * Math.log(u() || 1e-12)) * Math.cos(2 * Math.PI * u());
}

function parametrosCarteira() {
  const p = premissasClasses();
  const alvo = estado.alvo || {};
  const soma = CLASSES.reduce((s, c) => s + (alvo[c.id] || 0), 0) || 1;
  const w = CLASSES.map((c) => ({ id: c.id, w: (alvo[c.id] || 0) / soma, ...p[c.id] }));
  const ret = w.reduce((s, x) => s + x.w * x.ret, 0);
  // Correlação de 0,5 entre as classes de risco; renda fixa independente
  let varA = 0;
  const risco = (id) => !classe(id).rendaFixa;
  for (const a of w) for (const b of w) {
    const rho = a.id === b.id ? 1 : risco(a.id) && risco(b.id) ? 0.5 : 0;
    varA += a.w * b.w * (a.vol / 100) * (b.vol / 100) * rho;
  }
  return { ret, vol: Math.sqrt(varA) * 100 };
}

// "2028: 5000; 2030: 4000" -> [{ano, valor}] em ordem
function lerFases(txt) {
  return String(txt || '').split(/[;\n]+/).map((p) => p.match(/(\d{4})\s*[:=]\s*(-?[\d.,]+)/)).filter(Boolean)
    .map((m) => ({ ano: +m[1], valor: Number(m[2].replace(/\./g, '').replace(',', '.')) })).sort((a, b) => a.ano - b.ano);
}

// Aporte de cada mês da simulação: o valor base, trocado pelas fases da carreira (ex.: promoções)
function aportesPorMes(base, meses, fases) {
  const ano0 = new Date().getFullYear(), mes0 = new Date().getMonth();
  return Array.from({ length: meses }, (_, i) => {
    const ano = ano0 + Math.floor((mes0 + i + 1) / 12);
    let v = base;
    for (const f of fases) if (ano >= f.ano) v = f.valor;
    return v;
  });
}

function simular(inicial, aporte, anos, caminhos = 1500) {
  const { ret, vol } = parametrosCarteira();
  const s = vol / 100 / Math.sqrt(12);
  const m = Math.log(1 + ret / 100) / 12 - (s * s) / 2;
  const meses = Math.round(anos * 12);
  const m0 = estado.meta || {};
  // aporte pode ser um número (extra sobre o cronograma) ou o cronograma completo
  // Com fases de renda cadastradas, o aporte de cada mês sai delas; senão, do aporte de hoje + mudanças por ano
  const cron = (typeof cronogramaFases === 'function' && cronogramaFases(meses)) || aportesPorMes(m0.aporte || 0, meses, lerFases(m0.fases));
  const ano0 = new Date().getFullYear(), mes0 = new Date().getMonth();
  const retiradas = lerFases(m0.retiradas);
  const saidaNoMes = Array.from({ length: meses }, (_, i) => {
    const ano = ano0 + Math.floor((mes0 + i + 1) / 12), mes = (mes0 + i + 1) % 12;
    return mes === 0 ? retiradas.filter((r) => r.ano === ano).reduce((t, r) => t + r.valor, 0) : 0;
  });
  const z = aleatorio(42);
  const porAno = Array.from({ length: Math.ceil(anos) + 1 }, () => []);
  const finais = [];
  for (let c = 0; c < caminhos; c++) {
    let v = inicial;
    porAno[0].push(v);
    for (let i = 1; i <= meses; i++) {
      v = Math.max(0, v * Math.exp(m + s * z()) + cron[i - 1] + aporte - saidaNoMes[i - 1]);
      if (i % 12 === 0) porAno[i / 12].push(v);
    }
    if (meses % 12) porAno[porAno.length - 1].push(v);
    finais.push(v);
  }
  const q = (arr, p) => { const o = arr.slice().sort((a, b) => a - b); return o[Math.min(o.length - 1, Math.floor(p * o.length))]; };
  return { ret, vol, finais, q, aplicado: inicial + cron.reduce((t, x) => t + x + aporte, 0), curva: porAno.map((v, i) => ({ ano: i, p10: q(v, 0.1), p50: q(v, 0.5), p90: q(v, 0.9) })) };
}

function aporteNecessario(inicial, meta, anos, chance) {
  let lo = 0, hi = Math.max(meta / (anos * 12), 100);
  // Sem fases, procura o aporte mensal total; com fases da carreira, o extra sobre o cronograma
  const semFases = !lerFases(estado.meta?.fases).length && !(typeof fasesRenda === 'function' && fasesRenda().length);
  const salvo = estado.meta?.aporte;
  const ok = (ap) => {
    if (semFases && estado.meta) estado.meta.aporte = 0;
    const r = simular(inicial, ap, anos, 400);
    if (semFases && estado.meta) estado.meta.aporte = salvo;
    return r.finais.filter((v) => v >= meta).length / r.finais.length >= chance;
  };
  if (ok(0)) return 0;
  while (!ok(hi) && hi < 1e7) hi *= 2;
  for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; }
  return hi;
}

function renderMetas() {
  const el = $('#metas-conteudo');
  if (!el) return;
  const m = estado.meta || {};
  const { total } = totais();
  let resultado = '';
  if (m.valor > 0 && m.anos > 0 && total > 0) {
    const r = simular(total, 0, m.anos);
    const chance = (r.finais.filter((v) => v >= m.valor).length / r.finais.length) * 100;
    const fim = r.curva[r.curva.length - 1];
    const ap50 = aporteNecessario(total, m.valor, m.anos, 0.5);
    const ap80 = aporteNecessario(total, m.valor, m.anos, 0.8);
    const investido = r.aplicado;
    resultado = `
      <div class="resumo">
        <div class="kpi"><div class="rotulo">Chance de chegar lá</div><div class="valor ${chance >= 70 ? 'pos' : chance < 40 ? 'neg' : ''}">${f1(chance)}%</div><div class="motivo">${chance >= 80 ? 'no caminho certo' : chance >= 50 ? 'possível, mas sem folga' : 'precisa de ajuste'}</div></div>
        <div class="kpi"><div class="rotulo">Cenário mediano em ${m.anos} anos</div><div class="valor">${reais0(fim.p50)}</div><div class="motivo">você terá aplicado ${reais0(investido)}</div></div>
        ${(() => { const cron = lerFases(m.fases).length || (typeof fasesRenda === 'function' && fasesRenda().length); return `<div class="kpi"><div class="rotulo">${cron ? 'Aporte extra para 80% de chance' : 'Aporte para 80% de chance'}</div><div class="valor">${reais0(ap80)}</div><div class="motivo">por mês${cron ? ', além do cronograma' : ''} · para 50%: ${reais0(ap50)}</div></div>`; })()}
      </div>
      <div class="viz-caixa" id="metas-grafico"></div>
      <div class="viz-legenda"><span><span class="viz-amostra" style="background:var(--serie-1)"></span>Mediano</span><span><span class="viz-amostra" style="background:var(--serie-2)"></span>Pessimista (1 em 10 fica abaixo)</span></div>
      <div class="tabela-wrap"><table>
        <thead><tr><th>Em</th><th class="num">Pessimista</th><th class="num">Mediano</th><th class="num">Otimista</th></tr></thead>
        <tbody>${r.curva.filter((x, i, arr) => i && (i % Math.max(1, Math.round(arr.length / 6)) === 0 || i === arr.length - 1)).map((x) => `<tr><td>${x.ano} ano(s)</td><td class="num">${moedaCurta(x.p10)}</td><td class="num">${moedaCurta(x.p50)}</td><td class="num">${moedaCurta(x.p90)}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="dica">Valores em reais de hoje (já descontada a inflação), com a sua alocação-base, os aportes corrigidos pela inflação e as mudanças de aporte e retiradas que você informou. Premissas acima da inflação: renda fixa pós 4,5% a.a., IPCA+ ${f1(premissasClasses().rf_ipca.ret)}%, ações 6%, FIIs 5%, internacional 5,5%, cripto 5% (muito incerta). Carteira: ${f1(r.ret)}% a.a. esperado, oscilação de ${f1(r.vol)}% a.a. São premissas, não promessas.</p>`;
    setTimeout(() => {
      const caixa = $('#metas-grafico');
      if (!caixa || typeof graficoLinhas !== 'function') return;
      const hoje = new Date();
      const pontos = r.curva.map((x) => { const d = new Date(hoje); d.setFullYear(hoje.getFullYear() + x.ano); return { d: d.toISOString().slice(0, 10), p50: x.p50, p10: x.p10 }; });
      graficoLinhas(caixa, pontos, [{ k: 'p50', rotulo: 'Mediano', cor: '--serie-1' }, { k: 'p10', rotulo: 'Pessimista', cor: '--serie-2' }]);
    });
  }
  el.innerHTML = `<div class="card">
    <h2>Metas e projeção</h2>
    <form id="form-meta" class="grade-form">
      <label>Objetivo<input id="meta-nome" type="text" placeholder="Ex.: aposentadoria" value="${esc(m.nome || '')}"></label>
      <label>Quanto quer ter (R$ de hoje)<input id="meta-valor" type="number" min="0" step="1000" value="${m.valor || ''}" required></label>
      <label>Em quantos anos<input id="meta-anos" type="number" min="1" max="60" step="1" value="${m.anos || ''}" required></label>
      <label>Aporte mensal hoje (R$)<input id="meta-aporte" type="number" min="0" step="50" value="${m.aporte ?? ''}"></label>
      <label>Mudanças no aporte (opcional)<input id="meta-fases" type="text" placeholder="Ex.: 2028: 5000; 2030: 4000" value="${esc(m.fases || '')}"></label>
      <label>Retiradas planejadas (opcional)<input id="meta-retiradas" type="text" placeholder="Ex.: 2035: 600000" value="${esc(m.retiradas || '')}"></label>
      <div class="acoes-form"><button class="btn" type="submit">Projetar</button></div>
    </form>
    ${resultado || (total ? '<p class="dica">Informe o valor e o prazo do seu objetivo para ver a projeção.</p>' : '<p class="dica">Cadastre a carteira primeiro.</p>')}
  </div>`;
}

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'form-meta') return;
  e.preventDefault();
  estado.meta = {
    nome: $('#meta-nome').value.trim(),
    valor: Number($('#meta-valor').value) || 0,
    anos: Number($('#meta-anos').value) || 0,
    aporte: Number($('#meta-aporte').value) || 0,
    fases: $('#meta-fases').value.trim(),
    retiradas: $('#meta-retiradas').value.trim(),
  };
  salvar();
  renderMetas();
});

renderMetas();
