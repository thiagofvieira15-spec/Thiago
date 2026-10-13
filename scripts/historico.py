"""Histórico de 5 anos para comparar cada ativo com o próprio passado e medir risco.

- Preços mensais (arquivos oficiais COTAHIST da B3 para ações, FIIs e ETFs, Nasdaq para ETFs americanos, Banco Central para o
  dólar, Kraken para o bitcoin; Yahoo como reserva): volatilidade,
  maior queda e correlação entre os ativos da carteira (calculadas no site).
- Lucro líquido anual (dados abertos da CVM, demonstrações anuais DFP): anos com prejuízo,
  crescimento do lucro e P/L de cada ano (calibrado pelo P/L atual).

Grava dados/historico.json. É lento, então guarda o que já baixou e renova aos poucos.
"""
import csv
import io
import json
import re
import statistics
import sys
import time
import urllib.request
import zipfile
from datetime import datetime, timezone

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
CVM = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC"
VERSAO_LUCROS = 2  # muda quando a leitura dos lucros muda, para refazer na próxima execução
VERSAO_PRECOS = 2  # idem para o histórico de preços


def _get(url, timeout=60, binario=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        dados = r.read()
    return dados if binario else dados.decode("utf-8", errors="replace")


# ---------- Preços ----------

def precos_yahoo(simbolo):
    """Fechamentos mensais de 5 anos: (mês 'AAAA-MM', fechamento, fechamento ajustado)."""
    ultimo = None
    for host in ("query1", "query2"):
        try:
            d = json.loads(_get(f"https://{host}.finance.yahoo.com/v8/finance/chart/{simbolo}?range=5y&interval=1mo&events=div,split", 30))
            r = d["chart"]["result"][0]
            ts = r["timestamp"]
            close = r["indicators"]["quote"][0]["close"]
            adj = (r["indicators"].get("adjclose") or [{}])[0].get("adjclose") or close
            out = []
            for t, c, a in zip(ts, close, adj):
                if c and a:
                    mes = datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m")
                    if out and out[-1][0] == mes:
                        out[-1] = (mes, c, a)  # Yahoo repete o mês corrente
                    else:
                        out.append((mes, c, a))
            if len(out) < 12:
                raise RuntimeError("histórico curto")
            return _meses_seguidos(out)
        except Exception as e:
            ultimo = e
    raise RuntimeError(f"Yahoo: {ultimo}")


def _mensal(diarios):
    """[(date, preço)] diários -> [(mês, último preço do mês, mesmo preço)] dos últimos 5 anos."""
    por_mes = {}
    for d, v in sorted(diarios):
        if v and v > 0:
            por_mes[d.strftime("%Y-%m")] = v
    meses = sorted(por_mes)[-61:]
    if len(meses) < 12:
        raise RuntimeError("histórico curto")
    return _meses_seguidos([(m, por_mes[m], por_mes[m]) for m in meses])


def _sem_desdobramentos(serie):
    """Séries sem ajuste: um salto de 2x, 3x, 10x... num mês costuma ser desdobramento/grupamento.
    Reajusta os preços anteriores para o salto sumir (o retorno do mês fica zero)."""
    out = [list(x) for x in serie]
    for i in range(len(out) - 1, 0, -1):
        r = out[i][2] / out[i - 1][2]
        fator = r if r >= 1 else 1 / r
        # Desdobramento/grupamento: salto grande e próximo de uma razão "redonda" (2, 3, 4, 5, 10...)
        if fator >= 1.6 and any(abs(fator / k - 1) < 0.12 for k in (2, 3, 4, 5, 8, 10, 20, 50, 100)):
            for j in range(i):
                out[j][1] *= r
                out[j][2] *= r
    return [tuple(x) for x in out]


def precos_b3_lote(tickers, hoje):
    """Arquivos oficiais da B3 (COTAHIST, um por ano, todos os pregões e papéis).
    Devolve {ticker: [(mês, último preço do mês, mesmo preço)]} dos últimos 5 anos."""
    alvo = set(tickers)
    ultimo = {}  # (ticker, mês) -> (data, preço)
    for ano in range(hoje.year - 5, hoje.year + 1):
        conteudo = None
        for url in (f"https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_A{ano}.ZIP",
                    f"https://www.b3.com.br/pesquisapregao/download?filelist=COTAHIST_A{ano}.ZIP"):
            try:
                conteudo = _get(url, 300, True)
                z = zipfile.ZipFile(io.BytesIO(conteudo))
                interno = [n for n in z.namelist() if n.upper().endswith(".ZIP")]
                if interno:  # o segundo endereço embrulha o zip dentro de outro
                    z = zipfile.ZipFile(io.BytesIO(z.read(interno[0])))
                break
            except Exception as e:
                print(f"aviso: COTAHIST {ano} ({url[:40]}...): {e}", file=sys.stderr)
                z = None
        if z is None:
            continue
        n = 0
        with z.open(z.namelist()[0]) as f:
            for linha in io.TextIOWrapper(f, encoding="latin-1"):
                if not linha.startswith("01") or linha[24:27] != "010":
                    continue
                t = linha[12:24].strip()
                if t not in alvo:
                    continue
                data = linha[2:10]
                preco = int(linha[108:121]) / 100 / max(1, int(linha[210:217] or 1))
                chave = (t, f"{data[:4]}-{data[4:6]}")
                if chave not in ultimo or data > ultimo[chave][0]:
                    ultimo[chave] = (data, preco)
                n += 1
        print(f"COTAHIST {ano}: {n} pregões lidos")
    por_t = {}
    for (t, mes), (_, p) in ultimo.items():
        por_t.setdefault(t, []).append((mes, p, p))
    out = {}
    for t, serie in por_t.items():
        serie.sort()
        serie = serie[-61:]
        if len(serie) >= 12:
            out[t] = _sem_desdobramentos(_meses_seguidos(serie))
    return out


def precos_fundamentus(t):
    texto = _get(f"https://www.fundamentus.com.br/amline/cot_hist.php?papel={t}", 30)
    try:
        d = json.loads(texto)
    except ValueError:
        raise RuntimeError(f"resposta inesperada: {texto[:120]!r}")
    if isinstance(d, dict):
        d = next((v for v in d.values() if isinstance(v, list)), [])
    diarios = []
    for p in d:
        if isinstance(p, (list, tuple)) and len(p) >= 2:
            ts, v = p[0], p[1]
            ts = ts / 1000 if ts > 1e11 else ts
            diarios.append((datetime.fromtimestamp(ts, timezone.utc).date(), float(v)))
    if not diarios:
        raise RuntimeError(f"sem pontos: {texto[:120]!r}")
    return _sem_desdobramentos(_mensal(diarios))


def precos_nasdaq(t):
    hoje = datetime.now(timezone.utc).date()
    url = (f"https://api.nasdaq.com/api/quote/{t}/historical?assetclass=etf&fromdate={hoje.year - 5}-{hoje.month:02d}-01"
           f"&todate={hoje.isoformat()}&limit=2000")
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json, text/plain, */*",
                                               "Origin": "https://www.nasdaq.com", "Referer": "https://www.nasdaq.com/"})
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.loads(r.read().decode("utf-8"))
    linhas = (((d.get("data") or {}).get("tradesTable") or {}).get("rows")) or []
    diarios = [(datetime.strptime(l["date"], "%m/%d/%Y").date(), float(str(l["close"]).replace("$", "").replace(",", "")))
               for l in linhas if l.get("close")]
    return _sem_desdobramentos(_mensal(diarios))


def precos_dolar():
    hoje = datetime.now(timezone.utc).date()
    d = json.loads(_get(f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.3696/dados?formato=json&dataInicial=01/01/{hoje.year - 6}", 60))
    diarios = [(datetime.strptime(x["data"], "%d/%m/%Y").date(), float(str(x["valor"]).replace(",", "."))) for x in d]
    return _mensal(diarios)


def precos_bitcoin():
    d = json.loads(_get("https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=21600", 30))
    linhas = next(iter(v for k, v in d["result"].items() if k != "last"))
    return _mensal([(datetime.fromtimestamp(int(l[0]), timezone.utc).date(), float(l[4])) for l in linhas])


def precos(t, simbolo):
    """Tenta as fontes na ordem; o Yahoo costuma bloquear servidores do GitHub (erro 429)."""
    if t == "USDBRL":
        fontes = [precos_dolar]
    elif t == "BTC":
        fontes = [precos_bitcoin]
    elif simbolo.endswith(".SA"):
        fontes = [lambda: precos_fundamentus(t), lambda: precos_yahoo(simbolo)]
    else:
        fontes = [lambda: precos_nasdaq(t), lambda: precos_yahoo(simbolo)]
    erros = []
    for f in fontes:
        try:
            return f()
        except Exception as e:
            erros.append(str(e)[:150])
    raise RuntimeError(" | ".join(erros))


def _meses_seguidos(serie):
    """Preenche meses sem negócio com o preço anterior, para a série ficar mês a mês."""
    out = [serie[0]]
    for mes, c, a in serie[1:]:
        y, m = map(int, out[-1][0].split("-"))
        while True:
            y, m = (y + 1, 1) if m == 12 else (y, m + 1)
            prox = f"{y:04d}-{m:02d}"
            if prox >= mes:
                break
            out.append((prox, out[-1][1], out[-1][2]))
        out.append((mes, c, a))
    return out


def sig(v, n=4):
    return float(f"{v:.{n}g}")


# ---------- CVM ----------

def _csv_do_zip(conteudo, padrao):
    z = zipfile.ZipFile(io.BytesIO(conteudo))
    nome = next((n for n in z.namelist() if re.search(padrao, n)), None)
    if not nome:
        return []
    texto = z.read(nome).decode("latin-1")
    return list(csv.DictReader(io.StringIO(texto), delimiter=";"))


def tickers_por_cnpj():
    ano = datetime.now(timezone.utc).year
    for a in (ano, ano - 1):
        try:
            linhas = _csv_do_zip(_get(f"{CVM}/FCA/DADOS/fca_cia_aberta_{a}.zip", 180, True), r"valor_mobiliario")
        except Exception as e:
            print(f"aviso: FCA {a}: {e}", file=sys.stderr)
            continue
        out = {}
        for l in linhas:
            t = (l.get("Codigo_Negociacao") or "").strip().upper()
            if re.fullmatch(r"[A-Z][A-Z0-9]{3}\d{1,2}", t):
                out.setdefault(l["CNPJ_Companhia"], set()).add(t)
        if out:
            return out
    raise RuntimeError("cadastro de códigos (FCA) indisponível")


def _lucro_da_empresa(linhas):
    """Escolhe a linha de lucro líquido (atribuído aos controladores quando houver)."""
    por_conta = {l["CD_CONTA"]: l for l in linhas}
    cands = [c for c, l in por_conta.items() if re.fullmatch(r"3\.\d{2}", c)
             and re.search(r"lucro|preju", l["DS_CONTA"], re.I)
             and re.search(r"per[ií]odo|exerc[ií]cio", l["DS_CONTA"], re.I)
             and not re.search(r"antes|continuadas|descontinuadas", l["DS_CONTA"], re.I)]
    if not cands:
        return None
    conta = max(cands)
    filho = por_conta.get(conta + ".01")
    if filho and re.search(r"controladora", filho["DS_CONTA"], re.I):
        conta = conta + ".01"
    l = por_conta[conta]
    v = float(l["VL_CONTA"])
    return v * 1000 if (l.get("ESCALA_MOEDA") or "").upper() == "MIL" else v


def lucros_cvm(anos):
    """{cnpj: {ano: lucro em R$}} lendo a DRE consolidada (ou a individual) das DFPs."""
    out = {}
    # Cada DFP traz o ano e o anterior: basta baixar anos alternados
    for ano in sorted({a if (max(anos) - a) % 2 == 0 else a + 1 for a in anos}, reverse=True):
        try:
            conteudo = _get(f"{CVM}/DFP/DADOS/dfp_cia_aberta_{ano}.zip", 300, True)
        except Exception as e:
            print(f"aviso: DFP {ano}: {e}", file=sys.stderr)
            continue
        for tipo in ("con", "ind"):
            grupos = {}
            for l in _csv_do_zip(conteudo, rf"DRE_{tipo}_{ano}\.csv$"):
                if l.get("ORDEM_EXERC", "").upper().startswith("PEN"):
                    exerc = ano - 1
                else:
                    exerc = ano
                chave = (l["CNPJ_CIA"], exerc)
                versao = int(l.get("VERSAO") or 1)
                g = grupos.get(chave)
                if g is None or versao > g[0]:
                    grupos[chave] = (versao, [l])
                elif versao == g[0]:
                    g[1].append(l)
            for (cnpj, exerc), (_, linhas) in grupos.items():
                if exerc not in anos or exerc in out.get(cnpj, {}):
                    continue
                v = _lucro_da_empresa(linhas)
                if v:  # zero costuma ser demonstração consolidada vazia; tenta a individual
                    out.setdefault(cnpj, {})[exerc] = v
        print(f"DFP {ano}: {len(out)} empresas com lucro lido")
    return out


# ---------- Montagem ----------

def atualizar(mercado, anterior, limite_precos=170, validade_dias=7):
    hoje = datetime.now(timezone.utc).date()
    ativos = {k: v for k, v in (anterior.get("ativos") or {}).items()}

    def idade(t, campo="em"):
        try:
            return (hoje - datetime.fromisoformat(ativos[t][campo]).date()).days
        except (KeyError, ValueError, TypeError):
            return 10_000

    # Quais ativos acompanhar: ações e FIIs negociados, ETFs da B3 e americanos
    acoes = mercado.get("acoes") or {}
    fiis = mercado.get("fiis") or {}
    lista = [(t, f"{t}.SA", d.get("liq") or 0) for t, d in acoes.items() if (d.get("liq") or 0) >= 1_000_000]
    lista += [(t, f"{t}.SA", d.get("liq") or 0) for t, d in fiis.items() if (d.get("liq") or 0) >= 300_000]
    lista += [(t, f"{t}.SA", 1e9) for t in (mercado.get("etfs") or {})]
    lista += [(t, t, 1e9) for t in (mercado.get("etfsEUA") or {})]
    lista += [("USDBRL", "BRL=X", 1e9), ("BTC", "BTC-USD", 1e9)]  # dólar (converte ativos americanos) e bitcoin
    def guardar(t, serie):
        item = ativos.get(t, {})
        item.update({"em": hoje.isoformat(), "m0": serie[0][0], "m": [sig(a) for _, _, a in serie]})
        # Preço médio de cada ano (fechamentos mensais, sem ajuste por proventos), para o P/L histórico
        por_ano = {}
        for mes, c, _ in serie:
            por_ano.setdefault(mes[:4], []).append(c)
        item["precoAno"] = {a: sig(sum(v) / len(v)) for a, v in por_ano.items() if len(v) >= 6}
        ativos[t] = item

    # Ativos da B3: arquivo oficial de uma vez, renovado uma vez por semana
    b3 = [t for t, simbolo, _ in lista if simbolo.endswith(".SA")]
    if anterior.get("precosVersao") != VERSAO_PRECOS or any(idade(t) >= validade_dias for t in b3):
        try:
            series = precos_b3_lote(b3, hoje)
            for t, serie in series.items():
                guardar(t, serie)
            print(f"histórico B3: {len(series)} de {len(b3)} ativos")
        except Exception as e:
            print(f"ERRO em COTAHIST: {e}", file=sys.stderr)

    outros = [x for x in lista if not x[1].endswith(".SA")]
    fila = sorted((x for x in outros if idade(x[0]) >= validade_dias), key=lambda x: (-idade(x[0]), -x[2]))[:limite_precos]

    erros = 0
    for t, simbolo, _ in fila:
        try:
            serie = precos(t, simbolo)
        except Exception as e:
            erros += 1
            if erros <= 8:
                print(f"aviso: preços {t}: {e}", file=sys.stderr)
            if erros >= 20 and erros == fila.index((t, simbolo, _)) + 1:
                print("aviso: fontes de preços parecem bloqueadas, parando", file=sys.stderr)
                break
            continue
        finally:
            time.sleep(0.3)
        guardar(t, serie)
    print(f"histórico de preços fora da B3: {len(fila) - erros} atualizados agora, {erros} erros")

    # Lucros da CVM: renova uma vez por mês
    lucros_em = anterior.get("lucrosEm")
    velho = (not lucros_em or anterior.get("lucrosVersao") != VERSAO_LUCROS
             or (hoje - datetime.fromisoformat(lucros_em).date()).days >= 30)
    if velho:
        try:
            anos = list(range(hoje.year - 5, hoje.year))
            por_cnpj = lucros_cvm(anos)
            mapa = tickers_por_cnpj()
            n = 0
            for cnpj, tks in mapa.items():
                l = por_cnpj.get(cnpj)
                if not l:
                    continue
                for t in tks:
                    if t in acoes:
                        ativos.setdefault(t, {})["lucros"] = {str(a): round(v / 1e6, 1) for a, v in sorted(l.items())}
                        n += 1
            lucros_em = hoje.isoformat()
            print(f"lucros CVM: {n} ações")
        except Exception as e:
            print(f"ERRO em lucros CVM: {e}", file=sys.stderr)

    # P/L de cada ano, calibrado pelo P/L atual da Fundamentus (dispensa o nº de ações):
    # P/L(ano) = P/L(hoje) x preço médio do ano / preço de hoje x lucro do último ano / lucro do ano
    for t, item in ativos.items():
        l, pa, d = item.get("lucros"), item.get("precoAno"), acoes.get(t) or {}
        item.pop("nAcoes", None)
        item.pop("acoesEm", None)
        if not (l and pa and (d.get("pl") or 0) > 0 and d.get("preco")):
            item.pop("pl", None)
            item.pop("plMed", None)
            continue
        ultimo = l[max(l)]
        pl = {}
        for ano, lucro in l.items():
            if ano in pa and lucro and ultimo > 0:
                pl[ano] = round(d["pl"] * pa[ano] / d["preco"] * ultimo / lucro, 1) if lucro > 0 else None
        item["pl"] = pl
        validos = [v for v in pl.values() if v and 0 < v < 200]
        if len(validos) >= 3:
            item["plMed"] = round(statistics.median(validos), 1)
        else:
            item.pop("plMed", None)

    exemplo = {t: (ativos.get(t, {}).get("plMed"), acoes.get(t, {}).get("pl")) for t in ("WEGE3", "ITUB4", "VALE3", "PETR4", "VIVT3") if t in ativos}
    print(f"P/L médio 5 anos vs atual (conferência): {exemplo}")
    return {"atualizadoEm": datetime.now(timezone.utc).isoformat(timespec="seconds"), "lucrosEm": lucros_em, "lucrosVersao": VERSAO_LUCROS, "precosVersao": VERSAO_PRECOS, "ativos": ativos}
