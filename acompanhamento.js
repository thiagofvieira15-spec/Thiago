'use strict';

// Acompanhamento: avisos do que mudou desde a última visita e placar das recomendações do site.
// Tudo fica no navegador (e no backup), nada é enviado para fora.

const dataCurta = (iso) => new Date(iso).toLocaleDateString('pt-BR');
const diasDesde = (iso) => (Date.now() - Date.parse(iso)) / 86400000;
const mercadoPronto = () => typeof MERCADO !== 'undefined' && !!MERCADO;

// ---------- Avisos desde a última visita ----------

function fotoVisita() {
  const dg = diagnosticar(5);
  const ativos = {};
  for (const { a } of dg.acoes) {
    const tipo = tipoAtivo(a);
    if (tipo !== 'acao' && tipo !== 'fii') continue;
    const av = avaliarFundamentos(a);
    const v = valuation(a);
    const teto = v && v.tipo === 'acao' ? tetoMaior(v) : 0;
    ativos[a.nome] = { nivel: av.nivel, preco: preco(a), teto: teto || null };
  }
  const classes = {};
  for (const l of dg.linhas) classes[l.c.id] = Math.round(l.desvio * 10) / 10;
  return { data: new Date().toISOString(), selic: cenario().selic, nota: dg.nota, ativos, classes };
}

function listarAvisos(antes, agora) {
  const avisos = [];
  if (Number.isFinite(antes.selic) && Math.abs(agora.selic - antes.selic) >= 0.2) {
    const subiu = agora.selic > antes.selic;
    avisos.push({ tipo: 'avaliar', texto: `Selic ${subiu ? 'subiu' : 'caiu'} de ${f2(antes.selic)}% para ${f2(agora.selic)}%. ${subiu ? 'Renda fixa pós-fixada fica mais atraente.' : 'Prefixados, IPCA+ longos e FIIs de tijolo tendem a ganhar.'} As metas por classe já foram recalculadas.` });
  }
  if (Number.isFinite(antes.nota) && Math.abs(agora.nota - antes.nota) >= 5) {
    avisos.push({ tipo: agora.nota > antes.nota ? 'comprar' : 'reduzir', texto: `Nota de aderência foi de ${antes.nota} para ${agora.nota}.` });
  }
  const ROT = { bom: 'sólidos', neutro: 'medianos', fraco: 'fracos' };
  const ORD = { fraco: 0, neutro: 1, bom: 2 };
  for (const [t, x] of Object.entries(agora.ativos)) {
    const y = antes.ativos?.[t];
    if (!y) continue;
    if (y.nivel && x.nivel && y.nivel !== x.nivel) {
      const melhorou = ORD[x.nivel] > ORD[y.nivel];
      avisos.push({ tipo: melhorou ? 'comprar' : 'vender', texto: `${t}: fundamentos passaram de ${ROT[y.nivel]} para ${ROT[x.nivel]}.${x.nivel === 'fraco' ? ' Veja o cartão na aba Análise de ativos.' : ''}` });
    }
    if (x.teto && y.teto && y.preco && x.preco) {
      const antesAbaixo = y.preco <= y.teto, agoraAbaixo = x.preco <= x.teto;
      if (!antesAbaixo && agoraAbaixo) avisos.push({ tipo: 'comprar', texto: `${t} caiu abaixo do preço-teto (${fmt(x.teto)}): voltou a ter margem de segurança.` });
      if (antesAbaixo && !agoraAbaixo) avisos.push({ tipo: 'manter', texto: `${t} passou do preço-teto (${fmt(x.teto)}): perdeu a margem de segurança. Não precisa vender, mas pense antes de aportar.` });
    }
    if (y.preco && x.preco) {
      const varia = (x.preco / y.preco - 1) * 100;
      if (Math.abs(varia) >= 15) avisos.push({ tipo: varia > 0 ? 'manter' : 'avaliar', texto: `${t} ${varia > 0 ? 'subiu' : 'caiu'} ${f1(Math.abs(varia))}% desde a última visita.${varia < 0 ? ' Verifique se houve notícia ruim ou se é oportunidade.' : ''}` });
    }
  }
  const TOL = 5;
  for (const c of CLASSES) {
    const d0 = antes.classes?.[c.id], d1 = agora.classes?.[c.id];
    if (!Number.isFinite(d0) || !Number.isFinite(d1)) continue;
    if (Math.abs(d0) <= TOL && Math.abs(d1) > TOL) avisos.push({ tipo: d1 > 0 ? 'reduzir' : 'comprar', texto: `${c.nome} saiu da faixa: está ${f1(Math.abs(d1))} pontos ${d1 > 0 ? 'acima' : 'abaixo'} da meta. Veja o Plano de ação.` });
    if (Math.abs(d0) > TOL && Math.abs(d1) <= TOL) avisos.push({ tipo: 'manter', texto: `${c.nome} voltou para perto da meta.` });
  }
  return avisos;
}

