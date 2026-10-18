# Minha Carteira

Site estático, sem dependências. Avalia sua carteira de investimentos de acordo com o seu perfil e o cenário econômico atual, no Brasil e no mundo. Também sugere o que comprar, vender e onde aportar.

## Abas

- **Diagnóstico**: nota de 0 a 100, alocação atual comparada com a meta ajustada ao cenário, ação sugerida para cada ativo (vender, reduzir, comprar mais, manter) com o motivo, e o que incluir na carteira.
- **Análise de ativos**: avalia ETFs (taxa, diversificação, países, P/L médio; inclui ETFs americanos como o VT) e os fundamentos de cada ação (P/L, P/VP, dividend yield, ROE, margem, dívida, crescimento) e de cada FII (P/VP, dividend yield comparado ao CDI, vacância, número de imóveis ou CRIs), com nota de 0 a 10. Para ações, os dados vêm automaticamente da brapi.dev; para FIIs, a maior parte é preenchida à mão. P/L, P/VP, ROE e margem das ações são comparados com a mediana do setor (calculada automaticamente). Cada ação tem preço-teto por Graham e Bazin, e cada FII tem o valor patrimonial por cota. Ativos com fundamentos fracos passam a "Avaliar" no diagnóstico e deixam de receber aportes no plano.
- **Estilo e controle das ações**: cada ação é classificada como dividendos, crescimento ou misto, e como estatal ou privada. O Diagnóstico mostra a exposição da carteira e o que o cenário (juros, inflação, eleição) indica. A aba Análise traz uma triagem automática de ideias (dividendos de qualidade e crescimento a preço razoável, até 2 por setor) e as ações da carteira candidatas a sair.
- **Histórico de dividendos**: o robô baixa do Fundamentus os proventos de cada ação líquida (até 80 por execução, renovados a cada semana) e mede em quantos dos últimos 5 anos ela pagou e se os 12 meses recentes fogem da média. Isso entra na nota da ação e a triagem de dividendos descarta pagamentos extraordinários e pagadoras irregulares.
- **Comparação com o próprio passado**: o robô lê o lucro líquido anual de cada empresa nas demonstrações oficiais da CVM (dados abertos) e o histórico de preços nos arquivos oficiais da B3 (COTAHIST). Com isso a nota da ação passa a considerar anos com prejuízo, crescimento do lucro e o P/L de hoje contra a média da própria empresa; empresas com lucro em todos os anos ganham um terceiro preço-teto, pela média histórica (mais justo com empresas de qualidade, como a WEGE3).
- **Risco da carteira** (aba Diagnóstico): simula os últimos 5 anos com os pesos de hoje e mostra oscilação anual, pior queda, pior mês, concentração por setor (inclusive o financeiro somado), quem mais pesa no risco e ativos que andam juntos.
- **FIIs de papel e de tijolo**: cada FII é classificado (sem imóveis = papel/fundo de fundos) e o P/VP de fundos de crédito é avaliado com régua própria.
- **Metas e projeção** (aba Evolução): informe quanto quer ter, em quantos anos e o aporte mensal; o site simula cenários pessimista, mediano e otimista (em reais de hoje), a chance de chegar lá e o aporte necessário para 80% de chance.
- **Avisos desde a última visita** (aba Diagnóstico): o que mudou desde a última vez que você tocou em "Entendi": Selic, nota de aderência, nível dos fundamentos, preço cruzando o preço-teto, quedas ou altas de 15% e classes que saíram da faixa.
- **Placar das recomendações** (aba Evolução): uma vez por semana o site guarda as compras e vendas sugeridas e as ideias da triagem, com o preço do dia; depois de 30 dias mostra quantas bateram o Ibovespa (BOVA11) em 1-3, 3-6, 6-12 meses e mais de 1 ano. Fica no navegador e no backup.
- **Três carteiras**: cada ativo pertence ao **longo prazo** (única que entra na alocação, no risco e no plano), aos **objetivos** de curto/médio prazo ou à **reserva de emergência**. O Diagnóstico mostra as três e o patrimônio total.
- **Peso por ativo (0 a 100)**: % ideal = meta da classe × peso ÷ soma dos pesos da classe. O plano compra o que está mais abaixo do % ideal; peso 0 ou "sem liquidez" não recebe aporte nem sugestão de venda. Um quadro lista os ativos mais de 25% acima do ideal, com o imposto estimado se vender.
- **Quando vender (semáforo 5/25 + preço-teto)**: para cada ativo do longo prazo, desvio relativo de peso = (% atual − % ideal) ÷ % ideal. 🟢 compra prioritária com desvio ≤ −15% (e, em ações, preço abaixo do teto); 🟡 vender só o excesso quando a ação passa de +25% do ideal e está mais de 5% acima do preço-teto, ou passa de +50% em qualquer caso (renda fixa: +20%; ETF/cripto: 5 p.p. ou 25%, o que for menor); ⚪ o resto, incluindo ação que subiu com os fundamentos (congela aportes). FIIs nunca recebem sinal de venda por lucro (20% de IR). Mostra quantas ações vender, o IR estimado, o limite isento do mês e classes inteiras mais de 5 p.p. acima da meta.
- **Objetivos** (aba Carteira): valor, mês e aporte mensal de cada objetivo (ex.: carro, casamento), com projeção a CDI líquido, aporte necessário e onde aplicar conforme o prazo (LCI/LCA só com 10+ meses, por causa da carência de 9 meses).
- **Escudo fiscal**: registro das vendas de ações do mês com barra até a isenção de R$ 20 mil e prejuízo a compensar; o plano avisa quando as vendas sugeridas passariam do limite.
- **Rotina** (aba própria): lista do mês marcável (avisos, proventos, plano, ordens, atualizar carteira e saldos, backup), que recomeça todo mês e se marca sozinha onde dá; lembretes com data (vencidos aparecem no Diagnóstico e no selo da aba); revisão trimestral com o Claude e o que fazer quando algo acontecer.
- **Renda e despesas por fase** (aba Evolução): salário, aluguel e custo de vida de cada fase da vida, em reais de hoje. A sobra, menos o aporte do objetivo ativo em cada mês, vira o aporte do longo prazo usado na projeção e no Cronograma.
- **Cronograma** (aba própria): próximos 12 meses (aporte nos objetivos e no longo prazo, lembretes, vencimentos) e linha do tempo dos anos seguintes com objetivos, mudanças de aporte, retiradas, vencimentos dos títulos, marcos de vida cadastrados e o patrimônio de longo prazo projetado.
- **Estratégia** (aba própria): princípios, divisão do patrimônio entre as 3 carteiras e, por classe, meta, situação, pesos, % ideal de cada ativo e o motivo de cada escolha (textos editáveis).
- **Ajuste das metas pelo cenário** (aba Perfil): Desligado (metas fixas, só rebalanceia; padrão), Leve (só sinais de preço: juro real, Tesouro IPCA+ e dólar, até ±3 pontos) ou Normal (todos os sinais, até ±8 pontos).
- **Plano de ação**: recebe o aporte do salário, os proventos (que podem voltar só para os FIIs) e a parcela dos objetivos e, opcionalmente, permite vendas para rebalancear. Indica quanto vender de cada ativo, com uma estimativa de IR, e onde comprar: dentro de cada classe, o aporte vai em cotas inteiras para o ativo com menor peso, só entre os que têm nota 6 ou mais e preço até 33% acima do preço-teto. A reserva de emergência informada nunca entra nas vendas.
- **Evolução**: registro diário do patrimônio com gráfico, rentabilidade comparada ao CDI (descontando aportes) e controle de proventos (manual ou colando o extrato), com total de 12 meses e gráfico mensal.
- **Parecer do Claude** (aba Diagnóstico): o site gera um resumo completo da carteira para colar no chat com o Claude; o parecer devolvido vem dentro do backup e aparece no site (sem chave de API).
- **Cenário**: indicadores (Selic, IPCA, juro real, dólar, PIB, Fed) e os sinais que inclinam a alocação. Os valores podem ser editados, e há uma tentativa de busca automática na API do Banco Central.
- **Carteira**: cadastro de ativos, importação colando a tabela do Investidor10 (ou de qualquer planilha/CSV) e backup em JSON.
- **Perfil**: questionário que define o perfil e a alocação-base. Considera também a situação de trabalho (ex.: funcionário público) e a moradia (ex.: mora com os pais) para medir a capacidade de assumir risco e o tamanho da reserva de emergência.

