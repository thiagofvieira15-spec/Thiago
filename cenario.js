'use strict';

// Fotografia do cenário macro usada nas recomendações.
// Atualize estes valores periodicamente (ou edite pela aba "Cenário" do site).
const CENARIO_PADRAO = {
  dataReferencia: '2026-10-11',

  // Brasil
  selic: 13.75,              // % a.a., meta atual
  tendenciaSelic: 'corte',   // 'corte' | 'estavel' | 'alta'
  selicFocusFimAno: 13.5,    // mediana Focus para o fim do ano
  ipca12m: 4.58,             // % acumulado em 12 meses
  ipcaFocusAno: 5.01,        // mediana Focus para o ano corrente
  tetoMetaIpca: 4.5,         // teto da meta de inflação
  taxaIpcaLongo: 6.48,       // juro real aproximado do Tesouro IPCA+ longo (% a.a.)
  pibFocusAno: 1.85,         // %
  dolar: 4.99,               // R$
  dolarFocusFimAno: 5.2,     // R$
  riscoEleitoral: true,

  // Global
  fedFunds: 4.0,             // teto da banda, %
  tendenciaFed: 'alta',      // 'corte' | 'estavel' | 'alta'
  inflacaoEUA: 3.4,          // inflação (núcleo) em 12 meses, %
  riscoGeopolitico: true,

  resumo: [
    'Selic em 13,75% com o Copom iniciando cortes. O mercado (Focus) espera 13,50% no fim de 2026 e 12% em 2027.',
    'IPCA de 4,58% em 12 meses (set/26), acima do teto da meta (4,5%). O Focus projeta 5,01% para 2026.',
    'Juro real muito alto: Tesouro IPCA+ longo pagando cerca de 6,5% acima da inflação, nível historicamente elevado.',
    'Ibovespa em recorde (~209 mil pontos) após rali eleitoral, com dólar abaixo de R$ 5. O período eleitoral tende a trazer volatilidade.',
    'EUA: o Fed voltou a subir juros (3,75%–4,00% em set/26) e sinaliza mais uma alta. A inflação segue elevada.',
    'Tensões no Oriente Médio mantêm o petróleo pressionado, o que é risco para a inflação global.',
  ],

  fontes: [
    ['Boletim Focus 05/10/2026 (resumo)', 'https://painelbancario.com.br/boletim-focus'],
    ['IBGE: IPCA de setembro de 2026', 'https://agenciadenoticias.ibge.gov.br/agencia-sala-de-imprensa/2013-agencia-de-noticias/releases/48246-ipca-fica-em-0-82-em-setembro'],
    ['Ata do Copom: Selic a 13,75%', 'https://www.spacemoney.com.br/economia/ata-copom-cautela-ipca-2026'],
    ['CNN Brasil: Ibovespa recorde e dólar a R$ 4,98', 'https://www.cnnbrasil.com.br/economia/money/mercado/mercado-financeiro-ibovespa-dolar-9-outubro-2026/'],
    ['Federal Reserve: FOMC 16/09/2026', 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm'],
    ['InfoMoney: Tesouro IPCA+ com juro real recorde', 'https://www.infomoney.com.br/onde-investir/compras-de-tesouro-ipca-acompanham-juro-recorde-e-disparam-mais-de-70/'],
  ],
};