function renderAvisos() {
  const el = $('#avisos-conteudo');
  if (!el) return;
  if (!mercadoPronto() || !estado.perfil || !investidos().length) { el.innerHTML = ''; return; }
  const agora = fotoVisita();
  if (!estado.visita) { estado.visita = agora; salvar(); el.innerHTML = ''; return; }
  const avisos = listarAvisos(estado.visita, agora);
  if (!avisos.length) { el.innerHTML = ''; return; }
  const ROT_TAG = { comprar: 'Oportunidade', vender: 'Atenção', reduzir: 'Atenção', avaliar: 'Verificar', manter: 'Info' };
  el.innerHTML = `<div class="card avisos">
    <h2>Avisos desde ${dataCurta(estado.visita.data)}</h2>
    <ul class="pontos">${avisos.map((a) => `<li><span class="tag ${a.tipo}">${ROT_TAG[a.tipo]}</span><span>${esc(a.texto)}</span></li>`).join('')}</ul>
    <div class="linha-botoes"><button class="btn sec" id="avisos-ok" type="button">Entendi</button></div>
    <p class="dica">Os avisos comparam a carteira e o mercado de hoje com a sua última confirmação. Ao tocar em Entendi, a comparação recomeça a partir de agora.</p>
  </div>`;
}

document.addEventListener('click', (e) => {
  if (e.target.id !== 'avisos-ok') return;
  estado.visita = fotoVisita();
  salvar();
  renderAvisos();
});

// ---------- Placar das recomendações ----------

const FOTO_A_CADA_DIAS = 7;
const MAX_FOTOS = 110;

function registrarRecomendacoes() {
  if (!mercadoPronto() || !MERCADO.acoes || !estado.perfil || !investidos().length) return;
  const bova = MERCADO.etfs?.BOVA11?.preco;
  if (!bova) return;
  const recs = estado.recomendacoes || [];
  const ultima = recs[recs.length - 1];
  if (ultima && diasDesde(ultima.data) < FOTO_A_CADA_DIAS) return;
  const itens = new Map();
  const add = (t, s, o) => {
    const p = MERCADO.acoes[t]?.preco;
    if (p && !itens.has(t)) itens.set(t, { t, s, o, p });
  };
  const ideias = typeof triagemIdeias === 'function' ? triagemIdeias() : null;
  if (ideias) {
    for (const c of [...ideias.dividendos, ...ideias.crescimento]) add(c.t, 'compra', 'ideia');
    for (const x of ideias.sair) add(x.a.nome.replace(/F$/, ''), 'venda', 'carteira');
  }
  // Da carteira, só entram opiniões sobre a ação em si (reduzir por rebalanceamento de classe não conta)
  for (const { a, acao, av } of diagnosticar(5).acoes) {
    if (tipoAtivo(a) !== 'acao') continue;
    const t = a.nome.replace(/F$/, '');
    if (acao === 'comprar' && av?.nivel === 'bom') add(t, 'compra', 'carteira');
    else if ((acao === 'vender' || acao === 'reduzir') && av?.nivel === 'fraco') add(t, 'venda', 'carteira');
  }
  if (!itens.size) return;
  recs.push({ data: new Date().toISOString(), bova, selic: cenario().selic, itens: [...itens.values()] });
  estado.recomendacoes = recs.slice(-MAX_FOTOS);
  salvar();
}

const HORIZONTES = [
  { nome: '1 a 3 meses', min: 30, max: 90 },
  { nome: '3 a 6 meses', min: 90, max: 180 },
  { nome: '6 a 12 meses', min: 180, max: 365 },
  { nome: 'Mais de 1 ano', min: 365, max: Infinity },
];

function avaliarPlacar() {
  const bovaHoje = MERCADO.etfs?.BOVA11?.preco;
  if (!bovaHoje) return null;
  // Em cada horizonte, cada recomendação conta uma vez (a foto mais antiga dentro do horizonte)
  const porHorizonte = HORIZONTES.map((h) => ({ ...h, itens: new Map() }));
  for (const foto of estado.recomendacoes || []) {
    const dias = diasDesde(foto.data);
    const h = porHorizonte.find((x) => dias >= x.min && dias < x.max);
    if (!h) continue;
    const ibov = (bovaHoje / foto.bova - 1) * 100;
    for (const it of foto.itens) {
      const chave = `${it.t}|${it.s}`;
      if (h.itens.has(chave)) continue;
      const agora = MERCADO.acoes?.[it.t]?.preco;
      if (!agora) continue;
      const ret = (agora / it.p - 1) * 100;
      const rel = ret - ibov;
      h.itens.set(chave, { ...it, data: foto.data, agora, ret, ibov, rel, acerto: it.s === 'compra' ? rel > 0 : rel < 0 });
    }
  }
  return porHorizonte.map((h) => {
    const lista = [...h.itens.values()];
    const resumo = (s) => {
      const l = lista.filter((x) => x.s === s);
      return l.length ? { n: l.length, acertos: l.filter((x) => x.acerto).length, rel: l.reduce((a, x) => a + x.rel, 0) / l.length } : null;
    };
    return { nome: h.nome, lista, compra: resumo('compra'), venda: resumo('venda') };
  }).filter((h) => h.lista.length);
}

