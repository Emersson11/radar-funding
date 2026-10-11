/* Pixels de anúncio (Meta e Google), ligados pelo Admin > Anúncios. Os IDs ficam na tabela
   config_site (meta_pixel, google_tag, google_conv_cadastro, google_conv_checkout); sem ID
   preenchido, nada é carregado. Eventos enviados:
   - todas as páginas: PageView (Meta) e page_view (Google)
   - conta criada: CompleteRegistration (Meta) e sign_up + conversão de cadastro (Google)
   - clique em Assinar (abre a Hotmart): InitiateCheckout (Meta) e begin_checkout + conversão (Google)
   A compra em si é medida pela própria Hotmart (configure o mesmo pixel no produto lá). */
(function () {
  var fila = [], pronto = false, C = {};
  window.arTrack = function (tipo) { if (pronto) envia(tipo); else fila.push(tipo); };

  function envia(tipo) {
    try {
      if (tipo === "cadastro") {
        if (window.fbq && C.meta_pixel) fbq("track", "CompleteRegistration");
        if (window.gtag && C.google_tag) { gtag("event", "sign_up"); if (C.google_conv_cadastro) gtag("event", "conversion", { send_to: C.google_conv_cadastro }); }
      } else if (tipo === "checkout") {
        if (window.fbq && C.meta_pixel) fbq("track", "InitiateCheckout", { currency: "BRL" });
        if (window.gtag && C.google_tag) { gtag("event", "begin_checkout", { currency: "BRL" }); if (C.google_conv_checkout) gtag("event", "conversion", { send_to: C.google_conv_checkout }); }
      }
    } catch (e) {}
  }

  function meta(id) {
    if (!/^\d{8,20}$/.test(id)) return;
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", id); fbq("track", "PageView");
  }
  function google(id) {
    if (!/^(AW|G)-[A-Z0-9]+$/i.test(id)) return;
    var s = document.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id); document.head.appendChild(s);
    window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments); };
    gtag("js", new Date()); gtag("config", id);
  }

  function liga(cfg) {
    C = cfg || {};
    if (C.meta_pixel) meta(String(C.meta_pixel).trim());
    if (C.google_tag) google(String(C.google_tag).trim());
    pronto = true; fila.splice(0).forEach(envia);
  }

  function configPainel() {
    if (window.PAINEL_CONFIG) return Promise.resolve(window.PAINEL_CONFIG);
    return new Promise(function (ok) { var s = document.createElement("script"); s.src = "/config.js"; s.onload = function () { ok(window.PAINEL_CONFIG || {}); }; s.onerror = function () { ok({}); }; document.head.appendChild(s); });
  }

  var guardado = null;
  try { guardado = JSON.parse(sessionStorage.getItem("ar_px") || "null"); } catch (e) {}
  if (guardado && Date.now() - guardado.t < 3600000) { liga(guardado.c); return; }
  configPainel().then(function (p) {
    if (!p.supabaseUrl || !p.supabaseAnonKey) { liga({}); return; }
    return fetch(p.supabaseUrl + "/rest/v1/config_site?select=chave,valor&chave=in.(meta_pixel,google_tag,google_conv_cadastro,google_conv_checkout)", { headers: { apikey: p.supabaseAnonKey, Authorization: "Bearer " + p.supabaseAnonKey } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (l) { var c = {}; (l || []).forEach(function (x) { if (x.valor) c[x.chave] = x.valor; }); try { sessionStorage.setItem("ar_px", JSON.stringify({ t: Date.now(), c: c })); } catch (e) {} liga(c); });
  }).catch(function () { liga({}); });
})();
