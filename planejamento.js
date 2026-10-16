'use strict';

// Cronograma (próximos 12 meses e anos seguintes) e Estratégia (divisão das carteiras, regras e motivos).
// Tudo vem do que está salvo no navegador: objetivos, metas, fases de aporte, marcos e lembretes.

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const somaMes = (aaaamm, n) => { let [y, m] = aaaamm.split('-').map(Number); m += n; y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1; return `${y}-${String(m).padStart(2, '0')}`; };

// Vencimentos lidos do nome dos títulos (ex.: "Tesouro IPCA+ 2032", "CDB ... vence 15/09/2032")
function vencimentos() {
  const out = [];
  for (const a of estado.ativos) {
    if (!classe(a.classe).rendaFixa) continue;
    const d = a.nome.match(/(\d{2})\/(\d{2})\/(20\d{2})/);
    const y = a.nome.match(/\b(20[3-9]\d)\b/);
    if (d) out.push({ mes: `${d[3]}-${d[2]}`, texto: `Vence ${a.nome.replace(/\s*\(.*\)/, '')} (${fmt(valorAtivo(a))} hoje)` });
    else if (y) out.push({ mes: `${y[1]}-${/Renda\+/.test(a.nome) ? '01' : '05'}`, texto: `${/Renda\+/.test(a.nome) ? 'Começam os pagamentos mensais do' : 'Vence o'} ${a.nome} (${fmt(valorAtivo(a))} hoje)` });
  }
  return out;
}

// Eventos de um mês (AAAA-MM)
function eventosDoMes(mes) {
  const ev = [];
  for (const o of objetivos()) if (o.data === mes) ev.push({ tipo: 'comprar', texto: `Objetivo: ${o.nome} (${fmt(o.valor)})` });
  for (const v of vencimentos()) if (v.mes === mes) ev.push({ tipo: 'manter', texto: v.texto });
  for (const m of estado.marcos || []) if (m.data === mes) ev.push({ tipo: 'avaliar', texto: m.texto });
  for (const l of estado.lembretes || []) if (l.data.slice(0, 7) === mes && !l.feito) ev.push({ tipo: 'avaliar', texto: `${l.data.slice(8, 10)}/${l.data.slice(5, 7)}: ${l.texto}` });
  return ev;
}

// Aporte no longo prazo em um mês, conforme Metas e projeção (aporte de hoje + mudanças por ano)
function aporteLongoNoMes(mes) {
  if (typeof fasesRenda === 'function' && fasesRenda().length) return aporteLongoFase(mes);
  const m = estado.meta || {};
  let v = m.aporte || 0;
  const ano = +mes.slice(0, 4);
  for (const f of (typeof lerFases === 'function' ? lerFases(m.fases) : [])) if (ano >= f.ano) v = f.valor;
  return v;
}

// Aporte nos objetivos em um mês: o do objetivo que ainda não venceu (em ordem)
function aporteObjetivoNoMes(mes) {
  const o = objetivos().find((x) => x.data >= mes);
  return o ? { valor: o.aporte || 0, nome: o.nome } : { valor: 0, nome: '' };
}

