"""Coletor do acervo: lê as fontes de fontes.yaml (notícias, casas de research, analistas, canais do Telegram,
órgãos oficiais) e grava acervo.json com as publicações dos últimos 30 dias.

Regras seguidas: respeita o robots.txt de cada site, não usa login, espera o intervalo de cada fonte entre coletas
e trata todo texto lido como dado. Como o repositório é público, guarda de cada publicação só o título, o endereço,
a fonte, a data e um trecho curto; o texto completo das casas não é republicado."""
import html
import json
import pathlib
import re
import time
import urllib.robotparser
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin, urlparse

import requests
import yaml

AQUI = pathlib.Path(__file__).parent
ARQ, EST = AQUI / "acervo.json", AQUI / "acervo_estado.json"
UA = "Mozilla/5.0 (compatible; painel-cripto/1.0; +https://github.com/Emersson11/radar-funding)"
DIAS, MAXIMO, TRECHO, PRAZO = 30, 6000, 280, 20
AGORA = int(time.time())
_robots = {}


def sessao():
    s = requests.Session()
    s.headers["User-Agent"] = UA
    s.headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    return s


def permitido(url):
    p = urlparse(url)
    base = f"{p.scheme}://{p.netloc}"
    if base not in _robots:
        rp = urllib.robotparser.RobotFileParser()
        try:
            r = sessao().get(base + "/robots.txt", timeout=10)
            rp.parse(r.text.splitlines() if r.status_code == 200 else [])
        except Exception:
            rp.parse([])
        _robots[base] = rp
    try:
        return _robots[base].can_fetch(UA, url)
    except Exception:
        return True


