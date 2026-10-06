"""Robô de execução delta neutro (futuro vendido em uma corretora, comprado em outra).

Roda uma vez por chamada; agende para rodar a cada hora.
Começa em SIMULAÇÃO: não envia ordens, só registra o que faria em carteira.json.

Variáveis de ambiente:
  MODO              simulacao (padrão) ou real
  CONFIRMO_DINHEIRO_REAL   precisa ser "sim" para o modo real funcionar
  CAPITAL           dólares usados na operação (padrão 100)
  ALAVANCAGEM       padrão 1
  CORRETORAS        padrão hyper,bybit,binance
  LIMITE_ENTRADA    diferença mínima na média de 30 dias, ao ano (padrão 0.05)
  MAX_30D           ignora diferenças acima disso (padrão 0.5)
  VOLUME_MIN        volume mínimo em 24h (padrão 200000000)
Modo real, chaves SEM permissão de saque:
  BINANCE_KEY, BINANCE_SECRET, BYBIT_KEY, BYBIT_SECRET,
  HYPER_WALLET (endereço), HYPER_PRIVATE_KEY (chave da carteira de API)
"""
import json
import os
import pathlib
import time

import radar

E = os.environ.get
MODO = E("MODO", "simulacao").lower()
REAL = MODO == "real" and E("CONFIRMO_DINHEIRO_REAL", "").lower() == "sim"
CAPITAL = float(E("CAPITAL", "100"))
ALAV = float(E("ALAVANCAGEM", "1"))
CORRETORAS = [c.strip() for c in E("CORRETORAS", "hyper,bybit,binance").split(",") if c.strip()]
ENTRADA = float(E("LIMITE_ENTRADA", "0.05"))
MAXIMO = float(E("MAX_30D", "0.5"))
VOL = float(E("VOLUME_MIN", "2e8"))
TAXA = 0.0005                      # por ordem, sobre o valor
ARQ = pathlib.Path(__file__).with_name("carteira_real.json" if REAL else "carteira.json")


def ler():
    if ARQ.exists():
        return json.loads(ARQ.read_text())
    return {"saldo": CAPITAL, "posicao": None, "historico": []}


def gravar(c):
    ARQ.write_text(json.dumps(c, indent=1, ensure_ascii=False))


def avisar(txt):
    radar.telegram(("[REAL] " if REAL else "[SIMULAÇÃO] ") + txt)


# ---------- ordens reais (ccxt) ----------
def conectar(v):
    import ccxt
    if v == "binance":
        ex = ccxt.binanceusdm({"apiKey": E("BINANCE_KEY"), "secret": E("BINANCE_SECRET")})
    elif v == "bybit":
        ex = ccxt.bybit({"apiKey": E("BYBIT_KEY"), "secret": E("BYBIT_SECRET"), "options": {"defaultType": "swap"}})
    elif v == "hyper":
        ex = ccxt.hyperliquid({"walletAddress": E("HYPER_WALLET"), "privateKey": E("HYPER_PRIVATE_KEY")})
    else:
        raise RuntimeError("Corretora sem execução: " + v)
    ex.load_markets()
    return ex


def simbolo(v, ativo):
    return f"{ativo}/USDC:USDC" if v == "hyper" else f"{ativo}/USDT:USDT"


def ordem(ex, sym, lado, contratos, preco, fechar=False):
    params = {"reduceOnly": True} if fechar else {}
    return ex.create_order(sym, "market", lado, contratos, preco, params)


def abrir_real(op, valor):
    """Vende em op['vender'] e compra em op['comprar']. Devolve a quantidade em moedas."""
    a, b = conectar(op["vender"]), conectar(op["comprar"])
    sa, sb = simbolo(op["vender"], op["ativo"]), simbolo(op["comprar"], op["ativo"])
    if sa not in a.markets or sb not in b.markets:
        raise RuntimeError("Par não encontrado nas duas corretoras")
    pa, pb = a.fetch_ticker(sa)["last"], b.fetch_ticker(sb)["last"]
    if abs(pa / pb - 1) > 0.005:
        raise RuntimeError(f"Preços descolados entre as corretoras ({pa} x {pb})")
    ca, cb = a.markets[sa].get("contractSize") or 1, b.markets[sb].get("contractSize") or 1
    moedas = valor / max(pa, pb)
    qa = float(a.amount_to_precision(sa, moedas / ca)) * ca
    qb = float(b.amount_to_precision(sb, moedas / cb)) * cb
    moedas = min(qa, qb)
    na, nb = float(a.amount_to_precision(sa, moedas / ca)), float(b.amount_to_precision(sb, moedas / cb))
    if na <= 0 or nb <= 0 or abs(na * ca - nb * cb) / moedas > 0.01:
        raise RuntimeError("Não deu para igualar o tamanho das duas pernas; aumente o capital")
    for ex, s in ((a, sa), (b, sb)):
        try:
            ex.set_leverage(int(ALAV), s)
        except Exception:
            pass
    ordem(a, sa, "sell", na, pa)                      # perna 1
    try:
        ordem(b, sb, "buy", nb, pb)                   # perna 2
    except Exception as e:
        ordem(a, sa, "buy", na, pa, fechar=True)      # desfaz a perna 1
        raise RuntimeError("A segunda perna falhou e a primeira foi desfeita: " + str(e))
    return {"moedas": moedas, "na": na, "nb": nb}


