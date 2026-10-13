'use strict';

// Parecer do Claude: o site gera um resumo completo da carteira para colar no chat com o Claude,
// e mostra o parecer que vem de volta (importado junto com o backup).

// Resumo estruturado da carteira e do cenário: é tudo o que a IA recebe
function dadosParaIA(aporte) {
  const { total, custo, porClasse } = totais();
  const aj = alvoAjustado();
  const cx = cenario();
  const dg = diagnosticar(5);
  const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : undefined);
  const h = estado.historico || [];
  const rent = h.length >= 2 ? rentabilidadePeriodo(h) : null;
  const limite12 = new Date(); limite12.setFullYear(limite12.getFullYear() - 1);
  const prov12 = (estado.proventos || []).filter((p) => new Date(p.data) >= limite12).reduce((s, p) => s + p.valor, 0);

  return {
    data: new Date().toISOString().slice(0, 10),
    perfil: estado.perfil,
    situacao: {
      trabalho: PERGUNTAS.find((p) => p.id === 'renda')?.opcoes[estado.respostas.renda]?.[0],
      moradia: PERGUNTAS.find((p) => p.id === 'moradia')?.opcoes[estado.respostas.moradia]?.[0],
      reservaEmergencia: totais(reservas()).total ? r2(totais(reservas()).total) : 'não marcada no site',
      mesesReservaRecomendados: mesesReserva(),
    },
    patrimonioInvestido: r2(total),
    totalAplicado: r2(custo),
    rentabilidadeDesdeInicioDoHistorico: rent ? { dias: Math.round(rent.dias), carteiraPct: r2(rent.carteira), cdiPct: r2(rent.cdi) } : null,
    proventos12m: r2(prov12),
    aporteDoMes: aporte || null,
    notaAderencia: dg.nota,
    meta: estado.meta || null,
    risco: (() => {
      const r = typeof analisarRisco === 'function' ? analisarRisco() : null;
      if (!r || r.poucos) return null;
      return { oscilacaoAnualPct: r2(r.vol), piorQuedaPct: r2(r.queda.pct), meses: r.n,
        setoresPctPatrimonio: Object.fromEntries(r.listaSetores.map(([s, p]) => [s, r2(p)])),
        paresCorrelacionados: r.pares.map((p) => `${p.a}/${p.b} ${r2(p.c)}`),
        participacaoNoRisco: Object.fromEntries(r.rv.map((x) => [x.a.nome, r2(x.risco)])) };
    })(),
    exposicaoAcoes: (() => { const e = exposicaoAcoes(); return { dividendosPct: r2(e.dividendos), crescimentoPct: r2(e.crescimento), mistoPct: r2(e.misto), estataisPct: r2(e.estatais), plMedioCrescimento: r2(e.plMedioCrescimento) }; })(),
    alocacao: CLASSES.map((c) => ({
      classe: c.nome,
      atualPct: r2(total ? (porClasse[c.id] / total) * 100 : 0),
      metaPerfilPct: r2(aj.base[c.id]),
      metaAjustadaCenarioPct: r2(aj.final[c.id]),
    })),
    cenario: {
      selic: cx.selic, tendenciaSelic: cx.tendenciaSelic, selicEsperadaFimAno: cx.selicFocusFimAno,
      ipca12m: cx.ipca12m, ipcaEsperadoAno: cx.ipcaFocusAno, tetoMeta: cx.tetoMetaIpca,
      tesouroIpcaLongoJuroReal: cx.taxaIpcaLongo, pibEsperado: cx.pibFocusAno,
      dolar: cx.dolar, dolarEsperadoFimAno: cx.dolarFocusFimAno,
      fedFunds: cx.fedFunds, tendenciaFed: cx.tendenciaFed, inflacaoEUA: cx.inflacaoEUA,
      riscoEleitoral: cx.riscoEleitoral, riscoGeopolitico: cx.riscoGeopolitico,
      sinais: sinaisCenario(cx).sinais.map((s) => s.titulo),
    },
    ativos: dg.acoes.map(({ a, peso, acao, motivo, av }) => {
      const f = fundAtivo(a);
      const v = valuation(a);
      const st = typeof MERCADO !== 'undefined' && MERCADO?.setores && f.setor ? MERCADO.setores[f.setor] : null;
      return {
        ativo: a.nome,
        classe: classe(a.classe).nome,
        pesoPct: r2(peso),
        resultadoPct: r2(custoAtivo(a) ? (valorAtivo(a) / custoAtivo(a) - 1) * 100 : 0),
        acaoSugeridaPeloSite: acao,
        motivo,
        notaFundamentos: av?.nota ?? null,
        indicadores: Object.fromEntries(['pl', 'pvp', 'dy', 'roe', 'margem', 'divPl', 'cresc', 'vacancia', 'nAtivos', 'taxa', 'paises']
          .filter((k) => Number.isFinite(f[k])).map((k) => [k, r2(f[k])])),
        setor: f.setor || undefined,
        estilo: tipoAtivo(a) === 'acao' ? estiloDe(f) : undefined,
        estatal: tipoAtivo(a) === 'acao' ? ehEstatal(a.nome) : undefined,
        medianaSetor: st ? { pl: st.pl, pvp: st.pvp, roe: st.roe, margem: st.margem } : undefined,
        dividendos5anos: typeof histDividendos === 'function' && histDividendos(a) ? { anosComPagamento: histDividendos(a).anos, porAno: histDividendos(a).dpa, ultimos12mSobreMedia: histDividendos(a).pico } : undefined,
        precoAtual: r2(preco(a)),
        precoTetoGraham: v?.graham ? r2(v.graham) : undefined,
        precoTetoBazin: v?.bazin ? r2(v.bazin) : undefined,
        precoTetoMediaHistorica: v?.hist ? r2(v.hist) : undefined,
        historico5anos: histAtivo(a) ? { plMedio: histAtivo(a).plMed, plPorAno: histAtivo(a).pl, lucroMilhoesPorAno: histAtivo(a).lucros } : undefined,
        tipoFII: tipoAtivo(a) === 'fii' ? tipoFII(a) : undefined,
      };
    }),
  };
}