## Como as recomendações são calculadas

1. O perfil (conservador, moderado ou arrojado) define uma alocação-base entre 7 classes de ativos.
2. Cada sinal do cenário (juro real alto, ciclo de cortes, inflação acima do teto, dólar barato, aperto do Fed, eleições etc.) soma ou subtrai pontos percentuais por classe. O ajuste é limitado a ±8 pontos por classe.
3. A carteira é comparada com essa meta. Desvios acima da tolerância e concentrações acima de 15% em um único ativo de renda variável geram as recomendações.

## Cotações e indicadores automáticos (sem token)

O GitHub Actions (`.github/workflows/dados.yml`) roda `scripts/atualizar_dados.py` em dias úteis (10h05, 13h05 e 18h35, horário de Brasília). O script baixa Selic, IPCA, dólar e Focus (Banco Central), a taxa do Tesouro IPCA+, juros e inflação dos EUA (FRED), cotações de ETFs (B3 e Nasdaq), o setor de cada ação e as tabelas públicas do Fundamentus (todas as ações e FIIs, com cotação e indicadores) e as cotações de ETFs, e grava tudo em `dados/mercado.json`. O site lê esse arquivo ao abrir. Para rodar na hora: aba **Actions** → *Atualizar cotações e indicadores* → **Run workflow**.

O token da brapi.dev é opcional e serve só para cotações mais recentes durante o pregão.

## Atualizando o cenário

Os dados de referência ficam em `cenario.js`. Atualize esse arquivo periodicamente (depois de reuniões do Copom e do Fed, ou de um novo Boletim Focus) ou edite os valores pela aba **Cenário**.

## Acesso online

Publicado via GitHub Pages em https://thiagofvieira15-spec.github.io/Thiago/

No celular, abra o link e use **Adicionar à tela inicial** para usar como um aplicativo.

## Como usar

Abra o `index.html` no navegador. Os dados ficam no `localStorage` do navegador.

> Ferramenta educacional baseada em regras gerais de alocação. Não é recomendação individual de investimento.

## Alertas por e-mail (opcional)

O arquivo `alertas.json` define uma lista de códigos a vigiar. A cada atualização, o robô compara com a anterior e, se a Selic mudar, um ativo da lista variar mais que `quedaDiaPct` ou cruzar o preço-teto, abre uma issue no repositório; o GitHub avisa o dono por e-mail. Como o repositório é público, a lista fica visível (só os códigos, sem quantidades nem valores).