function renderCronograma() {
  const el = $('#cronograma-conteudo');
  if (!el) return;
  const hoje = new Date().toISOString().slice(0, 7);
  const meses = Array.from({ length: 12 }, (_, i) => somaMes(hoje, i));
  const m = estado.meta || {};
  const temMeta = m.anos > 0;
  // Projeção mediana do longo prazo por ano (mesma simulação da aba Evolução)
  let curva = null;
  if (temMeta && typeof simular === 'function' && totais().total) curva = simular(totais().total, 0, m.anos, 400).curva;
  const anoHoje = new Date().getFullYear();
  const anos = [];
  const ultimoObj = objetivos().reduce((x, o) => Math.max(x, +o.data.slice(0, 4)), anoHoje);
  const fim = Math.max(anoHoje + (m.anos || 0), ultimoObj, ...(estado.marcos || []).map((x) => +x.data.slice(0, 4)), ...vencimentos().map((v) => +v.mes.slice(0, 4)), ...(typeof fasesRenda === 'function' ? fasesRenda().map((f) => +f.inicio.slice(0, 4)) : []));
  for (let y = anoHoje + 1; y <= fim; y++) {
    const ev = [];
    for (let k = 1; k <= 12; k++) ev.push(...eventosDoMes(`${y}-${String(k).padStart(2, '0')}`).map((e) => ({ ...e, mes: k })));
    for (const r of (typeof lerFases === 'function' ? lerFases(m.retiradas) : [])) if (r.ano === y) ev.push({ tipo: 'vender', texto: `Retirada planejada do longo prazo: ${fmt(r.valor)}`, mes: 1 });
    if (typeof fasesRenda === 'function' && fasesRenda().length) {
      for (const f of fasesRenda().filter((x) => +x.inicio.slice(0, 4) === y).reverse()) {
        ev.unshift({ tipo: 'comprar', texto: `${f.nome ? `${f.nome}: ` : ''}salário ${fmt(f.salario)}${f.aluguel ? `, aluguel ${fmt(f.aluguel)}` : ''}; longo prazo passa a ${fmt(aporteLongoFase(f.inicio))}/mês`, mes: +f.inicio.slice(5) });
      }
    } else {
      const mudou = (typeof lerFases === 'function' ? lerFases(m.fases) : []).find((f) => f.ano === y);
      if (mudou) ev.unshift({ tipo: 'comprar', texto: `Aporte no longo prazo passa a ${fmt(mudou.valor)}/mês`, mes: 1 });
    }
    const proj = curva?.[y - anoHoje];
    // Anos sem evento só aparecem de 5 em 5 (e o último), para acompanhar o patrimônio
    if (ev.length || (proj && ((y - anoHoje) % 5 === 0 || y === fim))) anos.push({ y, ev, proj });
  }
  el.innerHTML = `
  <div class="card">
    <h2>Próximos 12 meses</h2>
    <div class="tabela-wrap"><table>
      <thead><tr><th>Mês</th><th class="num">Objetivos</th><th class="num">Longo prazo</th><th>O que acontece</th></tr></thead>
      <tbody>${meses.map((mes) => {
        const ob = aporteObjetivoNoMes(mes);
        const ev = eventosDoMes(mes);
        return `<tr><td><strong>${MESES_CURTOS[+mes.slice(5) - 1]}/${mes.slice(2, 4)}</strong></td>
          <td class="num">${ob.valor ? `${fmt(ob.valor)}<br><span class="motivo">${esc(ob.nome)}</span>` : '—'}</td>
          <td class="num">${aporteLongoNoMes(mes) ? fmt(aporteLongoNoMes(mes)) : '—'}</td>
          <td class="motivo">${ev.map((e) => `<div><span class="tag ${e.tipo}" style="font-size:0.65rem">•</span> ${esc(e.texto)}</div>`).join('') || ''}</td></tr>`;
      }).join('')}</tbody>
    </table></div>
    <p class="dica">Objetivos vêm de Carteira → Objetivos; o aporte do longo prazo, de Evolução → Renda e despesas por fase (ou do aporte de Metas e projeção). Os proventos são reinvestidos à parte.</p>
  </div>

  <div class="card">
    <h2>Próximos anos</h2>
    ${anos.length ? `<div class="linha-tempo">${anos.map((a) => `
      <div class="marco-ano">
        <div class="ano">${a.y}${a.proj ? `<span class="motivo">longo prazo ~${moedaCurta(a.proj.p50)}</span>` : ''}</div>
        <ul class="limpa">${a.ev.map((e) => `<li>${a.ev.length > 1 || e.mes !== 1 ? `<span class="motivo">${MESES_CURTOS[e.mes - 1]}</span> ` : ''}${esc(e.texto)}</li>`).join('') || '<li class="motivo">Aportes seguem o plano.</li>'}</ul>
      </div>`).join('')}</div>` : '<p class="dica" style="margin-top:0">Cadastre objetivos, marcos ou a meta de longo prazo para montar a linha do tempo.</p>'}
    ${curva ? '<p class="dica">Valor do longo prazo: cenário mediano da simulação, em reais de hoje (descontada a inflação).</p>' : ''}
  </div>

  <div class="card">
    <h2>Marcos da sua vida</h2>
    ${(estado.marcos || []).length ? `<ul class="pontos">${estado.marcos.slice().sort((a, b) => a.data.localeCompare(b.data)).map((x) => `
      <li><span><strong>${MESES_CURTOS[+x.data.slice(5) - 1]}/${x.data.slice(0, 4)}</strong> ${esc(x.texto)}</span>
      <button class="btn perigo mini" type="button" data-remover-marco="${esc(x.id)}">x</button></li>`).join('')}</ul>` : ''}
    <form id="form-marco" class="grade-form">
      <label>Mês e ano<input id="marco-data" type="month" required></label>
      <label>Marco<input id="marco-texto" required placeholder="Ex.: promoção, casamento, mudança"></label>
      <div class="acoes-form"><button class="btn" type="submit">Adicionar</button></div>
    </form>
  </div>`;
}