function celulaPlacar(r) {
  if (!r) return '<td class="num">—</td><td class="num">—</td>';
  const pctAcerto = (r.acertos / r.n) * 100;
  return `<td class="num"><strong>${f1(pctAcerto)}%</strong> <span class="motivo">(${r.acertos} de ${r.n})</span></td>
    <td class="num ${r.rel >= 0 ? 'pos' : 'neg'}">${r.rel >= 0 ? '+' : ''}${f1(r.rel)} p.p.</td>`;
}

function renderPlacar() {
  const el = $('#placar-conteudo');
  if (!el) return;
  const recs = estado.recomendacoes || [];
  let corpo;
  if (!recs.length) {
    corpo = '<p class="dica" style="margin-top:0">Ainda não há recomendações guardadas. A cada semana em que você abre o site, ele guarda as compras e vendas sugeridas e as ideias da triagem, com o preço do dia.</p>';
  } else {
    const primeira = recs[0];
    const placar = mercadoPronto() ? avaliarPlacar() : null;
    const liberaEm = new Date(Date.parse(primeira.data) + 30 * 86400000);
    corpo = `<p class="dica" style="margin-top:0">${recs.length} foto(s) semanal(is) guardada(s), desde ${dataCurta(primeira.data)}.</p>`;
    if (!placar || !placar.length) {
      corpo += `<p>O placar aparece a partir de ${liberaEm.toLocaleDateString('pt-BR')}, quando a primeira foto completar 30 dias.</p>`;
    } else {
      const total = placar.reduce((s, h) => s + h.lista.length, 0);
      corpo += `<div class="tabela-wrap"><table>
        <thead><tr><th>Horizonte</th><th class="num">Compras: acerto</th><th class="num">vs Ibov.</th><th class="num">Vendas: acerto</th><th class="num">vs Ibov.</th></tr></thead>
        <tbody>${placar.map((h) => `<tr><td>${h.nome}</td>${celulaPlacar(h.compra)}${celulaPlacar(h.venda)}</tr>`).join('')}</tbody>
      </table></div>
      ${total < 20 ? '<p class="alerta">Ainda são poucas recomendações: com menos de 20, o resultado diz mais sobre sorte do que sobre a qualidade das regras.</p>' : ''}
      <details><summary>Ver cada recomendação</summary>
        ${placar.map((h) => `<h3>${h.nome}</h3><div class="tabela-wrap"><table>
          <thead><tr><th>Ação</th><th>Sugestão</th><th>Em</th><th class="num">Preço então</th><th class="num">Hoje</th><th class="num">Ação</th><th class="num">Ibov.</th><th>Resultado</th></tr></thead>
          <tbody>${h.lista.sort((x, y) => y.rel - x.rel).map((x) => `<tr>
            <td><strong>${esc(x.t)}</strong></td>
            <td><span class="tag ${x.s === 'compra' ? 'comprar' : 'vender'}">${x.s === 'compra' ? 'Comprar' : 'Vender'}</span>${x.o === 'ideia' ? ' <span class="motivo">ideia</span>' : ''}</td>
            <td>${dataCurta(x.data)}</td>
            <td class="num">${fmt(x.p)}</td><td class="num">${fmt(x.agora)}</td>
            <td class="num ${x.ret >= 0 ? 'pos' : 'neg'}">${x.ret >= 0 ? '+' : ''}${f1(x.ret)}%</td>
            <td class="num">${x.ibov >= 0 ? '+' : ''}${f1(x.ibov)}%</td>
            <td class="${x.acerto ? 'pos' : 'neg'}">${x.acerto ? 'Acertou' : 'Errou'}</td></tr>`).join('')}</tbody></table></div>`).join('')}
      </details>`;
    }
  }
  el.innerHTML = `<div class="card"><h2>Placar das recomendações</h2>${corpo}
    <p class="dica">Acerto: compra que subiu mais que o Ibovespa (BOVA11) no período, ou venda que ficou abaixo dele. Compara só o preço, sem dividendos, então favorece um pouco as vendas de boas pagadoras. Serve para calibrar quanto confiar nas sugestões, não como garantia.</p></div>`;
}

function renderAcompanhamento() {
  renderAvisos();
  renderPlacar();
  if (typeof renderMetas === 'function') renderMetas();
}

renderAcompanhamento();
