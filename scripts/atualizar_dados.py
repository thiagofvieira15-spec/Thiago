"""Baixa cotações e indicadores públicos e grava dados/mercado.json.

Fontes (sem cadastro nem token):
- Fundamentus: tabelas de todas as ações e FIIs (cotação, P/L, P/VP, DY, ROE, vacância...)
- Yahoo Finance: cotação de ETFs, que não aparecem no Fundamentus

Roda no GitHub Actions (.github/workflows/dados.yml).
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "dados" / "mercado.json"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"


def baixar(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9"})
    with urllib.request.urlopen(req, timeout=60) as r:
        dados = r.read()
        charset = r.headers.get_content_charset() or "iso-8859-1"
    return dados.decode(charset, errors="replace")


class Tabela(HTMLParser):
    """Extrai a primeira <table> como lista de linhas (cabeçalho incluso)."""

    def __init__(self):
        super().__init__()
        self.linhas, self.linha, self.celula = [], None, None
        self.dentro = 0

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self.dentro += 1
        elif self.dentro and tag == "tr":
            self.linha = []
        elif self.dentro and tag in ("td", "th"):
            self.celula = ""

    def handle_endtag(self, tag):
        if tag == "table":
            self.dentro -= 1
        elif self.dentro and tag in ("td", "th") and self.linha is not None and self.celula is not None:
            self.linha.append(" ".join(self.celula.split()))
            self.celula = None
        elif self.dentro and tag == "tr" and self.linha:
            self.linhas.append(self.linha)
            self.linha = None

    def handle_data(self, data):
        if self.celula is not None:
            self.celula += data


def num(txt):
    """'1.234,56%' -> 1234.56 ; vazio ou inválido -> None"""
    t = txt.replace("%", "").replace(".", "").replace(",", ".").strip()
    try:
        v = float(t)
    except ValueError:
        return None
    return round(v, 4)


def normalizar(h):
    h = h.lower()
    for a, b in (("á", "a"), ("ã", "a"), ("â", "a"), ("é", "e"), ("ê", "e"), ("í", "i"), ("ó", "o"), ("ç", "c")):
        h = h.replace(a, b)
    return re.sub(r"[^a-z0-9/]", "", h)


def tabela(url):
    p = Tabela()
    p.feed(baixar(url))
    if len(p.linhas) < 2:
        raise RuntimeError(f"tabela vazia em {url}")
    cab = [normalizar(h) for h in p.linhas[0]]
    return cab, p.linhas[1:]


def coluna(cab, *nomes):
    for n in nomes:
        if n in cab:
            return cab.index(n)
    raise RuntimeError(f"coluna não encontrada: {nomes} em {cab}")


def acoes():
    cab, linhas = tabela("https://www.fundamentus.com.br/resultado.php")
    c = {
        "papel": coluna(cab, "papel"),
        "preco": coluna(cab, "cotacao"),
        "pl": coluna(cab, "p/l"),
        "pvp": coluna(cab, "p/vp"),
        "dy": coluna(cab, "divyield", "dividendyield"),
        "roe": coluna(cab, "roe"),
        "margem": coluna(cab, "mrgliq", "margemliquida"),
        "divPl": coluna(cab, "divliq/patrim", "divbrut/patrim", "divbrut/patrimonio"),
        "cresc": coluna(cab, "crescrec5a"),
        "liq": coluna(cab, "liq2meses"),
    }
    out = {}
    for l in linhas:
        if len(l) < len(cab):
            continue
        d = {k: num(l[i]) for k, i in c.items() if k != "papel"}
        # Ignora papéis sem negociação recente
        if not d["preco"] or not d["liq"]:
            continue
        # Bancos e seguradoras aparecem com margem e dívida zeradas (não se aplicam)
        if not d.get("margem") and not d.get("divPl"):
            d.pop("margem", None)
            d.pop("divPl", None)
            d["banco"] = True
        out[l[c["papel"]].upper()] = {k: v for k, v in d.items() if v is not None}
    return out


def fiis():
    cab, linhas = tabela("https://www.fundamentus.com.br/fii_resultado.php")
    c = {
        "papel": coluna(cab, "papel"),
        "segmento": coluna(cab, "segmento"),
        "preco": coluna(cab, "cotacao"),
        "dy": coluna(cab, "dividendyield"),
        "pvp": coluna(cab, "p/vp"),
        "nAtivos": coluna(cab, "qtddeimoveis", "qtdimoveis"),
        "vacancia": coluna(cab, "vacanciamedia"),
        "liq": coluna(cab, "liquidez"),
    }
    out = {}
    for l in linhas:
        if len(l) < len(cab):
            continue
        d = {k: num(l[i]) for k, i in c.items() if k not in ("papel", "segmento")}
        if not d["preco"] or not d["liq"]:
            continue
        d.pop("liq")
        # Fundos de papel aparecem com 0 imóveis e 0% de vacância: não são informações úteis
        if not d.get("nAtivos"):
            d.pop("nAtivos", None)
            d.pop("vacancia", None)
        d = {k: v for k, v in d.items() if v is not None}
        d["segmento"] = l[c["segmento"]]
        out[l[c["papel"]].upper()] = d
    return out


def etf_yahoo_lote(tickers):
    """Yahoo exige cookie de sessão + 'crumb'; depois uma requisição traz todos os ETFs."""
    import http.cookiejar
    jar = http.cookiejar.CookieJar()
    abridor = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    cab = {"User-Agent": UA, "Accept": "*/*"}

    def get(url):
        with abridor.open(urllib.request.Request(url, headers=cab), timeout=30) as r:
            return r.read().decode("utf-8", errors="replace")

    try:
        get("https://fc.yahoo.com/")
    except Exception:
        pass  # responde 404, mas grava o cookie
    crumb = get("https://query2.finance.yahoo.com/v1/test/getcrumb").strip()
    if not crumb or "<" in crumb:
        raise RuntimeError("crumb inválido")
    out = {}
    for i in range(0, len(tickers), 40):
        lote = ",".join(f"{t}.SA" for t in tickers[i:i + 40])
        d = json.loads(get(f"https://query2.finance.yahoo.com/v7/finance/quote?symbols={lote}&crumb={urllib.parse.quote(crumb)}"))
        for q in d.get("quoteResponse", {}).get("result", []):
            preco = q.get("regularMarketPrice")
            if preco:
                item = {"preco": round(preco, 4)}
                if q.get("regularMarketChangePercent") is not None:
                    item["varDia"] = round(q["regularMarketChangePercent"], 2)
                out[q["symbol"].replace(".SA", "")] = item
    return out


def procurar(obj, chave):
    """Busca recursiva de uma chave em JSON aninhado."""
    if isinstance(obj, dict):
        if chave in obj:
            return obj[chave]
        obj = list(obj.values())
    if isinstance(obj, list):
        for v in obj:
            r = procurar(v, chave)
            if r is not None:
                return r
    return None


def etf_b3(t):
    d = json.loads(baixar(f"https://cotacao.b3.com.br/mds/api/v1/instrumentQuotation/{t}"))
    preco = procurar(d, "curPrc")
    if not preco:
        raise RuntimeError("preço não encontrado")
    item = {"preco": round(float(preco), 4)}
    var = procurar(d, "prcFlcn")
    if var is not None:
        item["varDia"] = round(float(var), 2)
    return item


def etf_google(t):
    req = urllib.request.Request(f"https://www.google.com/finance/quote/{t}:BVMF?hl=en",
                                 headers={"User-Agent": UA, "Cookie": "CONSENT=YES+cb; SOCS=CAI"})
    with urllib.request.urlopen(req, timeout=30) as r:
        html = r.read().decode("utf-8", errors="replace")
    m = re.search(r'data-last-price="([\d.]+)"', html)
    if not m:
        raise RuntimeError("preço não encontrado")
    item = {"preco": round(float(m.group(1)), 4)}
    ant = re.search(r"Previous close.*?R\$\s?([\d,]+\.\d+)", html, re.S)
    if ant:
        a = float(ant.group(1).replace(",", ""))
        if a:
            item["varDia"] = round((item["preco"] / a - 1) * 100, 2)
    return item


def etf_statusinvest(t):
    html = baixar(f"https://statusinvest.com.br/etfs/{t.lower()}")
    m = re.search(r'title="Valor atual do ativo".*?<strong class="value">\s*([\d.,]+)\s*<', html, re.S)
    if not m:
        raise RuntimeError("preço não encontrado")
    return {"preco": num(m.group(1))}


def etfs():
    # Usa a mesma lista de ETFs do site
    js = (RAIZ / "fundamentos.js").read_text(encoding="utf-8")
    bloco = re.search(r"const ETFS = new Set\(\[(.*?)\]\)", js, re.S).group(1)
    tickers = re.findall(r"'([A-Z0-9]+)'", bloco)
    out = {}
    try:
        out.update(etf_yahoo_lote(tickers))
        print(f"etfs via Yahoo: {len(out)}")
    except Exception as e:
        print(f"aviso: Yahoo indisponível: {e}", file=sys.stderr)
    for fonte in (etf_b3, etf_google, etf_statusinvest):
        faltando = [t for t in tickers if t not in out]
        if not faltando:
            break
        erros = 0
        for t in faltando:
            try:
                out[t] = fonte(t)
            except Exception as e:
                erros += 1
                print(f"aviso: {fonte.__name__} {t}: {e}", file=sys.stderr)
                if erros >= 5 and erros == len(faltando[: faltando.index(t) + 1]):
                    print(f"aviso: {fonte.__name__} parece bloqueado, pulando", file=sys.stderr)
                    break
            time.sleep(0.5)
        print(f"etfs após {fonte.__name__}: {len(out)}")
    return out


def mediana(vals):
    v = sorted(x for x in vals if x is not None)
    if not v:
        return None
    m = len(v) // 2
    return round(v[m] if len(v) % 2 else (v[m - 1] + v[m]) / 2, 2)


def setor_da_acao(t):
    html = baixar(f"https://www.fundamentus.com.br/detalhes.php?papel={t}")
    m = re.search(r">Setor<.*?<a[^>]*>([^<]+)</a>", html, re.S)
    if not m:
        raise RuntimeError("setor não encontrado")
    return " ".join(m.group(1).split())


def setores(acoes_dados, anterior_acoes):
    """Associa cada ação ao seu setor (página de detalhes do Fundamentus) e calcula as medianas por setor.
    O setor raramente muda, então reaproveita o da execução anterior e só consulta ações novas."""
    novos = erros = 0
    for t, d in acoes_dados.items():
        antigo = (anterior_acoes.get(t) or {}).get("setor")
        if antigo:
            d["setor"] = antigo
            continue
        try:
            d["setor"] = setor_da_acao(t)
            novos += 1
        except Exception as e:
            erros += 1
            if erros <= 5:
                print(f"aviso: setor {t}: {e}", file=sys.stderr)
        time.sleep(0.25)
    grupos = {}
    for t, d in acoes_dados.items():
        # Só ações com liquidez relevante (> R$ 1 milhão/dia) entram na mediana: as quase sem negócios distorcem
        if d.get("setor") and (d.get("liq") or 0) >= 1_000_000:
            grupos.setdefault(d["setor"], []).append(d)
    out = {}
    for nome, dados in grupos.items():
        if len(dados) < 3:
            continue
        med = {"n": len(dados)}
        for k in ("pl", "pvp", "roe", "margem", "dy", "divPl"):
            # P/L negativo (prejuízo) não entra na mediana
            vals = [d.get(k) for d in dados if not (k == "pl" and (d.get(k) or 0) <= 0)]
            mv = mediana(vals)
            if mv is not None:
                med[k] = mv
        out[nome] = med
    classificadas = sum(1 for d in acoes_dados.values() if d.get("setor"))
    print(f"setores: {len(out)} com mediana, {classificadas} ações classificadas ({novos} consultadas agora, {erros} erros)")
    return out


def etf_eua_nasdaq(t):
    req = urllib.request.Request(f"https://api.nasdaq.com/api/quote/{t}/info?assetclass=etf", headers={
        "User-Agent": UA, "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.nasdaq.com", "Referer": "https://www.nasdaq.com/"})
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.loads(r.read().decode("utf-8"))
    pd = (d.get("data") or {}).get("primaryData") or {}
    preco = float(str(pd["lastSalePrice"]).replace("$", "").replace(",", ""))
    item = {"precoUSD": round(preco, 4)}
    var = str(pd.get("percentageChange") or "").replace("%", "").replace("+", "")
    if var:
        item["varDia"] = round(float(var), 2)
    return item


def etf_eua_stooq(t):
    csv = baixar(f"https://stooq.com/q/l/?s={t.lower()}.us&f=sd2t2ohlc&h&e=csv").strip().splitlines()
    cab, val = csv[0].lower().split(","), csv[1].split(",")
    return {"precoUSD": round(float(val[cab.index("close")]), 4)}


def etfs_eua():
    """Cotação em dólar de ETFs americanos (Nasdaq; Stooq como alternativa)."""
    js = (RAIZ / "fundamentos.js").read_text(encoding="utf-8")
    bloco = re.search(r"const ETFS_EUA = new Set\(\[(.*?)\]\)", js, re.S).group(1)
    out = {}
    for fonte in (etf_eua_nasdaq, etf_eua_stooq):
        erros = 0
        for t in re.findall(r"'([A-Z]+)'", bloco):
            if t in out:
                continue
            try:
                out[t] = fonte(t)
            except Exception as e:
                erros += 1
                print(f"aviso: {fonte.__name__} {t}: {e}", file=sys.stderr)
                if erros >= 5 and not out:
                    break
            time.sleep(0.3)
    return out


def sgs(codigo):
    """Último valor de uma série do Sistema Gerenciador de Séries do Banco Central."""
    d = json.loads(baixar(f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados/ultimos/1?formato=json"))
    return float(str(d[-1]["valor"]).replace(",", ".")), d[-1]["data"]


def focus(indicador, ano):
    """Mediana mais recente do Boletim Focus para o ano."""
    filtro = urllib.parse.quote(f"Indicador eq '{indicador}' and DataReferencia eq '{ano}' and baseCalculo eq 0")
    url = ("https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais"
           f"?$top=1&$filter={filtro}&$orderby=Data%20desc&$format=json&$select=Data,Mediana")
    v = json.loads(baixar(url))["value"]
    if not v:
        raise RuntimeError(f"Focus sem dados para {indicador}")
    return float(v[0]["Mediana"])


def taxa_ipca_longo():
    """Taxa de compra do Tesouro IPCA+ (sem cupons) de vencimento mais longo, no dia mais recente."""
    url = ("https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/"
           "resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv")
    linhas = baixar(url).splitlines()
    cab = [c.strip() for c in linhas[0].split(";")]
    iT, iV, iD, iTx = (cab.index(c) for c in ("Tipo Titulo", "Data Vencimento", "Data Base", "Taxa Compra Manha"))
    melhor = None
    for l in linhas[1:]:
        c = l.split(";")
        if len(c) <= iTx or c[iT].strip() != "Tesouro IPCA+":
            continue
        base = datetime.strptime(c[iD], "%d/%m/%Y")
        venc = datetime.strptime(c[iV], "%d/%m/%Y")
        taxa = num(c[iTx])
        if not taxa:
            continue
        chave = (base, venc)
        if melhor is None or chave > melhor[0]:
            melhor = (chave, taxa)
    if not melhor:
        raise RuntimeError("Tesouro IPCA+ não encontrado")
    return melhor[1]


def baixar_rapido(url, timeout=20, cabecalhos=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(cabecalhos or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="replace")


def fred(serie):
    """Série do FRED (Federal Reserve de St. Louis) em CSV público, sem chave. Retorna [(data, valor)]."""
    inicio = (datetime.now().replace(year=datetime.now().year - 2)).strftime("%Y-%m-%d")
    linhas = baixar_rapido(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={serie}&cosd={inicio}").strip().splitlines()[1:]
    out = []
    for l in linhas:
        d, _, v = l.partition(",")
        try:
            out.append((datetime.strptime(d, "%Y-%m-%d"), float(v)))
        except ValueError:
            pass  # valores ausentes vêm como "."
    if not out:
        raise RuntimeError(f"FRED {serie} vazio")
    return out


def fed_funds_nyfed():
    """Banda da meta de juros dos EUA pela API pública do Fed de Nova York: [(data, teto)]."""
    d = json.loads(baixar_rapido("https://markets.newyorkfed.org/api/rates/unsecured/effr/last/200.json",
                                 cabecalhos={"Accept": "application/json"}))
    out = []
    for r in d.get("refRates", []):
        teto = r.get("targetRateTo")
        if teto is not None:
            out.append((datetime.strptime(r["effectiveDate"], "%Y-%m-%d"), float(teto)))
    if not out:
        raise RuntimeError("NY Fed sem dados")
    return sorted(out)


def inflacao_bls():
    """Núcleo do CPI dos EUA em 12 meses (API pública v1 do BLS, sem chave)."""
    d = json.loads(baixar_rapido("https://api.bls.gov/publicAPI/v1/timeseries/data/CUUR0000SA0L1E"))
    dados = d["Results"]["series"][0]["data"]  # mais recente primeiro
    serie = {(int(x["year"]), x["period"]): float(x["value"]) for x in dados if x["period"].startswith("M") and x["period"] != "M13"}
    ano, per = max(serie)
    anterior = serie.get((ano - 1, per))
    if not anterior:
        raise RuntimeError("BLS sem mês comparável")
    return (serie[(ano, per)] / anterior - 1) * 100


def macro_eua(out):
    """Juros (teto da meta dos Fed Funds), tendência e inflação dos EUA, com fontes alternativas."""
    fed = None
    for fonte in (lambda: fred("DFEDTARU"), fed_funds_nyfed):
        try:
            fed = fonte()
            break
        except Exception as e:
            print(f"aviso: juros EUA: {e}", file=sys.stderr)
    if fed:
        atual_d, atual = fed[-1]
        antes = [v for d, v in fed if (atual_d - d).days >= 120]
        out["fedFunds"] = round(atual, 2)
        if antes:
            dif = atual - antes[-1]
            out["tendenciaFed"] = "alta" if dif > 0.1 else "corte" if dif < -0.1 else "estavel"
    try:
        pce = fred("PCEPILFE")
        if len(pce) >= 13:
            out["inflacaoEUA"] = round((pce[-1][1] / pce[-13][1] - 1) * 100, 2)
    except Exception as e:
        print(f"aviso: inflação EUA (PCE/FRED): {e}", file=sys.stderr)
        try:
            out["inflacaoEUA"] = round(inflacao_bls(), 2)
        except Exception as e2:
            print(f"aviso: inflação EUA (CPI/BLS): {e2}", file=sys.stderr)


def macro():
    out = {}
    ano = datetime.now().year
    tarefas = {
        "selic": lambda: sgs(432)[0],          # meta Selic
        "ipca12m": lambda: sgs(13522)[0],      # IPCA acumulado em 12 meses
        "dolar": lambda: sgs(1)[0],            # dólar PTAX (venda)
        "selicFocusFimAno": lambda: focus("Selic", ano),
        "ipcaFocusAno": lambda: focus("IPCA", ano),
        "pibFocusAno": lambda: focus("PIB Total", ano),
        "dolarFocusFimAno": lambda: focus("Câmbio", ano),
        "taxaIpcaLongo": taxa_ipca_longo,
    }
    for k, fn in tarefas.items():
        try:
            out[k] = round(fn(), 2)
        except Exception as e:
            print(f"aviso: macro {k}: {e}", file=sys.stderr)
    macro_eua(out)
    if "selic" in out and "selicFocusFimAno" in out:
        dif = out["selicFocusFimAno"] - out["selic"]
        out["tendenciaSelic"] = "corte" if dif <= -0.2 else "alta" if dif >= 0.2 else "estavel"
    if out:
        out["dataReferencia"] = datetime.now(timezone.utc).date().isoformat()
    print(f"macro: {out}")
    return out


def main():
    anterior = {}
    if SAIDA.exists():
        anterior = json.loads(SAIDA.read_text(encoding="utf-8"))
    resultado = {"atualizadoEm": datetime.now(timezone.utc).isoformat(timespec="seconds"), "fontes": {}}
    for nome, fn, fonte in (("acoes", acoes, "Fundamentus"), ("fiis", fiis, "Fundamentus"), ("etfs", etfs, "Yahoo Finance"),
                            ("etfsEUA", etfs_eua, "Stooq")):
        try:
            resultado[nome] = fn()
            resultado["fontes"][nome] = fonte
            print(f"{nome}: {len(resultado[nome])} ativos")
        except Exception as e:
            # Mantém os dados anteriores dessa parte se a fonte falhar
            print(f"ERRO em {nome}: {e}", file=sys.stderr)
            resultado[nome] = anterior.get(nome, {})
            resultado["fontes"][nome] = anterior.get("fontes", {}).get(nome, fonte) + " (dados anteriores)"
    try:
        if resultado.get("acoes"):
            resultado["setores"] = setores(resultado["acoes"], anterior.get("acoes", {})) or anterior.get("setores", {})
    except Exception as e:
        print(f"ERRO em setores: {e}", file=sys.stderr)
        resultado["setores"] = anterior.get("setores", {})
    try:
        resultado["macro"] = macro() or anterior.get("macro", {})
    except Exception as e:
        print(f"ERRO em macro: {e}", file=sys.stderr)
        resultado["macro"] = anterior.get("macro", {})
    if not any(resultado[k] for k in ("acoes", "fiis", "etfs", "etfsEUA")):
        sys.exit("nenhuma fonte respondeu")
    SAIDA.parent.mkdir(exist_ok=True)
    SAIDA.write_text(json.dumps(resultado, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    main()
