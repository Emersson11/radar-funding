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
# Cada fonte pode ter mais de um endereço; usa o primeiro que responder.
FEEDS = [("AllinCrypto", ["https://allincrypto.com/feed/"]),
         ("Bitcoin Magazine", ["https://bitcoinmagazine.com/feed", "https://bitcoinmagazine.com/.rss/full/"]),
         ("Coin Bureau", ["https://coinbureau.com/feed/", "https://www.coinbureau.com/feed/"]),
         ("CoinDesk", ["https://www.coindesk.com/arc/outboundfeeds/rss/"]),
         ("Cointelegraph", ["https://cointelegraph.com/rss"]),
         ("CryptoPotato", ["https://cryptopotato.com/feed/"]),
         ("CryptoSlate", ["https://cryptoslate.com/feed/"]),
         ("Decrypt", ["https://decrypt.co/feed"]),
         ("The Block", ["https://www.theblock.co/rss.xml"]),
         ("U.Today", ["https://u.today/rss"]),
         ("Portal do Bitcoin", ["https://portaldobitcoin.uol.com.br/feed/"]),
         ("Livecoins", ["https://livecoins.com.br/feed/"]),
         ("Cointelegraph Brasil", ["https://br.cointelegraph.com/rss"])]
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


def _itens(conteudo):
    """Lê RSS ou Atom e devolve (título, link, data)."""
    raiz = ET.fromstring(conteudo)
    for it in raiz.iter("item"):
        yield (it.findtext("title") or "").strip(), (it.findtext("link") or "").strip(), it.findtext("pubDate")
    A = "{http://www.w3.org/2005/Atom}"
    for it in raiz.iter(A + "entry"):
        link = it.find(A + "link")
        yield (it.findtext(A + "title") or "").strip(), (link.get("href", "") if link is not None else ""), it.findtext(A + "updated")


def _quando(data):
    try:
        return int(parsedate_to_datetime(data).timestamp())
    except Exception:
        try:
            from datetime import datetime
            return int(datetime.fromisoformat(data.replace("Z", "+00:00")).timestamp())
        except Exception:
            return int(time.time())


def noticias():
    out, falhas = [], []
    for fonte, urls in FEEDS:
        achou = 0
        for url in urls:
            try:
                r = S.get(url, timeout=20)
                for titulo, link, data in _itens(r.content):
                    if not titulo or not link.startswith("http"):
                        continue
                    out.append({"titulo": titulo[:200], "link": link, "fonte": fonte, "t": min(_quando(data), int(time.time()))})
                    achou += 1
                    if achou >= 12:
                        break
            except Exception:
                pass
            if achou:
                break
        if not achou:
            falhas.append(fonte)
    if not out:
        raise RuntimeError("nenhuma fonte de notícias respondeu")
    out.sort(key=lambda x: -x["t"])
    return out[:150], falhas


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