def fechar_real(pos):
    a, b = conectar(pos["vender"]), conectar(pos["comprar"])
    sa, sb = simbolo(pos["vender"], pos["ativo"]), simbolo(pos["comprar"], pos["ativo"])
    erros = []
    for ex, s, lado, n in ((a, sa, "buy", pos["na"]), (b, sb, "sell", pos["nb"])):
        try:
            ordem(ex, s, lado, n, ex.fetch_ticker(s)["last"], fechar=True)
        except Exception as e:
            erros.append(str(e))
    if erros:
        raise RuntimeError("Falha ao fechar uma perna, confira na corretora: " + "; ".join(erros))


# ---------- ciclo ----------
def ciclo(dados, ops, agora=None):
    """Um passo do robô. Separado da rede para poder ser testado."""
    agora = agora or time.time()
    c = ler()
    pos = c["posicao"]
    if pos:
        rv, rc = dados.get(pos["vender"], {}).get(pos["ativo"]), dados.get(pos["comprar"], {}).get(pos["ativo"])
        if not rv or not rc:
            avisar(f'Sem dados de {pos["ativo"]} nesta rodada; posição mantida.')
            return c
        dif = rv["apr"] - rc["apr"]
        horas = (agora - pos["ultimo"]) / 3600
        pos["funding"] += pos["valor"] * dif * horas / 8760      # estimativa pelo funding de agora
        pos["ultimo"] = agora
        pos["negativas"] = pos.get("negativas", 0) + 1 if dif <= 0 else 0
        if pos["negativas"] >= 3:                                 # 3 rodadas seguidas pagando
            if REAL:
                fechar_real(pos)
            custo = pos["valor"] * TAXA * 2
            liquido = pos["funding"] - pos["taxas"] - custo
            c["saldo"] += liquido
            c["historico"].append({**pos, "fechado_em": agora, "taxas": pos["taxas"] + custo, "liquido": liquido})
            c["posicao"] = None
            avisar(f'Fechei {pos["ativo"]} ({radar.NOMES[pos["vender"]]} x {radar.NOMES[pos["comprar"]]}). '
                   f'Resultado estimado US$ {liquido:.3f}. Saldo US$ {c["saldo"]:.2f}.')
        gravar(c)
        return c
    bons = [o for o in ops if ENTRADA <= o["d30"] <= MAXIMO and (o["d7"] or 0) > 0]
    if not bons:
        print("Nenhuma oportunidade dentro dos limites.")
        gravar(c)
        return c
    o = bons[0]
    valor = c["saldo"] * ALAV / 2
    extra = abrir_real(o, valor) if REAL else {}
    c["posicao"] = {"ativo": o["ativo"], "vender": o["vender"], "comprar": o["comprar"], "valor": valor,
                    "aberto_em": agora, "ultimo": agora, "funding": 0.0, "taxas": valor * TAXA * 2, "d30": o["d30"], **extra}
    gravar(c)
    avisar(f'Abri {o["ativo"]}: vender US$ {valor:.2f} na {radar.NOMES[o["vender"]]}, comprar na {radar.NOMES[o["comprar"]]}. '
           f'Diferença de 30 dias {radar.pct(o["d30"])}, agora {radar.pct(o["agora"])}.')
    return c


def main():
    if MODO == "real" and not REAL:
        raise SystemExit('Modo real pede CONFIRMO_DINHEIRO_REAL=sim. Nada foi feito.')
    dados, falhas = radar.carregar(CORRETORAS)
    if len(dados) < 2:
        raise SystemExit("Menos de duas corretoras responderam: " + ", ".join(falhas))
    try:
        ciclo(dados, [] if ler()["posicao"] else radar.oportunidades(dados, VOL))
    except Exception as e:
        avisar("ERRO, confira as posições na corretora: " + str(e))
        raise


if __name__ == "__main__":
    main()