// Markdown simples -> HTML (com escape)
function mdParaHTML(md) {
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  let html = '', lista = false, tabela = false;
  for (const linha of md.split('\n')) {
    const l = linha.trimEnd();
    if (/^\|.*\|$/.test(l.trim())) {
      if (/^\|[\s:|-]+\|$/.test(l.trim())) continue; // linha separadora
      const cel = l.trim().slice(1, -1).split('|').map((c) => c.trim());
      if (!tabela) { html += '<div class="tabela-wrap"><table><thead><tr>' + cel.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>'; tabela = true; }
      else html += '<tr>' + cel.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>';
      continue;
    }
    if (tabela) { html += '</tbody></table></div>'; tabela = false; }
    const item = l.match(/^\s*[-*]\s+(.*)/) || l.match(/^\s*\d+\.\s+(.*)/);
    if (item) { if (!lista) { html += '<ul class="limpa">'; lista = true; } html += `<li>${inline(item[1])}</li>`; continue; }
    if (lista) { html += '</ul>'; lista = false; }
    const tit = l.match(/^(#{1,4})\s+(.*)/);
    if (tit) html += `<h3>${inline(tit[2])}</h3>`;
    else if (l.trim()) html += `<p>${inline(l)}</p>`;
  }
  if (lista) html += '</ul>';
  if (tabela) html += '</tbody></table></div>';
  return html;
}

function renderIA() {
  const el = $('#ia-card');
  if (!el) return;
  const ultima = estado.ultimaAnaliseIA;
  el.innerHTML = `
    <h2>Parecer do Claude</h2>
    ${ultima ? `<p class="dica" style="margin-top:0">Parecer de ${new Date(ultima.data).toLocaleDateString('pt-BR')}.</p>
      <div class="ia-texto">${mdParaHTML(ultima.texto)}</div>` : '<p class="dica" style="margin-top:0">Ainda não há parecer.</p>'}
    <h3>Quer um parecer novo?</h3>
    <ol class="limpa dica">
      <li>Toque em <strong>Copiar resumo para o Claude</strong> (leva tudo: carteira, perfil, cenário, fundamentos, preços-teto, evolução e proventos).</li>
      <li>Cole na conversa com o Claude e peça a análise.</li>
      <li>Importe o backup que ele devolver (aba Carteira → Importar backup) e o parecer aparece aqui.</li>
    </ol>
    <div class="linha-botoes">
      <button class="btn" id="ia-copiar" type="button">Copiar resumo para o Claude</button>
    </div>
    <p id="ia-status" class="dica"></p>
    <textarea id="ia-resumo" rows="6" hidden readonly></textarea>`;
}

document.addEventListener('click', async (e) => {
  if (e.target.id !== 'ia-copiar') return;
  const st = $('#ia-status');
  if (!investidos().length) { st.textContent = 'Cadastre a carteira primeiro.'; return; }
  const texto = `Resumo da minha carteira (gerado pelo site Minha Carteira):\n\n${JSON.stringify(dadosParaIA(0), null, 1)}`;
  try {
    await navigator.clipboard.writeText(texto);
    st.textContent = 'Resumo copiado. Cole na conversa com o Claude.';
  } catch (err) {
    // Sem permissão de área de transferência: mostra o texto para copiar à mão
    const ta = $('#ia-resumo');
    ta.hidden = false;
    ta.value = texto;
    ta.select();
    st.textContent = 'Não consegui copiar automaticamente. Selecione o texto abaixo e copie.';
  }
});

renderIA();
