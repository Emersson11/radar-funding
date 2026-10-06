"""Robô de alertas: avisa no Telegram quando uma diferença de funding passa do limite.

Variáveis de ambiente:
  TELEGRAM_TOKEN, TELEGRAM_CHAT_ID  credenciais do seu bot
  LIMITE_30D   diferença mínima na média de 30 dias, ao ano (padrão 0.05 = 5%)
  VOLUME_MIN   volume mínimo em 24h, em dólares (padrão 50000000)
  MAX_30D      ignora diferenças acima disso, que costumam ser situações anormais (padrão 1.0 = 100%)
"""
import json
import os
import pathlib

import radar

LIMITE = float(os.environ.get("LIMITE_30D", "0.05"))
VOL = float(os.environ.get("VOLUME_MIN", "5e7"))
MAXIMO = float(os.environ.get("MAX_30D", "1.0"))
ESTADO = pathlib.Path(__file__).with_name("estado_alertas.json")


def main():
    dados, falhas = radar.carregar()
    ops = [o for o in radar.oportunidades(dados, VOL) if LIMITE <= o["d30"] <= MAXIMO][:8]
    chave = sorted(f'{o["ativo"]}|{o["vender"]}|{o["comprar"]}' for o in ops)
    antes = json.loads(ESTADO.read_text()) if ESTADO.exists() else []
    manual = os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch"   # disparo manual sempre envia
    if chave == antes and not manual:
        print("Sem mudança nas oportunidades; nada enviado.")
        return
    ESTADO.write_text(json.dumps(chave))
    if not ops:
        radar.telegram("Radar de Funding: nenhuma diferença acima de " + radar.pct(LIMITE) + " agora.")
        return
    linhas = ["Radar de Funding: diferenças acima de " + radar.pct(LIMITE) + " ao ano (média de 30 dias)", ""]
    for o in ops:
        linhas.append(f'{o["ativo"]}: vender na {radar.NOMES[o["vender"]]}, comprar na {radar.NOMES[o["comprar"]]}')
        linhas.append(f'  30 dias {radar.pct(o["d30"])} | 7 dias {radar.pct(o["d7"]) if o["d7"] is not None else "-"} | agora {radar.pct(o["agora"])}')
    if falhas:
        linhas += ["", "Sem resposta: " + ", ".join(radar.NOMES[f] for f in falhas)]
    radar.telegram("\n".join(linhas))


if __name__ == "__main__":
    main()