def limpa(t):
    t = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", t or "")
    t = re.sub(r"(?s)<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def quando(d):
    if not d:
        return AGORA
    try:
        return min(int(parsedate_to_datetime(d).timestamp()), AGORA)
    except Exception:
        try:
            from datetime import datetime
            return min(int(datetime.fromisoformat(d.strip().replace("Z", "+00:00")).timestamp()), AGORA)
        except Exception:
            return AGORA


def itens_feed(conteudo):
    """Devolve (titulo, link, data, trecho) de um feed RSS ou Atom. Levanta erro se não for feed."""
    raiz = ET.fromstring(conteudo)
    A = "{http://www.w3.org/2005/Atom}"
    C = "{http://purl.org/rss/1.0/modules/content/}"
    out = []
    for it in raiz.iter("item"):
        corpo = it.findtext(C + "encoded") or it.findtext("description") or ""
        out.append(((it.findtext("title") or "").strip(), (it.findtext("link") or "").strip(),
                    it.findtext("pubDate") or it.findtext("{http://purl.org/dc/elements/1.1/}date"), limpa(corpo)))
    for it in raiz.iter(A + "entry"):
        link = ""
        for l in it.findall(A + "link"):
            if l.get("rel") in (None, "alternate"):
                link = l.get("href") or link
        corpo = it.findtext(A + "content") or it.findtext(A + "summary") or ""
        out.append(((it.findtext(A + "title") or "").strip(), link,
                    it.findtext(A + "published") or it.findtext(A + "updated"), limpa(corpo)))
    if not out and raiz.tag not in ("rss", A + "feed") and not raiz.tag.endswith("RDF"):
        raise ValueError("não é feed")
    return out


def candidatos_feed(url, pagina):
    p = urlparse(url)
    base = f"{p.scheme}://{p.netloc}"
    c = []
    for m in re.finditer(r"(?is)<link\b[^>]*>", pagina or ""):
        tag = m.group(0)
        if re.search(r'type=["\']application/(rss|atom)\+xml', tag, re.I):
            h = re.search(r'href=["\']([^"\']+)', tag)
            if h:
                c.append(urljoin(url, html.unescape(h.group(1))))
    if "medium.com" in p.netloc:
        cam = p.path.strip("/").split("/")[0] if p.path.strip("/") else ""
        c.append(f"https://medium.com/feed/{cam}" if p.netloc == "medium.com" and cam else base + "/feed")
    c += [base + "/feed", url.rstrip("/") + "/feed", base + "/rss", base + "/rss.xml", base + "/feed.xml", base + "/atom.xml", base + "/index.xml"]
    visto, out = set(), []
    for x in c:
        if x not in visto and x.startswith("http"):
            visto.add(x)
            out.append(x)
    return out[:9]


def links_da_pagina(url, pagina):
    """Sem feed: devolve os links internos com texto de título, na ordem em que aparecem."""
    host = urlparse(url).netloc
    out, visto = [], set()
    for m in re.finditer(r'(?is)<a\b[^>]*href=["\']([^"\'#]+)["\'][^>]*>(.*?)</a>', pagina or ""):
        link = urljoin(url, html.unescape(m.group(1))).split("?utm")[0]
        texto = limpa(m.group(2))
        if urlparse(link).netloc != host or link in visto or link.rstrip("/") == url.rstrip("/"):
            continue
        if 28 <= len(texto) <= 180 and len(urlparse(link).path.strip("/")) > 8:
            visto.add(link)
            out.append((texto, link))
    return out


def telegram(pagina):
    out = []
    for bloco in re.split(r'(?=<div class="tgme_widget_message_wrap)', pagina or "")[1:]:
        post = re.search(r'data-post="([^"]+)"', bloco)
        texto = re.search(r'(?s)<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>\s*(?:<div class="tgme_widget_message_(?:footer|reactions)|<a class="tgme_widget_message_link_preview|</div>)', bloco)
        data = re.search(r'<time[^>]*datetime="([^"]+)"', bloco)
        if not post or not texto:
            continue
        t = limpa(texto.group(1).replace("<br/>", " ").replace("<br>", " "))
        if len(t) < 20:
            continue
        out.append((t[:160] + ("…" if len(t) > 160 else ""), "https://t.me/" + post.group(1), data.group(1) if data else None, t))
    return out


def tipo_de(tags):
    t = (tags or "").lower()
    if "twitter" in t:
        return "redes"
    if "oficial" in t or "regula" in t:
        return "oficial"
    if "substack" in t:
        return "analistas"
    if "noticias" in t or "notícias" in t:
        return "noticias"
    return "research"


def coleta(f, est):
    """Lê uma fonte. Devolve (novos itens, estado atualizado, situação)."""
    nome, url, tipo = f["nome"], f["url"], f["tipo"]
    e = dict(est or {})
    vistos = list(e.get("vistos", []))
    maxi = int(f.get("max_itens", 5))
    s = sessao()
    brutos, situacao = [], "ok"
    try:
        if not permitido(url):
            return [], {**e, "ultimo": AGORA, "situacao": "robots.txt não permite"}, "robots.txt não permite"
        if tipo == "telegram":
            brutos = telegram(s.get(url, timeout=PRAZO).text)[-maxi * 3:]
        elif tipo == "rss":
            brutos = itens_feed(s.get(url, timeout=PRAZO).content)
        elif tipo in ("auto", "page"):
            feed = e.get("feed")
            if feed is None or (feed == "" and AGORA - e.get("feed_t", 0) > 7 * 86400):
                r = s.get(url, timeout=PRAZO)
                pagina = r.text if r.status_code < 400 else ""
                feed = ""
                if tipo == "auto":
                    for c in candidatos_feed(url, pagina):
                        try:
                            if not permitido(c):
                                continue
                            rc = s.get(c, timeout=12)
                            if rc.status_code == 200 and itens_feed(rc.content):
                                feed = c
                                break
                        except Exception:
                            continue
                e["feed"], e["feed_t"] = feed, AGORA
                if not feed:
                    if r.status_code >= 400:
                        raise RuntimeError(f"página respondeu {r.status_code}")
                    brutos = [(t, l, None, "") for t, l in links_da_pagina(url, pagina)]
                    if not vistos:  # primeira leitura de uma página sem feed: só registra os links que já existem (menus, rodapé, textos antigos)
                        vistos = [b[1] for b in brutos][:400]
                        brutos = []
                    situacao = "ok (página, sem feed)"
            if feed:
                brutos = itens_feed(s.get(feed, timeout=PRAZO).content)
            elif not brutos and situacao == "ok":
                r = s.get(url, timeout=PRAZO)
                if r.status_code >= 400:
                    raise RuntimeError(f"página respondeu {r.status_code}")
                brutos = [(t, l, None, "") for t, l in links_da_pagina(url, r.text)]
                situacao = "ok (página, sem feed)"
        else:
            return [], {**e, "ultimo": AGORA, "situacao": "tipo não coletado"}, "tipo não coletado"
    except Exception as x:
        return [], {**e, "ultimo": AGORA, "situacao": f"falhou: {str(x)[:80]}"}, "falhou"
    novos, corte = [], AGORA - DIAS * 86400
    for titulo, link, data, corpo in brutos:
        if not titulo or not link.startswith("http") or link in vistos:
            continue
        t = quando(data)
        vistos.append(link)
        if t < corte:
            continue
        novos.append({"titulo": titulo[:200], "link": link, "fonte": nome, "t": t, "tipo": tipo_de(f.get("tags")),
                      "trecho": (corpo[:TRECHO] + "…") if len(corpo) > TRECHO else corpo})
        if len(novos) >= maxi:
            break
    e.update(ultimo=AGORA, situacao=situacao, vistos=vistos[-400:])
    return novos, e, situacao


def main():
    fontes = [f for f in yaml.safe_load((AQUI / "fontes.yaml").read_text(encoding="utf-8"))["fontes"]
              if str(f.get("ativo")).lower() in ("sim", "true") and f.get("tipo") != "json"]
    estado = json.loads(EST.read_text()) if EST.exists() else {}
    acervo = json.loads(ARQ.read_text()) if ARQ.exists() else {"itens": []}
    devidas = [f for f in fontes if AGORA - estado.get(f["nome"], {}).get("ultimo", 0) >= int(f.get("intervalo_min", 720)) * 60 - 120]
    print(f"{len(fontes)} fontes ativas, {len(devidas)} na vez")
    with ThreadPoolExecutor(max_workers=12) as ex:
        res = list(ex.map(lambda f: (f, *coleta(f, estado.get(f["nome"]))), devidas))
    if acervo.get("v") != 2:  # limpeza única: tira os links de menu que entraram na primeira leitura de páginas sem feed
        sem_feed = {n for n, e in estado.items() if e.get("feed") == ""}
        acervo["itens"] = [i for i in acervo["itens"] if i["fonte"] not in sem_feed]
        acervo["v"] = 2
    conhecidos = {i["link"] for i in acervo["itens"]}
    entrou = 0
    for f, novos, e, sit in res:
        estado[f["nome"]] = e
        for n in novos:
            if n["link"] not in conhecidos:
                conhecidos.add(n["link"])
                acervo["itens"].append(n)
                entrou += 1
    corte = AGORA - DIAS * 86400
    acervo["itens"] = sorted((i for i in acervo["itens"] if i["t"] >= corte), key=lambda i: -i["t"])[:MAXIMO]
    acervo["t"] = AGORA
    acervo["fontes"] = [{"nome": f["nome"], "url": f["url"], "tipo": tipo_de(f.get("tags")), "leitura": f["tipo"],
                         "situacao": estado.get(f["nome"], {}).get("situacao", "aguardando"),
                         "ultimo": estado.get(f["nome"], {}).get("ultimo", 0)} for f in fontes]
    ARQ.write_text(json.dumps(acervo, ensure_ascii=False, separators=(",", ":")))
    EST.write_text(json.dumps(estado, ensure_ascii=False, separators=(",", ":")))
    ok = sum(1 for f in acervo["fontes"] if f["situacao"].startswith("ok"))
    print(f"{entrou} publicações novas; acervo com {len(acervo['itens'])}; {ok} de {len(fontes)} fontes respondendo")


if __name__ == "__main__":
    main()
