'use strict';

// Rotina: lista do mês (marcável), o que fazer quando algo acontecer, revisão trimestral
// e lembretes com data. Algumas tarefas se marcam sozinhas pelo que o site já sabe.

const ROTINA_MENSAL = [
  { id: 'avisos', texto: 'Ler os avisos do Diagnóstico e tocar em Entendi', ir: 'diagnostico' },
  { id: 'proventos', texto: 'Registrar os proventos do mês (colar do Investidor10)', ir: 'evolucao',
    auto: () => (estado.proventos || []).some((p) => p.data?.startsWith(mesAtualRotina())) },
  { id: 'plano', texto: 'Gerar o plano: salário + proventos (o carro é separado sozinho)', ir: 'plano' },
  { id: 'ordens', texto: 'Fazer as ordens na corretora: carro no CDB/Tesouro Selic, compras do longo prazo e cotas dos FIIs' },
  { id: 'carteira', texto: 'Atualizar quantidades e preços médios na Carteira (ou mandar as 3 páginas do Investidor10 para o Claude)', ir: 'carteira' },
  { id: 'saldos', texto: 'Atualizar os saldos de CDBs, Tesouro e o preço do bitcoin', ir: 'carteira' },
  { id: 'backup', texto: 'Exportar o backup e guardar no Drive ou e-mail', ir: 'carteira',
    auto: () => (estado.ultimoBackup || '').startsWith(mesAtualRotina()) },
];

const ROTINA_EVENTOS = [
  ['Vendeu ações', 'registre em Carteira → "Vendas de ações neste mês" (controle dos R$ 20 mil isentos).'],
  ['Mudou um objetivo (valor ou data do carro, casamento)', 'edite em Carteira → Objetivos.'],
  ['Promoção ou mudança de renda/aporte', 'ajuste em Evolução → Metas e projeção (mudanças no aporte).'],
  ['Mudou uma regra no chat (meta, peso, objetivo)', 'aplique no site (Perfil e Carteira) para valer nos próximos meses.'],
  ['Evento grande (eleição, Copom com surpresa, empresa com problema)', 'veja o Diagnóstico e, se precisar, peça uma revisão ao Claude.'],
];

const mesAtualRotina = () => new Date().toISOString().slice(0, 7);
const hojeRotina = () => new Date().toISOString().slice(0, 10);

function feitoNoMes(item) {
  const marcado = estado.rotina?.[mesAtualRotina()]?.[item.id];
  if (marcado !== undefined) return marcado;
  return item.auto ? item.auto() : false;
}

function diasDesdeRotina(iso) { return iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : null; }

// Lembretes pendentes: vencidos ou nos próximos 3 dias, mais a rotina do mês depois do dia 5
function pendenciasRotina() {
  const hoje = hojeRotina();
  const limite = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const lembretes = (estado.lembretes || []).filter((l) => !l.feito && l.data <= limite);
  const faltam = ROTINA_MENSAL.filter((i) => !feitoNoMes(i)).length;
  return { lembretes, faltam, atrasada: new Date().getDate() >= 5 && faltam > 0, hoje };
}

function atualizarSeloRotina() {
  const b = document.querySelector('.aba[data-aba="rotina"]');
  if (!b) return;
  const p = pendenciasRotina();
  const n = p.lembretes.length + (p.atrasada ? 1 : 0);
  b.innerHTML = `Rotina${n ? ` <span class="selo">${n}</span>` : ''}`;
}

