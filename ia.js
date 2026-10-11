'use strict';

// Parecer escrito por IA (Claude), chamado direto do navegador com a chave da própria pessoa.
// A chave fica só neste navegador e nunca entra no backup.

const CHAVE_IA = 'minha-carteira-chave-ia';
const MODELO_IA = 'claude-opus-5-5';

function lerChaveIA() {
  try { return localStorage.getItem(CHAVE_IA) || ''; } catch (e) { return ''; }
}
function gravarChaveIA(v) {
  try { v ? localStorage.setItem(CHAVE_IA, v) : localStorage.removeItem(CHAVE_IA); } catch (e) { /* ignora */ }
}

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
        precoAtual: r2(preco(a)),
        precoTetoGraham: v?.graham ? r2(v.graham) : undefined,
        precoTetoBazin: v?.bazin ? r2(v.bazin) : undefined,
      };
    }),
  };
}

const SISTEMA_IA = `Você é um analista de investimentos que escreve pareceres educativos para um investidor pessoa física brasileiro.
Você recebe um JSON com a carteira, o perfil, o cenário macroeconômico e os indicadores calculados por um site de acompanhamento.

Escreva em português do Brasil, em Markdown, com estas seções (títulos com ##):
## Resumo
Três a cinco frases: como a carteira está, o principal ponto forte e o principal risco.
## Pontos fortes
## Riscos e pontos de atenção
Inclua concentração, valuation, adequação ao cenário (juros, inflação, câmbio, eleições, EUA) e ao perfil.
Avalie também o equilíbrio entre ações de dividendos e de crescimento e a fatia de estatais, considerando o ciclo de juros e a eleição.
## O que fazer nos próximos aportes
Concreto e priorizado. Se houver aporteDoMes, diga como dividi-lo em reais.
## Ativos para observar
Para cada ativo que mereça comentário, diga se faz sentido reforçar, manter ou reduzir e por quê, citando os números do JSON (P/L contra a mediana do setor, preço-teto, dividend yield etc.).
## Aviso
Uma frase lembrando que é uma análise educativa, não uma recomendação individual.

Regras: use apenas os dados do JSON e conhecimento geral de finanças; não invente cotações, notícias ou números. Se faltar um dado importante, diga qual. Seja direto e evite jargão sem explicação. Não sugira vender a reserva de emergência.`;

