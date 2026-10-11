// Proxy para a API pública bitcoin-data.com (NUPL, SOPR, preço realizado de curto
// prazo e fluxo/total de ETFs de Bitcoin). O navegador não consegue chamar esses
// endpoints direto: a API não libera CORS para outras origens, então toda
// chamada falhava silenciosamente no painel (dados on-chain e de ETFs vazios
// para todo visitante). O servidor busca aqui, sem o bloqueio de CORS, e
// devolve o mesmo JSON para o painel.
const PERMITIDOS = new Set(["sth-realized-price", "sopr", "nupl", "etf-flow-btc", "etf-btc-total"]);

export async function onRequestGet(ctx) {
  const url = new URL(ctx.request.url);
  const nome = url.searchParams.get("v") || "";
  if (!PERMITIDOS.has(nome)) {
    return new Response("Parâmetro inválido.", { status: 400 });
  }
  try {
    const r = await fetch("https://bitcoin-data.com/v1/" + nome, {
      headers: { Accept: "application/json" },
    });
    const body = await r.text();
    return new Response(body, {
      status: r.ok ? 200 : r.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=1800",
      },
    });
  } catch (e) {
    return new Response("[]", {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
