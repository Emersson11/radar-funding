"""Leitura das taxas de funding e cálculo das oportunidades (mesma lógica do site)."""
import time
import requests

NOMES = {"binance": "Binance", "bybit": "Bybit", "okx": "OKX", "bitget": "Bitget",
         "gate": "Gate", "hyper": "Hyperliquid", "dydx": "dYdX"}
S = requests.Session()
S.headers["User-Agent"] = "radar-funding/1.0"


def get(url, **kw):
    r = S.get(url, timeout=20, **kw)
    r.raise_for_status()
    return r.json()


def post(url, body):
    r = S.post(url, json=body, timeout=20)
    r.raise_for_status()
    return r.json()


def norm(b):
    for p in ("1000000", "10000", "1000", "1M"):
        if b.startswith(p) and len(b) > len(p):
            b = b[len(p):]
            break
    if len(b) > 1 and b[0] == "k" and b[1].isupper():
        b = b[1:]
    return b.upper()


def linha(b, rate, h, vol, sym):
    try:
        rate, h, vol = float(rate), float(h), float(vol or 0)
    except (TypeError, ValueError):
        return None
    if h <= 0:
        return None
    return {"b": norm(b), "apr": rate * (24 / h) * 365, "h": h, "vol": vol, "sym": sym}


def _binance():
    pi = get("https://fapi.binance.com/fapi/v1/premiumIndex")
    info = {x["symbol"]: x["fundingIntervalHours"] for x in get("https://fapi.binance.com/fapi/v1/fundingInfo")}
    vol = {x["symbol"]: x["quoteVolume"] for x in get("https://fapi.binance.com/fapi/v1/ticker/24hr")}
    return [linha(x["symbol"][:-4], x["lastFundingRate"], info.get(x["symbol"], 8), vol.get(x["symbol"]), x["symbol"])
            for x in pi if x["symbol"].endswith("USDT") and "_" not in x["symbol"]]


def _bybit():
    l = get("https://api.bybit.com/v5/market/tickers?category=linear")["result"]["list"]
    return [linha(x["symbol"][:-4], x["fundingRate"], x.get("fundingIntervalHour") or 8, x["turnover24h"], x["symbol"])
            for x in l if x["symbol"].endswith("USDT") and "-" not in x["symbol"] and x.get("fundingRate")]


def _okx():
    f = get("https://www.okx.com/api/v5/public/funding-rate?instId=ANY")["data"]
    vol = {x["instId"]: float(x["volCcy24h"] or 0) * float(x["last"] or 0)
           for x in get("https://www.okx.com/api/v5/market/tickers?instType=SWAP")["data"]}
    out = []
    for x in f:
        if not x["instId"].endswith("-USDT-SWAP"):
            continue
        h = (float(x["nextFundingTime"] or 0) - float(x["fundingTime"] or 0)) / 3.6e6
        out.append(linha(x["instId"].split("-")[0], x["fundingRate"], h if h > 0 else 8, vol.get(x["instId"]), x["instId"]))
    return out


def _bitget():
    f = get("https://api.bitget.com/api/v2/mix/market/current-fund-rate?productType=USDT-FUTURES")["data"]
    vol = {x["symbol"]: x["usdtVolume"] for x in get("https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES")["data"]}
    return [linha(x["symbol"][:-4], x["fundingRate"], x.get("fundingRateInterval") or 8, vol.get(x["symbol"]), x["symbol"])
            for x in f if x["symbol"].endswith("USDT")]


def _gate():
    c = get("https://api.gateio.ws/api/v4/futures/usdt/contracts")
    vol = {x["contract"]: x["volume_24h_quote"] for x in get("https://api.gateio.ws/api/v4/futures/usdt/tickers")}
    return [linha(x["name"][:-5], x["funding_rate"], (x.get("funding_interval") or 28800) / 3600, vol.get(x["name"]), x["name"])
            for x in c if x["name"].endswith("_USDT") and not x.get("in_delisting")]


def _hyper():
    meta, ctx = post("https://api.hyperliquid.xyz/info", {"type": "metaAndAssetCtxs"})
    return [linha(u["name"], c["funding"], 1, c["dayNtlVlm"], u["name"])
            for u, c in zip(meta["universe"], ctx) if not u.get("isDelisted")]


def _dydx():
    m = get("https://indexer.dydx.trade/v4/perpetualMarkets")["markets"]
    return [linha(x["ticker"].split("-")[0], x["nextFundingRate"], 1, x["volume24H"], x["ticker"])
            for x in m.values() if x["status"] == "ACTIVE" and x["ticker"].endswith("-USD")]


FONTES = {"binance": _binance, "bybit": _bybit, "okx": _okx, "bitget": _bitget,
          "gate": _gate, "hyper": _hyper, "dydx": _dydx}


def carregar(fontes=None):
    """Devolve ({corretora: {ativo: linha}}, [corretoras que falharam])."""
    dados, falhas = {}, []
    for v in (fontes or FONTES):
        try:
            m = {}
            for r in FONTES[v]():
                if r and (r["b"] not in m or m[r["b"]]["vol"] < r["vol"]):
                    m[r["b"]] = r
            dados[v] = m
        except Exception:
            falhas.append(v)
    return dados, falhas