// ---------- Estratégia ----------

const MOTIVO_PADRAO = {
  rf_pos: 'Liquidez e baixa oscilação.',
  rf_ipca: 'Protege da inflação e trava juro real; levar até o vencimento.',
  rf_pre: 'Trava uma taxa fixa; ganha quando os juros caem.',
  acoes: 'Crescimento de longo prazo e dividendos de empresas brasileiras.',
  fiis: 'Renda mensal isenta de IR com imóveis e crédito imobiliário.',
  inter: 'Diversifica fora do Brasil e protege em dólar.',
  cripto: 'Aposta pequena e assimétrica; muito volátil.',
};

function blocoEditavel(chave, texto, rotulo = 'Editar') {
  return `<div class="texto-motivo">${esc(texto).replace(/\n/g, '<br>')}</div>
    <details class="editar-motivo"><summary class="dica">${rotulo}</summary>
      <textarea rows="4" data-motivo="${esc(chave)}">${esc(texto)}</textarea>
      <button class="btn sec mini" type="button" data-salvar-motivo="${esc(chave)}">Salvar</button>
    </details>`;
}

function renderEstrategia() {
  const el = $('#estrategia-conteudo');
  if (!el) return;
  const mot = estado.motivos || {};
  const meta = alvoAjustado()?.final;
  const { total, porClasse } = totais();
  const ob = totais(ativosObjetivos()).total, rs = totais(reservas()).total;
  const geral = lp => lp + ob + rs;
  el.innerHTML = `
  <div class="card">
    <h2>Princípios</h2>
    ${blocoEditavel('principios', mot.principios || 'Metas fixas por classe; rebalancear pelos aportes, comprando o que está mais abaixo do % ideal; vender só o que passou muito da meta ou piorou de fundamentos; não apostar em eleição ou notícia.')}
  </div>

  <div class="card">
    <h2>Divisão do patrimônio (${fmt(geral(total))})</h2>
    <div class="barra-empilhada">
      <span style="width:${(rs / geral(total)) * 100}%;background:var(--serie-2)" title="Reserva"></span>
      <span style="width:${(ob / geral(total)) * 100}%;background:var(--alerta)" title="Objetivos"></span>
      <span style="width:${(total / geral(total)) * 100}%;background:var(--serie-1)" title="Longo prazo"></span>
    </div>
    <div class="viz-legenda"><span><span class="viz-amostra" style="background:var(--serie-2)"></span>Reserva ${pct((rs / geral(total)) * 100)}</span><span><span class="viz-amostra" style="background:var(--alerta)"></span>Objetivos ${pct((ob / geral(total)) * 100)}</span><span><span class="viz-amostra" style="background:var(--serie-1)"></span>Longo prazo ${pct((total / geral(total)) * 100)}</span></div>
    <h3>1. Reserva de emergência · ${fmt(rs)}${estado.metaReserva ? ` <span class="motivo">meta ${fmt(estado.metaReserva)}</span>` : ''}</h3>
    ${blocoEditavel('reserva', mot.reserva || 'Imprevistos. Fica em renda fixa com liquidez diária e fora da alocação.')}
    <h3>2. Objetivos · ${fmt(ob)}</h3>
    ${objetivos().length ? `<ul class="limpa">${objetivos().map((o) => `<li><strong>${esc(o.nome)}</strong>: ${fmt(o.valor)} em ${mesBRCurto(o.data)} (${fmt(o.aporte || 0)}/mês)</li>`).join('')}</ul>` : ''}
    ${blocoEditavel('objetivos', mot.objetivos || 'Dinheiro com data marcada: renda fixa pós-fixada, sem risco de bolsa.')}
    <h3>3. Longo prazo · ${fmt(total)}</h3>
    ${blocoEditavel('longo', mot.longo || 'Patrimônio para décadas: diversificado entre classes, rebalanceado pelos aportes.')}
  </div>

  ${CLASSES.filter((c) => (meta?.[c.id] || 0) > 0 || porClasse[c.id] > 0).map((c) => {
    const ativos = investidos().filter((a) => a.classe === c.id).sort((a, b) => pesoAtivo(b) - pesoAtivo(a) || valorAtivo(b) - valorAtivo(a));
    const atual = total ? (porClasse[c.id] / total) * 100 : 0;
    const somaP = ativos.reduce((s, a) => s + pesoAtivo(a), 0);
    return `<div class="card">
      <h2><span style="color:${c.cor}">●</span> ${c.nome}</h2>
      <p style="margin-top:0">Meta <strong>${pct(meta?.[c.id] || 0)}</strong> do longo prazo · hoje ${pct(atual)} (${fmt(porClasse[c.id])})</p>
      ${blocoEditavel(`classe_${c.id}`, mot[`classe_${c.id}`] || MOTIVO_PADRAO[c.id])}
      ${ativos.length ? `<div class="tabela-wrap"><table>
        <thead><tr><th>Ativo</th><th class="num">Peso</th><th class="num">Da classe</th><th class="num">% ideal</th><th class="num">Hoje</th></tr></thead>
        <tbody>${ativos.map((a) => {
          const hoje = total ? (valorAtivo(a) / total) * 100 : 0, ideal = idealAtivo(a, meta) || 0;
          return `<tr><td>${esc(a.nome)}${a.travado ? ' <span class="motivo">sem liquidez</span>' : ''}${typeof estiloDe === 'function' && tipoAtivo(a) === 'acao' ? `<br><span class="motivo">${estiloDe(fundAtivo(a))}${typeof ehEstatal === 'function' && ehEstatal(a.nome) ? ' · estatal' : ''}</span>` : tipoAtivo(a) === 'fii' && typeof tipoFII === 'function' ? `<br><span class="motivo">${tipoFII(a)}</span>` : ''}</td>
            <td class="num">${pesoAtivo(a)}</td><td class="num">${pct(somaP ? (pesoAtivo(a) / somaP) * 100 : 0)}</td>
            <td class="num">${pct(ideal, 2)}</td><td class="num ${hoje > ideal * 1.25 && ideal ? 'neg' : hoje < ideal * 0.75 ? 'pos' : ''}">${pct(hoje, 2)}</td></tr>`;
        }).join('')}</tbody></table></div>` : ''}
    </div>`;
  }).join('')}
  <p class="dica">Toque em "Editar" para escrever os motivos com as suas palavras. Pesos e metas se mudam em Carteira (peso de cada ativo) e Perfil (meta de cada classe).</p>`;
}

document.addEventListener('click', (e) => {
  const s = e.target.closest('[data-salvar-motivo]');
  const r = e.target.closest('[data-remover-marco]');
  if (s) {
    const k = s.dataset.salvarMotivo;
    const ta = document.querySelector(`textarea[data-motivo="${k}"]`);
    estado.motivos = { ...(estado.motivos || {}), [k]: ta.value.trim() };
    salvar();
    renderEstrategia();
  }
  if (r) {
    estado.marcos = (estado.marcos || []).filter((x) => x.id !== r.dataset.removerMarco);
    salvar();
    renderCronograma();
  }
});

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'form-marco') return;
  e.preventDefault();
  estado.marcos = [...(estado.marcos || []), { id: String(Date.now()), data: $('#marco-data').value, texto: $('#marco-texto').value.trim() }];
  salvar();
  renderCronograma();
});

function renderPlanejamento() {
  renderCronograma();
  renderEstrategia();
}
