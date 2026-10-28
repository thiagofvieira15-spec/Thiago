'use strict';

// Fotografia do cenário macro usada nas recomendações.
// Atualize estes valores periodicamente (ou edite pela aba "Cenário" do site).
const CENARIO_PADRAO = {
  dataReferencia: '2026-10-28',

  // Brasil
  selic: 13.75,              // % a.a., meta atual
  tendenciaSelic: 'corte',   // 'corte' | 'estavel' | 'alta'
  selicFocusFimAno: 13.25,   // mediana Focus para o fim do ano
  ipca12m: 4.58,             // % acumulado em 12 meses
  ipcaFocusAno: 5.19,        // mediana Focus para o ano corrente
  tetoMetaIpca: 4.5,         // teto da meta de inflação
  taxaIpcaLongo: 7.16,       // juro real aproximado do Tesouro IPCA+ longo (% a.a.)
  pibFocusAno: 1.8,          // %
  dolar: 5.5,                // R$ (usado só se a PTAX do dia falhar)
  dolarFocusFimAno: 5.05,    // R$
  riscoEleitoral: true,      // risco político e fiscal elevado (pós-eleição)

  // Global
  fedFunds: 4.0,             // teto da banda, %
  tendenciaFed: 'alta',      // 'corte' | 'estavel' | 'alta'
  inflacaoEUA: 2.56,         // inflação (núcleo) em 12 meses, %
  riscoGeopolitico: true,

  resumo: [
    'Lula reeleito no 2º turno (25/10). O mercado reagiu com queda forte: o Ibovespa (BOVA11) caiu cerca de 17% desde 23/10 (R$ 203 → R$ 169) e o dólar subiu de R$ 5,04 para ~R$ 5,50 (PTAX de 26/10).',
    'As maiores quedas foram em ações ligadas a crédito, mercado financeiro e privatizações (B3SA3 −35%, SBSP3 −20%, RDOR3 −19%, ITSA4 −13%). Estatais e exportadoras caíram menos.',
    'Juros longos subiram: o Tesouro IPCA+ longo paga cerca de 7,2% acima da inflação (era 6,5%). Títulos já comprados perdem na marcação a mercado, mas quem compra agora trava um juro real ainda maior.',
    'Selic em 13,75%. O Focus ainda aponta 13,25% no fim de 2026, mas as expectativas podem piorar com o risco fiscal: acompanhe as próximas reuniões do Copom.',
    'EUA: Fed com juros de 3,75%–4,00% e viés de alta. O VT (ações globais em dólar) e a alta do dólar amorteceram a queda da carteira.',
  ],

  fontes: [
    ['Dados automáticos do site: Banco Central (Selic, IPCA, PTAX, Focus), Tesouro Direto, B3 e Fundamentus', 'https://www.bcb.gov.br/'],
  ],
};
