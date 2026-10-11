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
        "divPl": coluna(cab, "divbrut/patrim", "divbrut/patrimonio"),
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
        d.pop("liq")
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


def etfs():
    # Usa a mesma lista de ETFs do site
    js = (RAIZ / "fundamentos.js").read_text(encoding="utf-8")
    bloco = re.search(r"const ETFS = new Set\(\[(.*?)\]\)", js, re.S).group(1)
    tickers = re.findall(r"'([A-Z0-9]+)'", bloco)
    out = {}
    for t in tickers:
        try:
            d = json.loads(baixar(f"https://query1.finance.yahoo.com/v8/finance/chart/{t}.SA?range=5d&interval=1d"))
            meta = d["chart"]["result"][0]["meta"]
            preco = meta.get("regularMarketPrice")
            ant = meta.get("chartPreviousClose") or meta.get("previousClose")
            if preco:
                item = {"preco": round(preco, 4)}
                if ant:
                    item["varDia"] = round((preco / ant - 1) * 100, 2)
                out[t] = item
        except Exception as e:  # um ETF com problema não deve derrubar o resto
            print(f"aviso: {t}: {e}", file=sys.stderr)
        time.sleep(0.3)
    return out


def main():
    anterior = {}
    if SAIDA.exists():
        anterior = json.loads(SAIDA.read_text(encoding="utf-8"))
    resultado = {"atualizadoEm": datetime.now(timezone.utc).isoformat(timespec="seconds"), "fontes": {}}
    for nome, fn, fonte in (("acoes", acoes, "Fundamentus"), ("fiis", fiis, "Fundamentus"), ("etfs", etfs, "Yahoo Finance")):
        try:
            resultado[nome] = fn()
            resultado["fontes"][nome] = fonte
            print(f"{nome}: {len(resultado[nome])} ativos")
        except Exception as e:
            # Mantém os dados anteriores dessa parte se a fonte falhar
            print(f"ERRO em {nome}: {e}", file=sys.stderr)
            resultado[nome] = anterior.get(nome, {})
            resultado["fontes"][nome] = anterior.get("fontes", {}).get(nome, fonte) + " (dados anteriores)"
    if not any(resultado[k] for k in ("acoes", "fiis", "etfs")):
        sys.exit("nenhuma fonte respondeu")
    SAIDA.parent.mkdir(exist_ok=True)
    SAIDA.write_text(json.dumps(resultado, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    main()
