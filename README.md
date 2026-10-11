# Minha Carteira

Site estático, sem dependências. Avalia sua carteira de investimentos de acordo com o seu perfil e o cenário econômico atual, no Brasil e no mundo. Também sugere o que comprar, vender e onde aportar.

## Abas

- **Diagnóstico**: nota de 0 a 100, alocação atual comparada com a meta ajustada ao cenário, ação sugerida para cada ativo (vender, reduzir, comprar mais, manter) com o motivo, e o que incluir na carteira.
- **Análise de ativos**: avalia ETFs (taxa, diversificação, países, P/L médio; inclui ETFs americanos como o VT) e os fundamentos de cada ação (P/L, P/VP, dividend yield, ROE, margem, dívida, crescimento) e de cada FII (P/VP, dividend yield comparado ao CDI, vacância, número de imóveis ou CRIs), com nota de 0 a 10. Para ações, os dados vêm automaticamente da brapi.dev; para FIIs, a maior parte é preenchida à mão. Ativos com fundamentos fracos passam a "Avaliar" no diagnóstico e deixam de receber aportes no plano.
- **Plano de ação**: recebe o valor do aporte do mês e, opcionalmente, permite vendas para rebalancear. Indica quanto vender de cada ativo, com uma estimativa de IR, e onde comprar. A reserva de emergência informada nunca entra nas vendas.
- **Cenário**: indicadores (Selic, IPCA, juro real, dólar, PIB, Fed) e os sinais que inclinam a alocação. Os valores podem ser editados, e há uma tentativa de busca automática na API do Banco Central.
- **Carteira**: cadastro de ativos, importação colando a tabela do Investidor10 (ou de qualquer planilha/CSV) e backup em JSON.
- **Perfil**: questionário que define o perfil e a alocação-base. Considera também a situação de trabalho (ex.: funcionário público) e a moradia (ex.: mora com os pais) para medir a capacidade de assumir risco e o tamanho da reserva de emergência.

## Como as recomendações são calculadas

1. O perfil (conservador, moderado ou arrojado) define uma alocação-base entre 7 classes de ativos.
2. Cada sinal do cenário (juro real alto, ciclo de cortes, inflação acima do teto, dólar barato, aperto do Fed, eleições etc.) soma ou subtrai pontos percentuais por classe. O ajuste é limitado a ±8 pontos por classe.
3. A carteira é comparada com essa meta. Desvios acima da tolerância e concentrações acima de 15% em um único ativo de renda variável geram as recomendações.

## Cotações e indicadores automáticos (sem token)

O GitHub Actions (`.github/workflows/dados.yml`) roda `scripts/atualizar_dados.py` em dias úteis (10h05, 13h05 e 18h35, horário de Brasília). O script baixa as tabelas públicas do Fundamentus (todas as ações e FIIs, com cotação e indicadores) e as cotações de ETFs, e grava tudo em `dados/mercado.json`. O site lê esse arquivo ao abrir. Para rodar na hora: aba **Actions** → *Atualizar cotações e indicadores* → **Run workflow**.

O token da brapi.dev é opcional e serve só para cotações mais recentes durante o pregão.

## Atualizando o cenário

Os dados de referência ficam em `cenario.js`. Atualize esse arquivo periodicamente (depois de reuniões do Copom e do Fed, ou de um novo Boletim Focus) ou edite os valores pela aba **Cenário**.

## Acesso online

Publicado via GitHub Pages em https://thiagofvieira15-spec.github.io/Thiago/

No celular, abra o link e use **Adicionar à tela inicial** para usar como um aplicativo.

## Como usar

Abra o `index.html` no navegador. Os dados ficam no `localStorage` do navegador.

> Ferramenta educacional baseada em regras gerais de alocação. Não é recomendação individual de investimento.
