"""Histórico de 5 anos para comparar cada ativo com o próprio passado e medir risco.

- Preços mensais (Yahoo Finance, ajustados por desdobramentos e proventos): volatilidade,
  maior queda e correlação entre os ativos da carteira (calculadas no site).
- Lucro líquido anual (dados abertos da CVM, demonstrações anuais DFP): anos com prejuízo,
  crescimento do lucro e P/L de cada ano, usando o preço médio do ano e o nº de ações atual.

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
            return out
        except Exception as e:
            ultimo = e
    raise RuntimeError(f"Yahoo: {ultimo}")


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
                if v is not None:
                    out.setdefault(cnpj, {})[exerc] = v
        print(f"DFP {ano}: {len(out)} empresas com lucro lido")
    return out


def numero_de_acoes(t):
    html = _get(f"https://www.fundamentus.com.br/detalhes.php?papel={t}", 30)
    m = re.search(r"Nro\. A[çc][õo]es.*?<span class=\"txt\">([\d.]+)<", html, re.S)
    if not m:
        raise RuntimeError("nº de ações não encontrado")
    return int(m.group(1).replace(".", ""))


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
    fila = sorted((x for x in lista if idade(x[0]) >= validade_dias), key=lambda x: (-idade(x[0]), -x[2]))[:limite_precos]

    erros = 0
    for t, simbolo, _ in fila:
        try:
            serie = precos_yahoo(simbolo)
        except Exception as e:
            erros += 1
            if erros <= 5:
                print(f"aviso: preços {t}: {e}", file=sys.stderr)
            if erros >= 15 and erros == fila.index((t, simbolo, _)) + 1:
                print("aviso: Yahoo parece bloqueado, parando", file=sys.stderr)
                break
            continue
        finally:
            time.sleep(0.4)
        item = ativos.get(t, {})
        item.update({"em": hoje.isoformat(), "m0": serie[0][0], "m": [sig(a) for _, _, a in serie]})
        # Preço médio de cada ano (sem ajuste por proventos), para o P/L histórico
        por_ano = {}
        for mes, c, _ in serie:
            por_ano.setdefault(mes[:4], []).append(c)
        item["precoAno"] = {a: sig(sum(v) / len(v)) for a, v in por_ano.items() if len(v) >= 6}
        ativos[t] = item
    print(f"histórico de preços: {len(ativos)} ativos ({len(fila) - erros} atualizados agora, {erros} erros)")

    # Lucros da CVM: renova uma vez por mês
    lucros_em = anterior.get("lucrosEm")
    velho = not lucros_em or (hoje - datetime.fromisoformat(lucros_em).date()).days >= 30
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

    # Nº de ações (para o P/L histórico): renova a cada 30 dias, no máximo 120 por execução
    pend = [t for t in ativos if t in acoes and ativos[t].get("lucros") and idade(t, "acoesEm") >= 30][:120]
    for t in pend:
        try:
            ativos[t]["nAcoes"] = numero_de_acoes(t)
            ativos[t]["acoesEm"] = hoje.isoformat()
        except Exception as e:
            print(f"aviso: nº de ações {t}: {e}", file=sys.stderr)
        time.sleep(0.25)

    # P/L de cada ano = preço médio do ano x nº de ações / lucro do ano
    for t, item in ativos.items():
        l, pa, n = item.get("lucros"), item.get("precoAno"), item.get("nAcoes")
        if not (l and pa and n):
            continue
        pl = {}
        for ano, lucro in l.items():
            if ano in pa and lucro:
                pl[ano] = round(pa[ano] * n / (lucro * 1e6), 1) if lucro > 0 else None
        item["pl"] = pl
        validos = [v for v in pl.values() if v and 0 < v < 200]
        if len(validos) >= 3:
            item["plMed"] = round(statistics.median(validos), 1)
        else:
            item.pop("plMed", None)

    exemplo = {t: (ativos.get(t, {}).get("plMed"), acoes.get(t, {}).get("pl")) for t in ("WEGE3", "ITUB4", "VALE3", "PETR4", "VIVT3") if t in ativos}
    print(f"P/L médio 5 anos vs atual (conferência): {exemplo}")
    return {"atualizadoEm": datetime.now(timezone.utc).isoformat(timespec="seconds"), "lucrosEm": lucros_em, "ativos": ativos}
