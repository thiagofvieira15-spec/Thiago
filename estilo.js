'use strict';

// Estilo das ações (dividendos x crescimento), controle (estatal x privada),
// orientação conforme o cenário e triagem de ideias na bolsa.
// Carregado depois de app.js, mercado.js e fundamentos.js.

// Empresas com controle público (União ou estados), direto ou por meio de estatal
const ESTATAIS = new Set([
  'PETR3', 'PETR4', 'BBAS3', 'BBSE3', 'CXSE3', 'BRSR3', 'BRSR6', 'BNBR3', 'BAZA3', 'BMEB3', 'BMEB4', 'BGIP3', 'BGIP4',
  'CMIG3', 'CMIG4', 'CSMG3', 'SAPR3', 'SAPR4', 'SAPR11', 'CEEB3', 'CEBR3', 'CEBR5', 'CEBR6', 'EMAE4', 'CASN3', 'CASN4',
]);

const ehEstatal = (ticker) => ESTATAIS.has(ticker.replace(/F$/, ''));

// Crescimento forte vence; dividendo alto com pouco crescimento = dividendos
function estiloDe(f) {
  const dy = f.dy || 0, cr = f.cresc || 0;
  if (cr >= 10 && dy < 5) return 'crescimento';
  if (dy >= 6 && cr < 15) return 'dividendos';
  return 'misto';
}

const ROTULO_ESTILO = { dividendos: 'Dividendos', crescimento: 'Crescimento', misto: 'Misto' };

// Exposição das ações da carteira por estilo e controle
function exposicaoAcoes() {
  const acoes = investidos().filter((a) => tipoAtivo(a) === 'acao');
  const total = acoes.reduce((s, a) => s + valorAtivo(a), 0);
  const est = { dividendos: 0, crescimento: 0, misto: 0 };
  let estatais = 0, plCresc = 0, pesoCresc = 0;
  for (const a of acoes) {
    const v = valorAtivo(a);
    const f = fundAtivo(a);
    const e = estiloDe(f);
    est[e] += v;
    if (ehEstatal(a.nome)) estatais += v;
    if (e === 'crescimento' && f.pl > 0) { plCresc += f.pl * v; pesoCresc += v; }
  }
  const p = (v) => (total ? (v / total) * 100 : 0);
  return {
    total, n: acoes.length,
    dividendos: p(est.dividendos), crescimento: p(est.crescimento), misto: p(est.misto),
    estatais: p(estatais), plMedioCrescimento: pesoCresc ? plCresc / pesoCresc : null,
  };
}

// Leitura do cenário para a escolha de estilo e de estatais
function orientacaoEstilo(cx = cenario()) {
  const pontos = [];
  if (cx.selic >= 10) {
    pontos.push(`Com a Selic em ${f2(cx.selic)}%, a renda fixa paga muito. Ação de dividendos só compensa se o rendimento for alto e o lucro estável. As boas pagadoras de setores perenes (energia, saneamento, bancos, seguros, telecom) seguram a carteira nos momentos de volatilidade.`);
  }
  if (cx.tendenciaSelic === 'corte') {
    pontos.push('No começo de um ciclo de corte de juros, empresas de crescimento e setores sensíveis a juros (construção, varejo, shoppings) costumam subir mais. Prefira crescimento a preço razoável (P/L de até ~15): crescimento caro já tem os cortes embutidos no preço.');
  } else if (cx.tendenciaSelic === 'alta') {
    pontos.push('Com juros subindo, empresas de crescimento costumam sofrer mais. Dê preferência a dividendos de empresas pouco endividadas.');
  }
  if (cx.ipca12m > cx.tetoMetaIpca) {
    pontos.push('A inflação acima da meta pode atrasar os cortes de juros: não aposte tudo em crescimento. Empresas com receitas corrigidas pela inflação (energia, saneamento, concessões) ajudam a proteger.');
  }
  if (cx.riscoEleitoral) {
    pontos.push('Estatais (Petrobras, Banco do Brasil, Cemig etc.) costumam estar baratas e pagar bons dividendos, mas o preço delas depende muito de quem governa. Em período eleitoral o risco é binário: limite a cerca de 15% das suas ações e evite aumentar a posição antes do resultado.');
  } else {
    pontos.push('Estatais costumam negociar com desconto pelo risco de interferência política. Se tiver, mantenha uma fatia moderada (até ~20% das ações).');
  }
  return pontos;
}