// Markdown simples -> HTML (com escape)
function mdParaHTML(md) {
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  let html = '', lista = false;
  for (const linha of md.split('\n')) {
    const l = linha.trimEnd();
    const item = l.match(/^\s*[-*]\s+(.*)/) || l.match(/^\s*\d+\.\s+(.*)/);
    if (item) { if (!lista) { html += '<ul class="limpa">'; lista = true; } html += `<li>${inline(item[1])}</li>`; continue; }
    if (lista) { html += '</ul>'; lista = false; }
    const tit = l.match(/^(#{1,4})\s+(.*)/);
    if (tit) html += `<h3>${inline(tit[2])}</h3>`;
    else if (l.trim()) html += `<p>${inline(l)}</p>`;
  }
  if (lista) html += '</ul>';
  return html;
}

async function chamarIA(chave, conteudo, aoReceber, comFallback = true) {
  const cab = {
    'content-type': 'application/json',
    'x-api-key': chave,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  const corpo = {
    model: MODELO_IA,
    max_tokens: 16000,
    stream: true,
    output_config: { effort: 'medium' },
    system: SISTEMA_IA,
    messages: [{ role: 'user', content: conteudo }],
  };
  if (comFallback) {
    // Se o modelo recusar por engano, o servidor tenta outro modelo automaticamente
    cab['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    corpo.fallbacks = 'default';
  }
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: cab, body: JSON.stringify(corpo) });
  if (!r.ok) {
    let msg = `Erro ${r.status}`;
    try { msg = (await r.json()).error?.message || msg; } catch (e) { /* ignora */ }
    if (r.status === 400 && comFallback && /fallback/i.test(msg)) return chamarIA(chave, conteudo, aoReceber, false);
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  // Leitura do stream (Server-Sent Events)
  const leitor = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '', texto = '', parada = null;
  for (;;) {
    const { value, done } = await leitor.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const linhas = buf.split('\n');
    buf = linhas.pop();
    for (const l of linhas) {
      if (!l.startsWith('data:')) continue;
      let ev;
      try { ev = JSON.parse(l.slice(5)); } catch (e) { continue; }
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
        texto += ev.delta.text;
        aoReceber(texto);
      } else if (ev.type === 'message_delta' && ev.delta?.stop_reason) {
        parada = ev.delta.stop_reason;
      } else if (ev.type === 'error') {
        throw new Error(ev.error?.message || 'Erro durante a resposta');
      }
    }
  }
  return { texto, parada };
}

function renderIA() {
  const el = $('#ia-card');
  if (!el) return;
  const chave = lerChaveIA();
  const ultima = estado.ultimaAnaliseIA;
  el.innerHTML = `
    <h2>Parecer por IA</h2>
    <p class="dica" style="margin-top:0">Um parecer escrito sobre sua carteira, feito pelo Claude (Anthropic) com base em todos os dados do site: perfil, cenário, alocação, fundamentos e preços-teto.</p>
    <div class="grade-form">
      <label>Aporte deste mês (opcional, R$)
        <input id="ia-aporte" type="number" step="any" min="0" placeholder="Ex.: 1000">
      </label>
      <div class="acoes-form"><button class="btn" id="ia-gerar" ${chave ? '' : 'disabled'}>Gerar parecer</button></div>
    </div>
    <details ${chave ? '' : 'open'} style="margin-top:10px">
      <summary class="dica">${chave ? 'Chave da API configurada ✓' : 'Configurar chave da API (necessário uma vez)'}</summary>
      <p class="dica">Crie uma chave em <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> e adicione créditos (pagamento por uso; cada parecer custa poucos centavos de dólar).
        A chave fica salva só neste navegador, não vai para o backup e só é enviada à Anthropic. Não use este recurso em computador compartilhado.</p>
      <div class="grade-form">
        <label>Chave da API (começa com sk-ant-)
          <input id="ia-chave" type="password" autocomplete="off" value="${chave ? '••••••••' : ''}" placeholder="sk-ant-...">
        </label>
        <div class="acoes-form">
          <button class="btn sec" id="ia-salvar-chave" type="button">Salvar chave</button>
          ${chave ? '<button class="btn perigo" id="ia-apagar-chave" type="button">Apagar chave</button>' : ''}
        </div>
      </div>
    </details>
    <p id="ia-status" class="dica"></p>
    <div id="ia-texto" class="ia-texto">${ultima ? mdParaHTML(ultima.texto) : ''}</div>
    ${ultima ? `<p class="dica">Parecer gerado em ${new Date(ultima.data).toLocaleString('pt-BR')}. Gere de novo depois de mudar a carteira ou quando o cenário mudar.</p>` : ''}`;
}

document.addEventListener('click', async (e) => {
  if (e.target.id === 'ia-salvar-chave') {
    const v = $('#ia-chave').value.trim();
    if (!v.startsWith('sk-ant-')) { $('#ia-status').textContent = 'A chave deve começar com "sk-ant-".'; return; }
    gravarChaveIA(v);
    renderIA();
    return;
  }
  if (e.target.id === 'ia-apagar-chave') {
    gravarChaveIA('');
    renderIA();
    return;
  }
  if (e.target.id !== 'ia-gerar') return;
  const st = $('#ia-status');
  if (!estado.perfil || !investidos().length) {
    st.textContent = 'Defina seu perfil e cadastre a carteira antes de pedir o parecer.';
    return;
  }
  const btn = e.target;
  btn.disabled = true;
  st.textContent = 'Analisando sua carteira... (pode levar até um minuto)';
  const saida = $('#ia-texto');
  saida.innerHTML = '';
  const aporte = parseFloat($('#ia-aporte').value) || 0;
  const conteudo = `Dados da minha carteira (JSON):\n\n${JSON.stringify(dadosParaIA(aporte), null, 1)}`;
  try {
    const { texto, parada } = await chamarIA(lerChaveIA(), conteudo, (t) => { saida.innerHTML = mdParaHTML(t); });
    if (parada === 'refusal') {
      st.textContent = 'O modelo não concluiu este parecer. Tente novamente em instantes.';
    } else {
      estado.ultimaAnaliseIA = { data: Date.now(), texto };
      salvar();
      renderIA();
      if (parada === 'max_tokens') $('#ia-status').textContent = 'Parecer cortado por tamanho; peça de novo se precisar.';
    }
  } catch (err) {
    st.textContent = err.status === 401 ? 'Chave inválida. Confira a chave da API.'
      : err.status === 429 ? 'Limite de uso atingido. Aguarde um pouco e tente de novo.'
      : err.status === 402 || /credit/i.test(err.message) ? 'Sem créditos na conta da Anthropic. Adicione créditos no console.'
      : `Não foi possível gerar o parecer: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
});

renderIA();