function renderRotina() {
  const el = $('#rotina-conteudo');
  if (!el) return;
  const mes = mesAtualRotina();
  const feitos = ROTINA_MENSAL.filter(feitoNoMes).length;
  const revisao = diasDesdeRotina(estado.ultimoResumo || estado.ultimaAnaliseIA?.data);
  const lembretes = (estado.lembretes || []).slice().sort((a, b) => a.data.localeCompare(b.data));
  const hoje = hojeRotina();
  el.innerHTML = `
  <div class="card">
    <h2>Todo mês, no dia do aporte <span class="motivo">(${feitos} de ${ROTINA_MENSAL.length} em ${mesBRCurto(mes)})</span></h2>
    <div class="trilho" style="margin-bottom:12px"><div class="preench" style="width:${(feitos / ROTINA_MENSAL.length) * 100}%;background:var(--positivo)"></div></div>
    <div class="lista-opcoes">${ROTINA_MENSAL.map((i) => `
      <label class="check"><input type="checkbox" data-rotina="${i.id}" ${feitoNoMes(i) ? 'checked' : ''}>
        <span>${esc(i.texto)}${i.ir ? ` <a href="#" data-ir="${i.ir}">abrir</a>` : ''}${i.auto && i.auto() ? ' <span class="motivo">(feito, detectado pelo site)</span>' : ''}</span></label>`).join('')}</div>
    <p class="dica">A lista recomeça todo mês. Proventos e backup se marcam sozinhos quando o site percebe que você fez.</p>
  </div>

  <div class="card">
    <h2>Lembretes com data</h2>
    ${lembretes.length ? `<ul class="pontos">${lembretes.map((l) => {
      const atraso = !l.feito && l.data < hoje, hojeL = !l.feito && l.data === hoje;
      return `<li><input type="checkbox" data-lembrete="${esc(l.id)}" ${l.feito ? 'checked' : ''} aria-label="Concluído">
        <span${l.feito ? ' style="text-decoration:line-through;color:var(--suave)"' : ''}><strong>${new Date(l.data + 'T12:00').toLocaleDateString('pt-BR')}</strong>${atraso ? ' <span class="tag vender">atrasado</span>' : hojeL ? ' <span class="tag avaliar">hoje</span>' : ''} ${esc(l.texto)}</span>
        <button class="btn perigo mini" type="button" data-remover-lembrete="${esc(l.id)}">x</button></li>`;
    }).join('')}</ul>` : '<p class="dica" style="margin-top:0">Nenhum lembrete. Ex.: "26/10: fazer a Fase 2 do rebalanceamento".</p>'}
    <form id="form-lembrete" class="grade-form">
      <label>Data<input id="lembrete-data" type="date" required></label>
      <label>Lembrete<input id="lembrete-texto" required placeholder="O que fazer"></label>
      <div class="acoes-form"><button class="btn" type="submit">Adicionar</button></div>
    </form>
  </div>

  <div class="card">
    <h2>A cada 3 meses</h2>
    <p style="margin-top:0">Revisão completa com o Claude: no Diagnóstico, toque em <strong>Copiar resumo para o Claude</strong> e cole no chat.
      ${revisao === null ? '<span class="tag avaliar">ainda não feita</span>' : revisao > 90 ? `<span class="tag avaliar">última há ${revisao} dias</span>` : `<span class="motivo">última há ${revisao} dias</span>`}</p>
    <p class="dica">O site faz as contas do mês; o chat serve para rever as regras (metas, pesos, objetivos). O que mudar no chat, aplique no site.</p>
  </div>

  <div class="card">
    <h2>Só quando acontecer</h2>
    <ul class="limpa">${ROTINA_EVENTOS.map(([q, o]) => `<li><strong>${esc(q)}:</strong> ${esc(o)}</li>`).join('')}</ul>
  </div>`;
  atualizarSeloRotina();
}

document.addEventListener('change', (e) => {
  const r = e.target.dataset?.rotina;
  const l = e.target.dataset?.lembrete;
  if (!r && !l) return;
  if (r) {
    const mes = mesAtualRotina();
    estado.rotina = estado.rotina || {};
    estado.rotina[mes] = { ...(estado.rotina[mes] || {}), [r]: e.target.checked };
  }
  if (l) estado.lembretes = (estado.lembretes || []).map((x) => (x.id === l ? { ...x, feito: e.target.checked } : x));
  salvar();
  renderRotina();
});

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'form-lembrete') return;
  e.preventDefault();
  estado.lembretes = [...(estado.lembretes || []), { id: String(Date.now()), data: $('#lembrete-data').value, texto: $('#lembrete-texto').value.trim() }];
  salvar();
  renderRotina();
});

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-remover-lembrete]');
  if (b) {
    estado.lembretes = (estado.lembretes || []).filter((x) => x.id !== b.dataset.removerLembrete);
    salvar();
    renderRotina();
    return;
  }
  // Marca o backup e a revisão quando o usuário usa esses botões
  if (e.target.id === 'exportar') { estado.ultimoBackup = new Date().toISOString(); salvar(); atualizarSeloRotina(); }
  if (e.target.id === 'ia-copiar') { estado.ultimoResumo = new Date().toISOString(); salvar(); }
}, true);

// Cartão curto no Diagnóstico com o que está vencendo
function cardLembretes() {
  const p = pendenciasRotina();
  if (!p.lembretes.length && !p.atrasada) return '';
  return `<div class="card avisos"><h2>Lembretes</h2><ul class="limpa">
    ${p.lembretes.map((l) => `<li><strong>${new Date(l.data + 'T12:00').toLocaleDateString('pt-BR')}</strong> ${esc(l.texto)}</li>`).join('')}
    ${p.atrasada ? `<li>Faltam ${p.faltam} passo(s) da rotina de ${mesBRCurto(mesAtualRotina())}.</li>` : ''}
  </ul><p class="dica"><a href="#" data-ir="rotina">Abrir a Rotina</a></p></div>`;
}

renderRotina();