function alertasEstilo(ex, cx = cenario()) {
  const al = [];
  if (!ex.n) return al;
  if (ex.crescimento > 55 && ex.plMedioCrescimento > 20) {
    al.push(`${f1(ex.crescimento)}% das suas ações são de crescimento, com P/L médio de ${f1(ex.plMedioCrescimento)}. É um lado caro: os cortes de juros já estão no preço. Prefira reforçar crescimento a preço razoável ou dividendos perenes.`);
  } else if (ex.crescimento > 65) {
    al.push(`${f1(ex.crescimento)}% das ações são de crescimento: a carteira fica sensível a juros e à eleição. Equilibre com pagadoras de dividendos.`);
  }
  if (ex.dividendos < 30 && cx.selic >= 10) al.push(`Só ${f1(ex.dividendos)}% das ações são boas pagadoras de dividendos. Com juros altos e eleição, um núcleo maior de dividendos (40% a 50%) dá mais estabilidade.`);
  if (ex.estatais > (cx.riscoEleitoral ? 15 : 20)) al.push(`Estatais somam ${f1(ex.estatais)}% das suas ações, acima do recomendado para o momento.`);
  return al;
}

// ---------- Triagem de ideias na bolsa ----------

function ativoVirtual(ticker, d) {
  return { id: `v-${ticker}`, nome: ticker, classe: 'acoes', qtd: 1, pm: d.preco, pa: d.preco, fund: { ...d } };
}

function triagemIdeias() {
  if (typeof MERCADO === 'undefined' || !MERCADO?.acoes) return null;
  const naCarteira = new Set(estado.ativos.map((a) => a.nome.replace(/F$/, '').replace(/\d+$/, '')));
  const cands = [];
  for (const [t, d] of Object.entries(MERCADO.acoes)) {
    if ((d.liq || 0) < 20e6 || naCarteira.has(t.replace(/\d+$/, ''))) continue;
    const a = ativoVirtual(t, d);
    const av = avaliarFundamentos(a);
    if (av.nivel !== 'bom') continue;
    const pv = pontoValuation(a);
    cands.push({ t, d, av, est: estiloDe(d), margem: pv ? pv[0] : 0 });
  }
  // No máximo 2 por setor, para diversificar
  const escolher = (lista, n) => {
    const porSetor = {}, out = [];
    for (const c of lista) {
      const s = c.d.setor || '?';
      if ((porSetor[s] || 0) >= 2) continue;
      porSetor[s] = (porSetor[s] || 0) + 1;
      out.push(c);
      if (out.length >= n) break;
    }
    return out;
  };
  const ord = (x, y) => y.av.nota - x.av.nota || y.margem - x.margem;
  const dividendos = escolher(cands.filter((c) => c.est === 'dividendos' && (c.d.dy || 0) >= 7).sort(ord), 6);
  const crescimento = escolher(cands.filter((c) => c.est !== 'dividendos' && (c.d.cresc || 0) >= 10 && c.d.pl > 0 && c.d.pl <= 15).sort(ord), 6);

  // Candidatas a sair: ações da carteira com fundamentos fracos/medianos e preço muito acima do teto e do setor
  const sair = investidos().filter((a) => tipoAtivo(a) === 'acao').map((a) => {
    const av = avaliarFundamentos(a);
    const f = fundAtivo(a);
    const v = valuation(a);
    const teto = v ? Math.max(v.graham || 0, v.bazin || 0) : 0;
    // Mesma conta dos cartões de análise: quanto o preço está acima do maior preço-teto
    const acimaTeto = teto ? -(teto / v.p - 1) * 100 : 0;
    const m = medSetor(a, 'pl');
    const caroSetor = m && f.pl > m * 1.5;
    const motivos = [];
    if (av.nivel === 'fraco') motivos.push(`fundamentos fracos (${f1(av.nota)}/10)`);
    else if (av.nota != null && av.nota < 5) motivos.push(`nota baixa (${f1(av.nota)}/10)`);
    if (acimaTeto > 33) motivos.push(`preço ${f1(acimaTeto)}% acima do maior preço-teto`);
    if (caroSetor) motivos.push(`P/L ${f1(f.pl)} contra ${f1(m)} do setor`);
    return { a, av, motivos, forte: motivos.length >= 2 || av.nivel === 'fraco' };
  }).filter((x) => x.forte).sort((x, y) => (x.av.nota ?? 0) - (y.av.nota ?? 0));

  return { dividendos, crescimento, sair };
}

// ---------- Cartões ----------

function barraExposicao(ex) {
  const seg = [['dividendos', '--serie-1'], ['misto', '--suave'], ['crescimento', '--serie-2']];
  return `<div class="barra-empilhada">${seg.map(([k, cor]) => ex[k] > 0.5 ? `<span style="width:${ex[k]}%;background:var(${cor})" title="${ROTULO_ESTILO[k]}: ${f1(ex[k])}%"></span>` : '').join('')}</div>
    <div class="viz-legenda">${seg.map(([k, cor]) => `<span><span class="viz-amostra" style="background:var(${cor})"></span>${ROTULO_ESTILO[k]} ${f1(ex[k])}%</span>`).join('')}
      <span>Estatais: ${f1(ex.estatais)}%</span></div>`;
}