def _hist(v, sym):
    t30 = int((time.time() - 30 * 86400) * 1000)
    if v == "binance":
        return [(x["fundingTime"], float(x["fundingRate"])) for x in get(f"https://fapi.binance.com/fapi/v1/fundingRate?symbol={sym}&startTime={t30}&limit=1000")]
    if v == "bybit":
        return [(int(x["fundingRateTimestamp"]), float(x["fundingRate"])) for x in get(f"https://api.bybit.com/v5/market/funding/history?category=linear&symbol={sym}&limit=200")["result"]["list"]]
    if v == "okx":
        return [(int(x["fundingTime"]), float(x.get("realizedRate") or x["fundingRate"])) for x in get(f"https://www.okx.com/api/v5/public/funding-rate-history?instId={sym}&limit=100")["data"]]
    if v == "bitget":
        return [(int(x["fundingTime"]), float(x["fundingRate"])) for x in get(f"https://api.bitget.com/api/v2/mix/market/history-fund-rate?symbol={sym}&productType=USDT-FUTURES&pageSize=100")["data"]]
    if v == "gate":
        return [(x["t"] * 1000, float(x["r"])) for x in get(f"https://api.gateio.ws/api/v4/futures/usdt/funding_rate?contract={sym}&limit=100")]
    if v == "hyper":
        m = {}
        for t0 in (t30, t30 + 15 * 86400 * 1000):
            for x in post("https://api.hyperliquid.xyz/info", {"type": "fundingHistory", "coin": sym, "startTime": t0}):
                m[x["time"]] = float(x["fundingRate"])
        return list(m.items())
    if v == "dydx":
        from datetime import datetime
        return [(datetime.fromisoformat(x["effectiveAt"].replace("Z", "+00:00")).timestamp() * 1000, float(x["rate"]))
                for x in get(f"https://indexer.dydx.trade/v4/historicalFunding/{sym}?limit=720")["historicalFunding"]]
    return []


def medias(v, r):
    """Médias anualizadas de 7 e 30 dias; None quando não há histórico."""
    try:
        pts = _hist(v, r["sym"])
    except Exception:
        return None
    agora, f = time.time() * 1000, (24 / r["h"]) * 365
    p7 = [x for t, x in pts if t >= agora - 7 * 86400e3]
    p30 = [x for t, x in pts if t >= agora - 30 * 86400e3]
    if not p30:
        return None
    return {"a7": sum(p7) / len(p7) * f if p7 else None, "a30": sum(p30) / len(p30) * f}


def oportunidades(dados, min_vol=5e7, pausa=0.15):
    """Pares entre corretoras, positivos agora e na média de 30 dias, do maior para o menor."""
    por = {}
    for v, m in dados.items():
        for b, r in m.items():
            if r["vol"] >= min_vol:
                por.setdefault(b, []).append((v, r))
    out = []
    for b, l in por.items():
        if len(l) < 2:
            continue
        com = []
        for v, r in l:
            h = medias(v, r)
            time.sleep(pausa)
            if h:
                com.append((v, r, h))
        if len(com) < 2:
            continue
        com.sort(key=lambda x: -x[2]["a30"])
        hi, lo = com[0], com[-1]
        d30, agora = hi[2]["a30"] - lo[2]["a30"], hi[1]["apr"] - lo[1]["apr"]
        if d30 > 0 and agora > 0:
            d7 = hi[2]["a7"] - lo[2]["a7"] if hi[2]["a7"] is not None and lo[2]["a7"] is not None else None
            out.append({"ativo": b, "vender": hi[0], "comprar": lo[0], "agora": agora, "d7": d7, "d30": d30,
                        "sym_vender": hi[1]["sym"], "sym_comprar": lo[1]["sym"],
                        "apr_vender": hi[1]["apr"], "apr_comprar": lo[1]["apr"]})
    return sorted(out, key=lambda x: -x["d30"])


def pct(v):
    return ("+" if v >= 0 else "") + f"{v * 100:.1f}%".replace(".", ",")


def telegram(texto):
    import os
    tok, chat = os.environ.get("TELEGRAM_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    if not tok:
        print("[sem Telegram configurado]\n" + texto)
        return False
    if not chat:   # sem chat definido: usa a conversa mais recente que escreveu para o bot
        try:
            resp = requests.get(f"https://api.telegram.org/bot{tok.strip()}/getUpdates", timeout=20).json()
            if not resp.get("ok"):
                print("[Telegram recusou o token: " + str(resp.get("description")) + "]\n" + texto)
                return False
            chat = [u["message"]["chat"]["id"] for u in resp.get("result", []) if "message" in u][-1]
        except Exception:
            print("[bot sem conversa: envie uma mensagem para ele]\n" + texto)
            return False
    tok = tok.strip()
    r = requests.post(f"https://api.telegram.org/bot{tok.strip()}/sendMessage", json={"chat_id": chat, "text": texto}, timeout=20)
    print("Telegram: enviado" if r.ok else "Telegram: falhou (" + str(r.json().get("description")) + ")")
    return r.ok
