// Portão do servidor (Cloudflare Pages Functions): páginas e arquivos premium só saem
// do servidor para quem está logado E tem plano de assinante ou administrador.
// A checagem é feita no Supabase a cada pedido; sem isso o arquivo nunca chega ao navegador.
const SUPABASE_URL = "https://ogpwdonofbcubnwykiae.supabase.co";
const PROTEGIDOS = [/^\/simulador-estrategias(\.html)?$/i, /^\/premium\//i];

function cookie(req, nome) {
  const c = req.headers.get("Cookie") || "";
  const m = c.match(new RegExp("(?:^|;\\s*)" + nome + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : null;
}
function volta(url, ancora) {
  return Response.redirect(new URL("/app.html" + ancora, url).toString(), 302);
}

// Todo acesso fica no domínio oficial: alpharadar-86n.pages.dev, os endereços de cada deploy
// (xxxx.alpharadar-86n.pages.dev) e o www são redirecionados para alpharadarglobal.com.br,
// mantendo o caminho e os parâmetros. 301 para GET/HEAD; 308 para POST (não vira GET).
const DOMINIO = "alpharadarglobal.com.br";

export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  if (url.hostname !== DOMINIO && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    const destino = "https://" + DOMINIO + url.pathname + url.search;
    const m = ctx.request.method;
    return new Response(null, { status: m === "GET" || m === "HEAD" ? 301 : 308, headers: { Location: destino, "Cache-Control": "public, max-age=3600" } });
  }
  if (!PROTEGIDOS.some((r) => r.test(url.pathname))) return ctx.next();
  const token = cookie(ctx.request, "ar_at");
  let anon = ctx.env.SUPABASE_ANON_KEY || "";
  if (!anon) { try { const c = await (await ctx.env.ASSETS.fetch(new URL("/config.js", url))).text(); anon = (c.match(/supabaseAnonKey\s*:\s*"([^"]+)"/) || [])[1] || ""; } catch (e) {} }
  if (!token || !anon) return volta(url, "#cs-entrar");
  const h = { apikey: anon, Authorization: "Bearer " + token, "Content-Type": "application/json" };
  try {
    const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/eh_pago", { method: "POST", headers: h, body: "{}" });
    if (r.status === 401 || r.status === 403) return volta(url, "#cs-entrar");
    const pago = r.ok ? await r.json() : false;
    if (pago !== true) return volta(url, "#funding");
  } catch (e) {
    return new Response("Não foi possível confirmar a sua assinatura agora. Tente de novo em instantes.", { status: 503 });
  }
  const resp = await ctx.next();
  const out = new Response(resp.body, resp);
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
