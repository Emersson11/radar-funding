// Ponte para feeds RSS que bloqueiam o servidor do GitHub (o coletor acervo.py roda lá).
// O Substack e a Bloomberg respondem 403 para esses servidores; daqui (Cloudflare) o mesmo
// feed abre normalmente. Só aceita feeds RSS desses domínios: não é um proxy aberto.
const PERMITIDOS = [
  { host: /^[a-z0-9-]+\.substack\.com$/i, caminho: /^\/feed\/?$/ },
  { host: /^(www\.)?bloomberg\.com$/i, caminho: /^\/[a-z0-9/_-]+\.rss$/i },
  { host: /^feeds\.bloomberg\.com$/i, caminho: /^\/[a-z0-9/_-]+\.rss$/i },
];

export async function onRequestGet(ctx) {
  const pedido = new URL(ctx.request.url).searchParams.get("u") || "";
  let alvo;
  try { alvo = new URL(pedido); } catch (e) { return new Response("Endereço inválido.", { status: 400 }); }
  const ok = alvo.protocol === "https:" && PERMITIDOS.some((p) => p.host.test(alvo.hostname) && p.caminho.test(alvo.pathname));
  if (!ok) return new Response("Feed não permitido.", { status: 403 });
  try {
    const r = await fetch(alvo.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; alpha-radar/1.0; +https://alpharadarglobal.com.br)", Accept: "application/rss+xml, application/xml, text/xml, */*" },
      cf: { cacheTtl: 900, cacheEverything: true },
    });
    const corpo = await r.text();
    return new Response(corpo, {
      status: r.ok ? 200 : r.status,
      headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900" },
    });
  } catch (e) {
    return new Response("", { status: 502 });
  }
}
