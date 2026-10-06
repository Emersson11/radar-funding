"""Coleta de hora em hora: panorama do mercado, notícias (títulos e links) e calendário econômico.
Grava mercado.json, que o site lê. Cada parte é independente: se uma fonte falhar, mantém o dado anterior."""
import json
import pathlib
import time
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

import requests

ARQ = pathlib.Path(__file__).with_name("mercado.json")
S = requests.Session()
S.headers["User-Agent"] = "Mozilla/5.0 (painel-cripto; +https://github.com/Emersson11/radar-funding)"
FEEDS = [("Portal do Bitcoin", "https://portaldobitcoin.uol.com.br/feed/"),
         ("Cointelegraph Brasil", "https://br.cointelegraph.com/rss"),
         ("Livecoins", "https://livecoins.com.br/feed/"),
         ("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/")]
CALENDARIOS = ["https://nfs.faireconomy.media/ff_calendar_thisweek.json",
               "https://nfs.faireconomy.media/ff_calendar_nextweek.json"]


def panorama():
    d = S.get("https://api.coingecko.com/api/v3/global", timeout=20).json()["data"]
    return {"cap": d["total_market_cap"]["usd"], "vol": d["total_volume"]["usd"],
            "dom_btc": d["market_cap_percentage"]["btc"], "dom_eth": d["market_cap_percentage"].get("eth"),
            "var24": d["market_cap_change_percentage_24h_usd"]}


def medo_ganancia():
    d = S.get("https://api.alternative.me/fng/?limit=1", timeout=20).json()["data"][0]
    return {"valor": int(d["value"]), "classe": d["value_classification"]}


def noticias():
    out, falhas = [], []
    for fonte, url in FEEDS:
        try:
            raiz = ET.fromstring(S.get(url, timeout=20).content)
            n = 0
            for it in raiz.iter("item"):
                titulo, link, data = (it.findtext("title") or "").strip(), (it.findtext("link") or "").strip(), it.findtext("pubDate")
                if not titulo or not link.startswith("http"):
                    continue
                try:
                    t = int(parsedate_to_datetime(data).timestamp())
                except Exception:
                    t = int(time.time())
                out.append({"titulo": titulo[:200], "link": link, "fonte": fonte, "t": t})
                n += 1
                if n >= 10:
                    break
        except Exception:
            falhas.append(fonte)
    if not out:
        raise RuntimeError("nenhuma fonte de notícias respondeu")
    out.sort(key=lambda x: -x["t"])
    return out[:40], falhas


def calendario():
    ev = []
    for url in CALENDARIOS:
        try:
            for e in S.get(url, timeout=20).json():
                ev.append({"data": e["date"], "moeda": e.get("country", ""), "titulo": e.get("title", ""),
                           "impacto": e.get("impact", ""), "previsao": e.get("forecast", ""), "anterior": e.get("previous", "")})
        except Exception:
            pass
    if not ev:
        raise RuntimeError("calendário sem resposta")
    return ev


def main():
    m = json.loads(ARQ.read_text()) if ARQ.exists() else {}
    erros = []
    for chave, fn in (("panorama", panorama), ("fng", medo_ganancia), ("calendario", calendario)):
        try:
            m[chave] = fn()
        except Exception as e:
            erros.append(f"{chave}: {e}")
    try:
        m["noticias"], falhas = noticias()
        erros += ["notícias sem resposta: " + f for f in falhas]
    except Exception as e:
        erros.append(f"noticias: {e}")
    m["t"] = int(time.time())
    m["erros"] = erros
    ARQ.write_text(json.dumps(m, ensure_ascii=False))
    print("ok" if not erros else "com falhas:\n" + "\n".join(erros))


if __name__ == "__main__":
    main()
