# Radar de Funding

Três partes:

| Parte | Arquivo | Onde roda |
|---|---|---|
| Site ao vivo | `index.html` | GitHub Pages |
| Alertas no Telegram | `alertas.py` | GitHub Actions (a cada hora) ou no seu computador |
| Robô de execução | `executor.py` | No seu computador ou em um servidor |

## 1. Publicar o site

1. Crie uma conta em github.com e um repositório novo chamado `radar-funding`, público.
2. Na página do repositório, clique em "uploading an existing file" e arraste os arquivos desta pasta.
   A pasta `.github` é oculta: se ela não for junto, crie o arquivo `.github/workflows/alertas.yml` pelo botão "Add file" e cole o conteúdo.
3. Em Settings > Pages, escolha "Deploy from a branch", branch `main`, pasta `/ (root)`.
4. Em um ou dois minutos o site abre em `https://SEU-USUARIO.github.io/radar-funding/`.

O site atualiza as taxas sozinho a cada minuto.

## 2. Ligar os alertas

1. No Telegram, fale com `@BotFather`, envie `/newbot` e guarde o token que ele devolve.
2. Mande qualquer mensagem para o seu bot novo. Depois abra
   `https://api.telegram.org/botSEU_TOKEN/getUpdates` e copie o número em `"chat":{"id":...}`.
3. No repositório: Settings > Secrets and variables > Actions > New repository secret.
   Crie `TELEGRAM_TOKEN` e `TELEGRAM_CHAT_ID`.
4. Na aba Actions, abra "Alertas de funding" e clique em "Run workflow" para testar.

Você recebe mensagem só quando a lista de oportunidades muda.

Limitação: os servidores do GitHub ficam nos Estados Unidos, e Binance e Bybit costumam recusar acessos de lá.
Nesse caso o alerta sai com as outras fontes e avisa quais não responderam.
Para cobertura completa, rode `rodar_alertas.bat` no seu computador pelo Agendador de Tarefas do Windows.

## 3. Robô de execução

Precisa de Python 3.10 ou mais novo: `pip install -r requirements.txt`.

**Simulação (padrão).** Preencha o token em `rodar_executor_simulacao.bat` e agende para rodar a cada hora.
Ele escolhe a melhor diferença entre Hyperliquid, Bybit e Binance, registra a posição em `carteira.json`,
soma o funding estimado a cada rodada e fecha depois de três rodadas seguidas com a diferença negativa.

**Dinheiro real.** Só depois de algumas semanas de simulação com resultado positivo.
- Crie chaves de API **sem permissão de saque** em cada corretora. Na Hyperliquid, use uma carteira de API, não a chave da carteira principal.
- Defina `MODO=real`, `CONFIRMO_DINHEIRO_REAL=sim` e as chaves como variáveis de ambiente. Nunca grave chaves em arquivo enviado ao GitHub.
- Comece com o menor valor que as corretoras aceitam.

O envio de ordens reais foi escrito mas **não foi testado contra as corretoras**. Trate a primeira execução real como teste, olhando as duas contas.

O que o robô não faz: não transfere dinheiro entre corretoras, não repõe margem e não acompanha preço de liquidação. Isso continua manual.

Não é recomendação de investimento.