function cardPerfilAcoes() {
  const ex = exposicaoAcoes();
  if (!ex.n) return '';
  const al = alertasEstilo(ex);
  return `<div class="card">
    <h2>Dividendos ou crescimento? Estatais ou privadas?</h2>
    <p class="dica" style="margin-top:0">Como suas ${ex.n} ações (${fmt(ex.total)}) se dividem:</p>
    ${barraExposicao(ex)}
    ${al.map((t) => `<div class="alerta">${esc(t)}</div>`).join('')}
    <h3>O que o cenário indica</h3>
    <ul class="limpa">${orientacaoEstilo().map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    <p class="dica">Classificação: <strong>dividendos</strong> = rendimento de 6% ou mais com crescimento moderado; <strong>crescimento</strong> = receita crescendo 10% ou mais ao ano e rendimento baixo; <strong>misto</strong> = o resto. Ideias de ações na aba <a href="#" data-ir="analise">Análise de ativos</a>.</p>
  </div>`;
}

function linhaIdeia(c) {
  const m = c.d.setor && MERCADO?.setores?.[c.d.setor]?.pl;
  return `<tr>
    <td><strong>${esc(c.t)}</strong>${ehEstatal(c.t) ? ' <span class="tag avaliar">Estatal</span>' : ''}<br><span class="motivo">${esc(c.d.setor || '')}</span></td>
    <td class="num">${f1(c.av.nota)}</td>
    <td class="num">${f1(c.d.pl)}${m ? `<br><span class="motivo">setor ${f1(m)}</span>` : ''}</td>
    <td class="num">${f1(c.d.dy || 0)}%${(c.d.dy || 0) > 15 ? '<br><span class="motivo neg">provável extraordinário</span>' : ''}</td>
    <td class="num">${f1(c.d.roe || 0)}%</td>
    <td class="num">${f1(c.d.cresc || 0)}%</td>
    <td class="num">${fmt(c.d.preco)}</td>
  </tr>`;
}

function tabelaIdeias(lista) {
  if (!lista.length) return '<p class="dica">Nenhuma ação passou nos filtros hoje.</p>';
  return `<div class="tabela-wrap"><table>
    <thead><tr><th>Ação</th><th class="num">Nota</th><th class="num">P/L</th><th class="num">Div. yield</th><th class="num">ROE</th><th class="num">Cresc. receita</th><th class="num">Preço</th></tr></thead>
    <tbody>${lista.map(linhaIdeia).join('')}</tbody></table></div>`;
}

function cardIdeias() {
  const tr = triagemIdeias();
  if (!tr) return '';
  return `<div class="card">
    <h2>Ideias para a carteira</h2>
    <p class="dica" style="margin-top:0">Triagem automática de todas as ações com liquidez acima de R$ 20 milhões/dia, que você ainda não tem, com fundamentos sólidos pelos mesmos critérios do site (comparação com o setor e preço-teto). No máximo 2 por setor. Ponto de partida para estudo, não recomendação de compra.</p>
    <h3>Dividendos de qualidade (rendimento de 7% ou mais)</h3>
    ${tabelaIdeias(tr.dividendos)}
    <h3>Crescimento a preço razoável (receita +10% ao ano, P/L até 15)</h3>
    ${tabelaIdeias(tr.crescimento)}
    <h3>Da sua carteira: candidatas a sair ou reduzir</h3>
    ${tr.sair.length ? `<ul class="limpa">${tr.sair.map((x) => `<li><strong>${esc(x.a.nome)}</strong>: ${esc(x.motivos.join('; '))}.</li>`).join('')}</ul>
      <p class="dica">Antes de vender, pense na tese: empresas de alta qualidade (ex.: WEGE3) vivem caras. Vender só por estar cara pode tirar você de boas empresas; considere apenas parar de aportar nelas.</p>`
      : '<p class="ok">Nenhuma ação da carteira com sinais fortes para sair.</p>'}
    <p class="dica">Atenção a armadilhas: dividend yield muito alto (acima de 15%) costuma vir de pagamento extraordinário que não se repete; construtoras e varejo são cíclicos; estatais dependem do governo.</p>
  </div>`;
}

function tagsEstilo(a) {
  if (tipoAtivo(a) !== 'acao') return '';
  const e = estiloDe(fundAtivo(a));
  return `<span class="tag manter">${ROTULO_ESTILO[e]}</span>${ehEstatal(a.nome) ? ' <span class="tag avaliar">Estatal</span>' : ''}`;
}
