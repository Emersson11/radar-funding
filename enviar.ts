// Função do Supabase: envia uma edição da newsletter por e-mail usando o Brevo.
// Só o administrador pode chamar. Segredos: BREVO_API_KEY e EMAIL_REMETENTE (remetente validado no Brevo).
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (t: string) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function html(titulo: string, corpo: string, site: string) {
  const blocos = String(corpo).split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((b) => {
    if (/^##\s+/.test(b)) {
      const ls = b.split("\n");
      return `<h2 style="font:600 18px Georgia,serif;color:#0b2545;margin:26px 0 8px">${esc(ls[0].replace(/^##\s+/, ""))}</h2>` + (ls.length > 1 ? `<p style="margin:0 0 14px">${esc(ls.slice(1).join(" "))}</p>` : "");
    }
    return `<p style="margin:0 0 14px">${esc(b.replace(/\n/g, " "))}</p>`;
  }).join("");
  return `<!doctype html><html><body style="margin:0;background:#eef1f5;padding:24px 0;font:16px/1.65 Arial,Helvetica,sans-serif;color:#1c2633">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden">
<tr><td style="background:#0b2545;padding:22px 30px;border-bottom:4px solid #3ebed6"><span style="font:600 20px Arial,sans-serif;letter-spacing:3px;color:#ffffff">ALPHA <span style="color:#3ebed6">RADAR</span></span><br><span style="font:11px Arial,sans-serif;letter-spacing:4px;color:#9fb3c9">MERCADO GLOBAL</span></td></tr>
<tr><td style="padding:30px"><h1 style="font:600 25px/1.25 Georgia,serif;color:#0b2545;margin:0 0 18px">${esc(titulo)}</h1>${blocos}
${site ? `<p style="margin:26px 0 0"><a href="${esc(site)}" style="background:#3ebed6;color:#06203a;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:6px;display:inline-block">Abrir o painel</a></p>` : ""}</td></tr>
<tr><td style="padding:18px 30px;background:#f5f7fa;font:12px/1.5 Arial,sans-serif;color:#6b7686">Conteúdo informativo e educacional. Não é recomendação de investimento. Para deixar de receber, abra a aba Newsletter no painel e clique em "Parar de receber".</td></tr>
</table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const auth = req.headers.get("Authorization") || "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, (req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY"))!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ erro: "Entre com a sua conta." }, 401);
    const { data: p } = await sb.from("perfis").select("plano").eq("user_id", u.user.id).maybeSingle();
    if (p?.plano !== "admin") return json({ erro: "Só o administrador pode enviar e-mails." }, 403);
    const chave = Deno.env.get("BREVO_API_KEY"), remetente = Deno.env.get("EMAIL_REMETENTE");
    if (!chave || !remetente) return json({ erro: "Falta configurar o envio: salve os segredos BREVO_API_KEY e EMAIL_REMETENTE no Supabase." }, 400);
    const b = await req.json();
    const titulo = String(b.titulo || "").trim().slice(0, 140), corpo = String(b.corpo || "").trim().slice(0, 60000);
    if (!titulo || !corpo) return json({ erro: "Informe título e texto." }, 400);
    let lista: string[] = [];
    if (b.teste) lista = [u.user.email!];
    else {
      if (b.publico === "inscritos" || b.publico === "todos") { const { data } = await sb.from("news_inscritos").select("email"); (data || []).forEach((x: any) => lista.push(x.email)); }
      if (b.publico !== "inscritos") { let q = sb.from("perfis").select("email,plano"); if (b.publico !== "todos") q = q.in("plano", ["assinante", "admin"]); const { data } = await q; (data || []).forEach((x: any) => lista.push(x.email)); }
    }
    lista = [...new Set(lista.filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e || "")).map((e) => e.toLowerCase()))];
    if (!lista.length) return json({ erro: "Não há destinatários nesse público." }, 400);
    if (b.contar) return json({ total: lista.length });
    const conteudo = html(titulo, corpo, String(b.site || "").startsWith("https://") ? String(b.site) : "");
    let enviados = 0; const falhas: string[] = [];
    for (let i = 0; i < lista.length; i += 50) {
      const parte = lista.slice(i, i + 50);
      const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": chave, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ sender: { email: remetente, name: Deno.env.get("EMAIL_NOME") || "Alpha Radar" }, subject: titulo, htmlContent: conteudo, messageVersions: parte.map((e) => ({ to: [{ email: e }] })) }) });
      if (r.ok) enviados += parte.length; else falhas.push((await r.text()).slice(0, 200));
    }
    return json({ enviados, total: lista.length, falhas });
  } catch (e) {
    return json({ erro: "Erro ao enviar: " + String((e as Error).message || e).slice(0, 200) }, 500);
  }
});
