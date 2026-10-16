'use strict';

// Renda e despesas por fase da vida: salário, aluguel e custo de vida (em reais de hoje).
// A sobra, menos o aporte dos objetivos daquele mês, vira o aporte no longo prazo usado na projeção e no cronograma.

const fasesRenda = () => (estado.fasesRenda || []).slice().sort((a, b) => a.inicio.localeCompare(b.inicio));
const somaMesRenda = (aaaamm, n) => { const [y, m] = aaaamm.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const mesSomado = (n) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 7); };

function faseNoMes(mes) {
  let f = null;
  for (const x of fasesRenda()) if (x.inicio <= mes) f = x;
  return f || fasesRenda()[0] || null;
}

function aporteObjetivosNoMes(mes) {
  const o = (typeof objetivos === 'function' ? objetivos() : []).find((x) => x.data >= mes);
  return o ? o.aporte || 0 : 0;
}

const sobraFase = (f) => Math.max(0, (f.salario || 0) - (f.aluguel || 0) - (f.custo || 0));

// Aporte no longo prazo num mês: sobra da fase menos o que vai para os objetivos
function aporteLongoFase(mes) {
  const f = faseNoMes(mes);
  return f ? Math.max(0, sobraFase(f) - aporteObjetivosNoMes(mes)) : 0;
}

// Cronograma mês a mês para a simulação (null quando não há fases cadastradas)
function cronogramaFases(meses) {
  if (!fasesRenda().length) return null;
  return Array.from({ length: meses }, (_, i) => aporteLongoFase(mesSomado(i + 1)));
}

function renderRenda() {
  const el = $('#renda-conteudo');
  if (!el) return;
  const fases = fasesRenda();
  const hoje = mesSomado(0);
  el.innerHTML = `<div class="card">
    <h2>Renda e despesas por fase</h2>
    <p class="dica" style="margin-top:0">Em reais de hoje (descontada a inflação). A sobra de cada fase, menos o aporte dos objetivos daquele mês, é o aporte no longo prazo usado na projeção acima e no Cronograma${fases.length ? ' (substitui o campo "Mudanças no aporte")' : ''}.</p>
    ${fases.length ? `<div class="tabela-wrap"><table>
      <thead><tr><th>Desde</th><th class="num">Salário</th><th class="num">Aluguel</th><th class="num">Custo de vida</th><th class="num">Sobra</th><th class="num">Objetivos</th><th class="num">Longo prazo</th><th></th></tr></thead>
      <tbody>${fases.map((f) => {
        const mes = f.inicio < hoje ? hoje : f.inicio;
        const ob = aporteObjetivosNoMes(mes), sobra = sobraFase(f);
        const taxa = f.salario ? (sobra / f.salario) * 100 : 0;
        return `<tr${faseNoMes(hoje) === f ? ' style="font-weight:600"' : ''}><td>${mesBRCurto(f.inicio)}<br><span class="motivo">${esc(f.nome || '')}</span></td>
          <td class="num">${fmt(f.salario || 0)}</td><td class="num">${f.aluguel ? fmt(f.aluguel) : '—'}</td><td class="num">${fmt(f.custo || 0)}</td>
          <td class="num">${fmt(sobra)}<br><span class="motivo">${pct(taxa)} da renda</span></td>
          <td class="num">${ob ? fmt(ob) : '—'}</td><td class="num"><strong>${fmt(Math.max(0, sobra - ob))}</strong>${(() => {
            // Se o objetivo termina durante a fase, mostra o aporte depois dele
            if (!ob) return '';
            const prox = fases[fases.indexOf(f) + 1];
            for (let k = 1; k < 120; k++) {
              const m2 = somaMesRenda(mes, k);
              if (prox && m2 >= prox.inicio) break;
              if (aporteObjetivosNoMes(m2) !== ob) return `<br><span class="motivo">${fmt(Math.max(0, sobra - aporteObjetivosNoMes(m2)))} a partir de ${mesBRCurto(m2)}</span>`;
            }
            return '';
          })()}</td>
          <td><button class="btn perigo mini" type="button" data-remover-fase="${esc(f.id)}">x</button></td></tr>`;
      }).join('')}</tbody>
    </table></div>
    <p class="dica">"Objetivos" é o aporte do objetivo em andamento no início da fase (carro, casamento...). Mês a mês, o site usa o objetivo ativo em cada mês.</p>` : ''}
    <form id="form-fase" class="grade-form">
      <label>Começa em<input id="fase-inicio" type="month" required></label>
      <label>Fase<input id="fase-nome" placeholder="Ex.: 2º Tenente"></label>
      <label>Salário líquido (R$)<input id="fase-salario" type="number" min="0" step="100" required></label>
      <label>Aluguel (R$)<input id="fase-aluguel" type="number" min="0" step="100"></label>
      <label>Custo de vida sem aluguel (R$)<input id="fase-custo" type="number" min="0" step="100" required></label>
      <div class="acoes-form"><button class="btn" type="submit">Adicionar fase</button></div>
    </form>
  </div>`;
}

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'form-fase') return;
  e.preventDefault();
  estado.fasesRenda = [...(estado.fasesRenda || []), {
    id: String(Date.now()), inicio: $('#fase-inicio').value, nome: $('#fase-nome').value.trim(),
    salario: Number($('#fase-salario').value) || 0, aluguel: Number($('#fase-aluguel').value) || 0, custo: Number($('#fase-custo').value) || 0,
  }];
  salvar();
  renderRenda();
  if (typeof renderMetas === 'function') renderMetas();
});

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-remover-fase]');
  if (!b) return;
  estado.fasesRenda = (estado.fasesRenda || []).filter((x) => x.id !== b.dataset.removerFase);
  salvar();
  renderRenda();
  if (typeof renderMetas === 'function') renderMetas();
});

renderRenda();
