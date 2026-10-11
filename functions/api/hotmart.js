// Webhook da Hotmart (versão 2.0.0): libera e retira o acesso de assinante sozinho.
// Configure na Hotmart: Ferramentas > Webhook > URL https://alpharadarglobal.com.br/api/hotmart
// Segredos no Cloudflare Pages (Settings > Variables and Secrets):
//   HOTMART_HOTTOK        o "hottok" mostrado na Hotmart (confirma que o aviso veio dela)
//   SUPABASE_SERVICE_KEY  a chave service_role do Supabase (só no servidor, nunca no site)
//   OFERTA_ANUAL          (opcional) código da oferta anual; padrão 1v9ksd0v
// Regras (iguais aos Termos de Uso):
//   compra aprovada/renovada  -> assinante até o fim do período pago + 3 dias de folga
//   assinatura cancelada      -> continua até o fim do período pago; depois volta a grátis
//   reembolso, chargeback, disputa -> volta a grátis na hora
// Quem compra antes de criar a conta vira assinante ao se cadastrar (gatilho no banco).
// Administradores e assinantes liberados à mão (sem registro da Hotmart) nunca são alterados.
const SB = "https://ogpwdonofbcubnwykiae.supabase.co";
const LIBERA = new Set(["PURCHASE_APPROVED", "PURCHASE_COMPLETE", "SWITCH_PLAN"]);
const CORTA_JA = new Set(["PURCHASE_REFUNDED", "PURCHASE_CHARGEBACK", "PURCHASE_PROTEST"]);
const CANCELA = new Set(["SUBSCRIPTION_CANCELLATION"]);
const STATUS_V1 = { approved: "PURCHASE_APPROVED", completed: "PURCHASE_COMPLETE", refunded: "PURCHASE_REFUNDED", chargeback: "PURCHASE_CHARGEBACK", dispute: "PURCHASE_PROTEST", canceled: "PURCHASE_CANCELED", cancelled: "PURCHASE_CANCELED", expired: "PURCHASE_EXPIRED", delayed: "PURCHASE_DELAYED" };

const resp = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

function iguais(a, b) { // comparação em tempo constante do token
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function onRequestPost(ctx) {
  const { env, request } = ctx;
  if (!env.HOTMART_HOTTOK || !env.SUPABASE_SERVICE_KEY) return resp({ erro: "webhook ainda não configurado" }, 503);
  let corpo;
  try { corpo = await request.json(); } catch (e) { return resp({ erro: "json inválido" }, 400); }
  const token = request.headers.get("X-HOTMART-HOTTOK") || corpo.hottok || "";
  if (!iguais(String(token), String(env.HOTMART_HOTTOK))) return resp({ erro: "token inválido" }, 401);

  const d = corpo.data || {};
  const evento = String(corpo.event || STATUS_V1[String(corpo.status || "").toLowerCase()] || "").toUpperCase();
  const email = String((d.buyer && d.buyer.email) || corpo.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return resp({ ok: true, ignorado: "sem e-mail" });
  const nome = String((d.buyer && d.buyer.name) || corpo.name || "").slice(0, 120);
  const transacao = String((d.purchase && d.purchase.transaction) || corpo.transaction || "").slice(0, 80);
  const oferta = String((d.purchase && d.purchase.offer && d.purchase.offer.code) || corpo.off || "").slice(0, 40);
  const plano = String((d.subscription && d.subscription.plan && d.subscription.plan.name) || "");
  const anual = oferta === (env.OFERTA_ANUAL || "1v9ksd0v") || /anual|annual|\bano\b|12 meses/i.test(plano);

  const h = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY, "Content-Type": "application/json" };
  const rest = (caminho, metodo, dados, extra) => fetch(SB + "/rest/v1/" + caminho, { method: metodo, headers: { ...h, ...(extra || {}) }, body: dados ? JSON.stringify(dados) : undefined });
  const porEmail = "email=eq." + encodeURIComponent(email);

  let registro = { email, nome, transacao, oferta, ultimo_evento: evento, atualizado: new Date().toISOString() }, perfil = null;
  if (LIBERA.has(evento)) {
    const dias = (anual ? 366 : 31) + 3;
    registro = { ...registro, status: "ativa", valido_ate: new Date(Date.now() + dias * 86400000).toISOString() };
    perfil = ["plano=eq.gratis", { plano: "assinante" }];
  } else if (CORTA_JA.has(evento)) {
    registro = { ...registro, status: evento === "PURCHASE_REFUNDED" ? "reembolsada" : evento === "PURCHASE_CHARGEBACK" ? "chargeback" : "disputa", valido_ate: new Date().toISOString() };
    perfil = ["plano=eq.assinante", { plano: "gratis" }];
  } else if (CANCELA.has(evento)) {
    registro = { ...registro, status: "cancelada" }; // mantém o valido_ate: o acesso segue até o fim do período pago
  } else {
    // aguardando pagamento, atraso, carrinho abandonado etc.: só registra o último evento, sem mudar o acesso
    const r = await rest("assinaturas?" + porEmail, "PATCH", { ultimo_evento: evento, atualizado: registro.atualizado });
    return resp({ ok: r.ok, evento, acao: "nenhuma" });
  }

  const r1 = await rest("assinaturas?on_conflict=email", "POST", registro, { Prefer: "resolution=merge-duplicates,return=minimal" });
  if (!r1.ok) return resp({ erro: "falha ao gravar a assinatura", detalhe: (await r1.text()).slice(0, 200) }, 500);
  let alterou = 0;
  if (perfil) {
    const r2 = await rest("perfis?" + porEmail + "&" + perfil[0], "PATCH", perfil[1], { Prefer: "return=representation" });
    if (!r2.ok) return resp({ erro: "falha ao mudar o plano", detalhe: (await r2.text()).slice(0, 200) }, 500);
    alterou = (await r2.json()).length;
  }
  ctx.waitUntil(rest("rpc/expira_assinaturas", "POST", {})); // aproveita para expirar quem passou do período pago
  return resp({ ok: true, evento, status: registro.status, perfil_alterado: alterou });
}

export async function onRequestGet() {
  return resp({ ok: true, info: "Webhook da Hotmart do Alpha Radar. Envie os avisos por POST." });
}
