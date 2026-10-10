/* Alpha Radar: plataforma da área logada.
   Camada carregada depois do app. Não substitui as funções existentes: reorganiza a navegação,
   cria o Dashboard, Cripto, Macro, Ferramentas, Academy, Premium e Configurações, e aplica o sistema Free x Pro.
   Os dados premium sensíveis continuam protegidos no banco (RLS); aqui fica a camada de interface. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  function h(tag, c, txt) { var e = document.createElement(tag); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; }
  function H(tag, c, html) { var e = h(tag, c); e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]; }); }
  function nf(v, c) { return (+v).toLocaleString("pt-BR", { minimumFractionDigits: c == null ? 2 : c, maximumFractionDigits: c == null ? 2 : c }); }
  function pc(v, c) { return v == null || !isFinite(v) ? "–" : (v >= 0 ? "+" : "−") + nf(Math.abs(v) * 100, c == null ? 1 : c) + "%"; }
  function cl(v) { return v > 0 ? "pos" : v < 0 ? "neg" : ""; }
  function din(v) { if (v == null || !isFinite(v)) return "–"; var a = Math.abs(v), s = v < 0 ? "− " : ""; return s + "US$ " + (a >= 1e12 ? nf(a / 1e12, 2) + " tri" : a >= 1e9 ? nf(a / 1e9, 2) + " bi" : a >= 1e6 ? nf(a / 1e6, 1) + " mi" : nf(a, a < 1000 ? 2 : 0)); }
  function preco(v) { if (v == null || !isFinite(v)) return "–"; return "US$ " + nf(v, v < 1 ? 4 : v < 100 ? 2 : 0); }
  function gjson(u) { return fetch(u).then(function (r) { if (!r.ok) throw 0; return r.json(); }).catch(function () { return null; }); }
  function cache(k, ms, fn) { try { var c = JSON.parse(sessionStorage.getItem(k)); if (c && Date.now() - c.t < ms) return Promise.resolve(c.v); } catch (e) {} return fn().then(function (v) { if (v) { try { sessionStorage.setItem(k, JSON.stringify({ t: Date.now(), v: v })); } catch (e) {} } return v; }); }
  function G(n) { return typeof window[n] !== "undefined" ? window[n] : undefined; }
  function plano() { return G("PLANO"); }
  function ehPro() { var p = plano(); return p === "assinante" || p === "admin"; }
  function logado() { return !!G("USUARIO"); }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var AVISO = "Conteúdo educativo e informativo. As informações e simulações apresentadas não constituem recomendação financeira e não garantem resultados futuros.";
  var PRECO_MES = "39,90", PRECO_ANO = "399";

  /* ================= Estilos ================= */
  var css = [
    /* sidebar fixa no desktop */
    "#areas>button[data-area]{display:none!important}",
    "#pnav{display:flex;flex-direction:column;gap:1px;width:100%}",
    "#pnav .pg{margin:12px 0 2px;padding:0 12px 4px;color:var(--band-muted);font:600 10.5px/1.2 var(--sans);letter-spacing:.12em;text-transform:uppercase}",
    "#pnav button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;border-left:2px solid transparent;border-radius:4px;background:none;color:var(--band-muted);padding:8px 12px;font:500 14px/1.25 var(--sans);cursor:pointer}",
    "#pnav button.sub{padding-left:32px;font-size:13.5px}",
    "#pnav button:hover{color:var(--band-fg);background:rgba(255,255,255,.05)}",
    "#pnav button[aria-current=page]{color:var(--band-fg);border-left-color:#3ebed6;background:rgba(127,214,230,.11)}",
    "#pnav .ic{width:16px;text-align:center;opacity:.85;flex:none}",
    "#pnav .pro{margin-left:auto;font:700 9.5px/1 var(--sans);letter-spacing:.08em;color:#06203a;background:#3ebed6;border-radius:3px;padding:3px 5px}",
    "#pnav .pro.ok{display:none}",
    "@media (min-width:1100px){ body:not(.fora){padding-left:248px!important} #lado{width:248px!important;padding:16px 10px 24px!important;overflow-y:auto!important;box-shadow:none!important} #lado-bt{display:none!important} #lado .marca,#lado .areas{opacity:1!important;pointer-events:auto!important;width:auto!important} }",
    "@media (min-width:900px) and (max-width:1099px){ #lado:not(:hover):not(:focus-within):not(.aberto) #pnav .pro{display:none} }",
    /* blocos comuns */
    ".pd-guia{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:3px;overflow:hidden;font-size:13.5px}",
    ".pd-guia>div{background:var(--surface);padding:10px 14px}.pd-guia b{display:block;font:600 11px/1.3 var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:3px}",
    "@media (max-width:760px){.pd-guia{grid-template-columns:1fr}.pd-guia>div:not(:last-child){display:none}}",
    ".pd-risco{font-size:12.5px;color:var(--muted);border-top:1px solid var(--line);padding-top:14px;margin:8px 0 0}",
    ".pd-top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}",
    ".pd-top h2{font:600 clamp(24px,2.4vw,32px)/1.15 var(--serif);margin:0}.pd-top p{margin:6px 0 0;color:var(--muted)}",
    ".pd-cards{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}",
    "@media (max-width:1300px){.pd-cards{grid-template-columns:repeat(3,minmax(0,1fr))}} @media (max-width:620px){.pd-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}",
    ".pd-card{background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:14px 16px;text-align:left;cursor:pointer;font:inherit;color:inherit;display:flex;flex-direction:column;gap:4px;min-width:0;transition:border-color .15s}",
    ".pd-card:hover{border-color:var(--accent)} .pd-card .rot{font-size:12.5px;color:var(--muted)} .pd-card strong{font:600 21px/1.2 var(--sans);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".pd-card small{font-size:12.5px;color:var(--muted)} .pd-card small.pos{color:var(--good)} .pd-card small.neg{color:var(--bad)} .seta{font-size:11px;margin-right:3px}",
    ".pd-radar{background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:20px}",
    ".pd-radar>header{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:14px}.pd-radar>header h2{margin:0;font:600 22px/1.2 var(--serif)}.pd-radar>header p{margin:0;color:var(--muted);font-size:13px}",
    ".pd-rgrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}",
    "@media (max-width:1700px){.pd-rgrid{grid-template-columns:repeat(3,minmax(0,1fr))}} @media (max-width:860px){.pd-rgrid{grid-template-columns:1fr}}",
    ".pd-rb{border:1px solid var(--line);border-radius:4px;padding:14px;display:flex;flex-direction:column;gap:6px;min-width:0;background:var(--bg)}",
    ".pd-rb h3{margin:0 0 4px;font:600 13px/1.2 var(--sans);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);display:flex;justify-content:space-between;align-items:center}",
    ".pd-rb .big{font:600 22px/1.2 var(--sans);font-variant-numeric:tabular-nums}",
    ".pd-kv{display:flex;justify-content:space-between;gap:10px;font-size:13.5px;border-top:1px dashed var(--line);padding-top:5px}.pd-kv span{color:var(--muted)}.pd-kv b{font-weight:600;text-align:right;font-variant-numeric:tabular-nums}",
    ".pd-tag{display:inline-block;font:600 11.5px/1 var(--sans);padding:4px 8px;border-radius:10px;background:var(--soft);color:var(--muted)}.pd-tag.pos{background:color-mix(in srgb,var(--good) 15%,transparent);color:var(--good)}.pd-tag.neg{background:color-mix(in srgb,var(--bad) 15%,transparent);color:var(--bad)}",
    ".pd-rb .lk{margin-top:auto;padding-top:6px;font-size:13px;background:none;border:0;color:var(--accent);cursor:pointer;text-align:left;padding-left:0}",
    ".pd-acontece{margin-top:16px;border-top:1px solid var(--line);padding-top:14px}.pd-acontece h3{margin:0 0 8px;font:600 16px var(--sans)}.pd-acontece ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;line-height:1.5}",
    ".pd-row3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}@media (max-width:1100px){.pd-row3{grid-template-columns:1fr}}",
    ".pd-ev{display:flex;gap:10px;align-items:baseline;padding:7px 0;border-top:1px solid var(--line);font-size:13.5px}.pd-ev:first-child{border-top:0}.pd-ev time{color:var(--muted);white-space:nowrap;min-width:92px;font-variant-numeric:tabular-nums}",
    ".pd-al{display:flex;gap:10px;padding:8px 0;border-top:1px solid var(--line);font-size:13.5px;line-height:1.45}.pd-al:first-child{border-top:0}.pd-al i{font-style:normal;flex:none}",
    ".pd-vazio{color:var(--muted);font-size:13.5px;margin:4px 0}",
    ".pd-sec-tit{font:600 13px/1 var(--sans);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:10px 0 -6px}",
    /* bloqueio Pro */
    ".pro-alvo{position:relative}.pro-alvo.pro-on>*:not(.pro-lock){filter:blur(5px);pointer-events:none;user-select:none;opacity:.55}",
    ".pro-lock{position:absolute;inset:0;z-index:7;display:flex;justify-content:center;align-items:flex-start;padding:min(12vh,90px) 16px 16px}",
    ".pro-lock>div{background:var(--surface);border:1px solid var(--line);border-radius:6px;box-shadow:0 18px 40px rgba(0,0,0,.18);padding:22px 24px;max-width:430px;text-align:center}",
    ".pro-lock h3{margin:0 0 6px;font:600 18px var(--sans)}.pro-lock p{margin:0 0 14px;color:var(--muted);font-size:14px;line-height:1.5}",
    ".bt-pro{border:0;border-radius:5px;padding:10px 18px;font:600 14px var(--sans);background:#3ebed6;color:#06203a;cursor:pointer}.bt-sec{border:1px solid var(--line);border-radius:5px;padding:9px 16px;font:500 14px var(--sans);background:var(--surface);color:var(--fg);cursor:pointer}",
    ".bt-pro:hover{filter:brightness(1.05)}.bt-sec:hover{border-color:var(--accent)}",
    /* tabelas e formulários próprios */
    ".pf-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:12px}.pf-bar label{display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--muted)}",
    ".pf-bar input,.pf-bar select{font:inherit;font-size:14px;padding:7px 9px;border:1px solid var(--line);border-radius:4px;background:var(--surface);color:var(--fg);min-width:0}",
    ".pt{width:100%;border-collapse:collapse;font-size:14px}.pt th{font:500 12.5px var(--sans);color:var(--muted);text-align:right;padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap;cursor:pointer;user-select:none}.pt th.t,.pt td.t{text-align:left}",
    ".pt td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.pt tbody tr{cursor:pointer}.pt tbody tr:hover td{background:var(--soft)}",
    ".pt td.pos{color:var(--good)}.pt td.neg{color:var(--bad)}.pt .nm{display:flex;align-items:center;gap:9px}.pt .nm img{width:20px;height:20px;border-radius:50%}.pt .nm small{color:var(--muted);text-transform:uppercase}",
    ".pt th[aria-sort]::after{content:' ↕';opacity:.35}.pt th[aria-sort=ascending]::after{content:' ↑';opacity:1}.pt th[aria-sort=descending]::after{content:' ↓';opacity:1}",
    ".pscroll{overflow-x:auto}",
    /* gaveta de detalhe */
    "#pd-gaveta{position:fixed;inset:0;z-index:60;display:flex;justify-content:flex-end;background:rgba(5,12,22,.45)}#pd-gaveta[hidden]{display:none}",
    "#pd-gaveta>section{width:min(760px,100%);height:100%;overflow-y:auto;background:var(--bg);border-left:1px solid var(--line);padding:20px;display:flex;flex-direction:column;gap:16px}",
    ".pd-gcab{display:flex;justify-content:space-between;align-items:center;gap:12px}.pd-gcab h2{margin:0;font:600 24px var(--serif);display:flex;align-items:center;gap:10px}.pd-gcab img{width:30px;height:30px;border-radius:50%}",
    /* ferramentas */
    ".pf-tabs{display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--line)}.pf-tabs button{border:0;background:none;padding:10px 14px;font:500 14.5px var(--sans);color:var(--muted);border-bottom:2px solid transparent;cursor:pointer}.pf-tabs button[aria-selected=true]{color:var(--fg);border-bottom-color:var(--accent)}",
    ".pf-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}",
    ".pf-card{background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:18px;display:flex;flex-direction:column;gap:8px}.pf-card h3{margin:0;font:600 16.5px var(--sans);display:flex;justify-content:space-between;gap:8px;align-items:center}.pf-card p{margin:0;color:var(--muted);font-size:14px;line-height:1.5;flex:1}",
    ".bdg{font:700 10px/1 var(--sans);letter-spacing:.08em;padding:4px 6px;border-radius:3px;text-transform:uppercase}.bdg.free{background:var(--soft);color:var(--muted)}.bdg.pro{background:#3ebed6;color:#06203a}",
    ".pf-res{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:3px;overflow:hidden;margin:12px 0}.pf-res>div{background:var(--surface);padding:12px 14px}.pf-res span{display:block;font-size:12.5px;color:var(--muted)}.pf-res b{font:600 19px var(--sans);font-variant-numeric:tabular-nums}",
    ".pf-chk{display:flex;flex-wrap:wrap;gap:8px 16px;margin:12px 0}.pf-chk label{display:flex!important;flex-direction:row!important;gap:7px;align-items:center;font-size:14px;cursor:pointer;color:var(--fg)}.pf-chk input{width:auto!important;margin:0}.pf-chk label.lck{color:var(--muted);cursor:not-allowed}",
    ".graf-p{height:320px;position:relative}",
    /* academy */
    ".ac-top{display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap}.ac-barra{height:8px;border-radius:5px;background:var(--soft);overflow:hidden;width:min(360px,100%)}.ac-barra i{display:block;height:100%;background:var(--good);border-radius:5px;transition:width .3s}",
    ".ac-niv{margin-top:18px}.ac-niv h3{margin:0 0 10px;font:600 17px var(--sans);display:flex;gap:10px;align-items:center}",
    ".ac-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}",
    ".ac-it{border:1px solid var(--line);border-radius:4px;background:var(--surface);padding:12px 14px;text-align:left;font:inherit;color:inherit;cursor:pointer;display:flex;justify-content:space-between;gap:8px;align-items:center}.ac-it:hover{border-color:var(--accent)}.ac-it.ok{border-color:color-mix(in srgb,var(--good) 55%,var(--line))}.ac-it .st{font-size:12px;color:var(--muted);white-space:nowrap}.ac-it.ok .st{color:var(--good)}",
    "#ac-leitura{margin-top:16px}#ac-leitura .prosa p{max-width:75ch;line-height:1.65;margin:0 0 12px}",
    /* premium */
    ".pp-hero{background:var(--band);color:var(--band-fg);border-radius:4px;padding:clamp(22px,4vw,40px)}.pp-hero h2{font:600 clamp(26px,3vw,38px)/1.15 var(--serif);margin:0 0 8px}.pp-hero p{color:var(--band-muted);max-width:70ch;margin:0}",
    ".pp-planos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}@media (max-width:760px){.pp-planos{grid-template-columns:1fr}}",
    ".pp-plano{background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:24px;display:flex;flex-direction:column;gap:10px;position:relative}.pp-plano.dest{border:2px solid #3ebed6}",
    ".pp-plano .vl{font:600 34px/1.1 var(--sans)}.pp-plano .vl small{font-size:15px;color:var(--muted);font-weight:500}.pp-selo{position:absolute;top:-12px;left:22px;background:#3ebed6;color:#06203a;font:700 11px var(--sans);letter-spacing:.08em;text-transform:uppercase;padding:5px 10px;border-radius:4px}",
    ".pp-comp{width:100%;border-collapse:collapse;font:14.5px/1.4 var(--sans)}.pp-comp td,.pp-comp th{font-family:var(--sans)!important}.pp-comp th,.pp-comp td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:center}.pp-comp th:first-child,.pp-comp td:first-child{text-align:left}.pp-comp thead th{font:600 13px var(--sans);color:var(--muted)}.pp-comp td.s{color:var(--good);font-weight:700}.pp-comp td.n{color:var(--muted)}",
    /* configurações */
    ".pc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}@media (max-width:900px){.pc-grid{grid-template-columns:1fr}}",
    ".pc-form{display:flex;flex-direction:column;gap:10px;max-width:420px}.pc-form input{font:inherit;padding:9px 10px;border:1px solid var(--line);border-radius:4px;background:var(--surface);color:var(--fg)}",
    ".pc-msg{font-size:13px;color:var(--muted);min-height:1.2em;margin:0}",
    ".pd-load{color:var(--muted);font-size:13.5px}.pd-load::before{content:'';display:inline-block;width:10px;height:10px;margin-right:8px;border:2px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:pdgira .8s linear infinite;vertical-align:-1px}@keyframes pdgira{to{transform:rotate(360deg)}}",
    ".pd-ttl{cursor:help;border-bottom:1px dotted var(--muted)}"
  ].join("\n");

  /* ================= Navegação ================= */
  var NAV = [
    { g: null, it: [{ k: "dash", ic: "◧", t: "Dashboard", a: "inicio" }] },
    { g: "Mercado", it: [
      { k: "m-resumo", ic: "◎", t: "Visão geral", a: "mercado", s: "resumo" },
      { k: "m-cripto", ic: "₿", t: "Cripto", a: "mercado", s: "ativos" },
      { k: "m-etfs", ic: "▤", t: "ETFs", a: "mercado", s: "etfs", pro: 1 },
      { k: "m-macro", ic: "％", t: "Macro", a: "mercado", s: "macro" },
      { k: "m-onchain", ic: "⛓", t: "On-chain", a: "mercado", s: "onchain", pro: 1 },
      { k: "m-defi", ic: "◇", t: "DeFi", a: "mercado", s: "defi", pro: 1 },
      { k: "m-tradfi", ic: "⌂", t: "TradFi on-chain", a: "tradfi", pro: 1 },
      { k: "m-cal", ic: "▦", t: "Calendário", a: "mercado", s: "calendario" }] },
    { g: "Ferramentas", it: [
      { k: "f-sim", ic: "◫", t: "Simuladores", a: "ferramentas", s: "sim" },
      { k: "f-est", ic: "⇄", t: "Estratégias", a: "ferramentas", s: "est" },
      { k: "f-calc", ic: "∑", t: "Calculadoras", a: "ferramentas", s: "calc" },
      { k: "f-renda", ic: "↯", t: "Renda e arbitragem", a: "funding", pro: 1 }] },
    { g: null, it: [{ k: "cart", ic: "▥", t: "Minha Carteira", a: "carteira" }] },
    { g: "Insights", it: [
      { k: "i-nots", ic: "≡", t: "Notícias", a: "mercado", s: "noticias" },
      { k: "i-rel", ic: "▣", t: "Alpha Reports", a: "relatorio", pro: 1 },
      { k: "i-an", ic: "✎", t: "Análises", a: "analises", pro: 1 },
      { k: "i-nl", ic: "✉", t: "Newsletter", a: "newsletter", pro: 1 }] },
    { g: "Conta", it: [
      { k: "acad", ic: "◭", t: "Academy", a: "aulas" },
      { k: "prem", ic: "★", t: "Premium", a: "premium" },
      { k: "conf", ic: "⚙", t: "Configurações", a: "config" },
      { k: "sup", ic: "?", t: "Suporte", a: "suporte" },
      { k: "adm", ic: "⛭", t: "Administração", a: "admin", adm: 1 }] }
  ];
  var ITENS = {}; NAV.forEach(function (g) { g.it.forEach(function (i) { ITENS[i.k] = i; }); });
  var ATUAL = null;

  function montaNav() {
    var nav = $("areas"); if (!nav || $("pnav")) return;
    var box = h("div"); box.id = "pnav";
    NAV.forEach(function (g) {
      if (g.g) box.appendChild(h("p", "pg", g.g));
      g.it.forEach(function (i) {
        var b = h("button"); b.type = "button"; b.dataset.k = i.k; b.setAttribute("aria-current", "false");
        if (g.g && g.g !== "Conta") b.className = "sub";
        b.appendChild(h("span", "ic", i.ic)); b.appendChild(h("span", null, i.t));
        if (i.pro) { var p = h("span", "pro", "PRO"); p.title = "Recurso Alpha Pro"; b.appendChild(p); }
        b.addEventListener("click", function () { ir(i.k); var l = $("lado"); if (l) l.classList.remove("aberto"); b.blur(); });
        box.appendChild(b); i.el = b;
      });
    });
    nav.appendChild(box);
    espelhaOriginais();
    new MutationObserver(function (ms) { var pn = $("pnav"); if (ms.some(function (m) { return !pn.contains(m.target); })) espelhaOriginais(); }).observe(nav, { attributes: true, subtree: true, attributeFilter: ["hidden", "aria-current", "class"] });
  }
  function original(a) { return document.querySelector('#areas>button[data-area="' + a + '"]'); }
  function espelhaOriginais() {
    NAV.forEach(function (g) { g.it.forEach(function (i) {
      if (!i.el) return; var o = original(i.a);
      var esc_ = i.adm ? (!o || o.hidden) : (o ? o.hidden : false); if (i.el.hidden !== esc_) i.el.hidden = esc_;
      var p = i.el.querySelector(".pro"); if (p && p.classList.contains("ok") !== ehPro()) p.classList.toggle("ok", ehPro());
    }); });
    var vis = areaVisivel();
    if (vis && (!ATUAL || ITENS[ATUAL].a !== vis)) { var k = null; NAV.some(function (g) { return g.it.some(function (i) { if (i.a === vis) { k = i.k; return true; } }); }); if (k) marca(k); }
  }
  function areaVisivel() { var a = document.querySelector("main>.area:not([hidden])"); return a ? a.id.replace("area-", "") : null; }
  function marca(k) { ATUAL = k; NAV.forEach(function (g) { g.it.forEach(function (i) { var v = i.k === k ? "page" : "false"; if (i.el && i.el.getAttribute("aria-current") !== v) i.el.setAttribute("aria-current", v); }); }); var i = ITENS[k]; if (i && $("titulo")) $("titulo").textContent = i.k === "dash" ? "Dashboard" : i.t; }
  function ir(k, extra) {
    var i = ITENS[k]; if (!i) return;
    var o = original(i.a);
    if (o) o.click(); else if (typeof window.area === "function") window.area(i.a);
    if (i.a === "mercado" && i.s) abreMj(i.s);
    if (i.a === "ferramentas") ferAba(i.s || "sim");
    if (i.a === "funding" && extra && typeof window.estJanela === "function") window.estJanela(extra);
    marca(k);
    if (i.a === "inicio") dashDes();
    if (i.a === "premium") premDes();
    if (i.a === "config") confDes();
    if (i.a === "aulas") acDes();
    try { history.replaceState(null, "", "#" + (i.s ? i.a + "/" + i.s : i.a)); } catch (e) {}
    window.scrollTo(0, 0);
  }
  window.alphaIr = ir;
  function abreMj(s) {
    if (s === "macro") { mjMacro(); return; }
    if (typeof window.mjanela === "function") window.mjanela(s);
    if (s === "ativos") criptoDes();
  }

  /* ================= Guias de cada área ================= */
  var GUIAS = {
    inicio: ["O resumo do mercado de hoje: preços, sentimento, macro, on-chain e DeFi.", "Em poucos minutos você entende o contexto antes de olhar qualquer ativo.", "Clique em um cartão para ver os detalhes ou abra a análise completa do dia."],
    mercado: ["Dados de cripto, ETFs, macro, on-chain, DeFi e calendário, separados por tema.", "Cada painel mostra um pedaço do mercado; juntos, explicam o movimento do preço.", "Use as subguias, pesquise ativos e clique em uma linha para abrir o detalhe."],
    ferramentas: ["Simuladores e calculadoras com dados reais de preço.", "Testar uma ideia antes de aplicar mostra o risco e o custo de cada estratégia.", "Escolha uma ferramenta, ajuste os números e compare os resultados."],
    funding: ["Oportunidades de rendimento: arbitragem de funding, pools, vaults, trades e opções.", "Mostra onde o mercado paga juros ou prêmios e quanto sobra depois das taxas.", "Filtre os mercados e abra o simulador para testar com o seu capital."],
    carteira: ["O seu patrimônio: valor atual, lucro ou prejuízo, preço médio e distribuição.", "Acompanhar a carteira em um lugar só evita decisões no escuro.", "Adicione seus ativos em \"+ Adicionar ativo\". Os cálculos são automáticos."],
    relatorio: ["O Alpha Report: relatório completo de mercado montado com os dados do dia.", "Junta macro, cripto e mercados tradicionais em uma leitura organizada.", "Atualize os dados e baixe o PDF para ler depois."],
    analises: ["Análise de ativos e protocolos a partir das fontes acompanhadas.", "Transforma notícias e números em uma leitura compreensível de cada projeto.", "Digite o nome do ativo e veja o que as fontes publicaram e os números atuais."],
    newsletter: ["As edições da newsletter do Alpha Radar.", "Um resumo periódico para quem não pode acompanhar todos os dias.", "Leia as edições e peça para receber por e-mail."],
    aulas: ["A Alpha Academy, organizada em Básico, Intermediário e Avançado.", "Entender o que cada indicador mede é o que permite usar os dados com segurança.", "Comece pelo Básico e marque cada aula como concluída para acompanhar o progresso."],
    tradfi: ["Ações, índices, ouro e títulos que já existem em formato on-chain.", "É uma ponte entre o mercado tradicional e o cripto que cresce rápido.", "Veja onde ter exposição a cada mercado e os riscos de cada plataforma."],
    premium: null, config: null, suporte: null, admin: null, newsletter_: null
  };
  function guias() {
    Object.keys(GUIAS).forEach(function (a) {
      var g = GUIAS[a], ar = $("area-" + a); if (!g || !ar || ar.querySelector(":scope>.pd-guia")) return;
      var d = h("div", "pd-guia"); [["O que estou vendo", g[0]], ["Por que isso importa", g[1]], ["O que posso fazer aqui", g[2]]].forEach(function (x) { var c = h("div"); c.appendChild(h("b", null, x[0])); c.appendChild(document.createTextNode(x[1])); d.appendChild(c); });
      ar.insertBefore(d, ar.firstChild);
    });
  }

  /* ================= Free x Pro ================= */
  var PRO_ALVOS = [
    { s: "#mj-etfs", t: "Dados de ETFs", d: "Fluxos diários, patrimônio e volume dos ETFs de Bitcoin e Ethereum, com histórico completo.", cta: "Desbloquear dados históricos" },
    { s: "#mj-onchain", t: "Indicadores on-chain avançados", d: "MVRV, SOPR, NUPL, preço realizado, fluxo das corretoras e stablecoins, com gráficos e leitura.", cta: "Ver análise completa" },
    { s: "#mj-defi", t: "Dados DeFi avançados", d: "TVL por rede e categoria, maiores protocolos, volume em DEX e stablecoins com histórico.", cta: "Desbloquear Alpha Pro" },
    { s: "#area-tradfi", t: "TradFi on-chain", d: "Ativos reais tokenizados, protocolos, redes e plataformas para ter exposição a cada mercado.", cta: "Desbloquear Alpha Pro" },
    { s: "#funding-conteudo", t: "Renda e arbitragem", d: "Arbitragem de funding, pools, vaults, trades e opções com custos reais e simulador com dados históricos.", cta: "Comparar estratégias" },
    { s: "#area-relatorio", t: "Alpha Reports", d: "O relatório completo de mercado, com gráficos e PDF para baixar.", cta: "Ver análise completa" },
    { s: "#area-analises", t: "Análises de ativos", d: "Leitura de cada ativo e protocolo a partir das fontes acompanhadas e dos números de mercado.", cta: "Ver análise completa" },
    { s: "#area-newsletter", t: "Newsletter", d: "As edições completas da newsletter do Alpha Radar.", cta: "Desbloquear Alpha Pro" },
    { s: "#cj-desempenho", t: "Carteira completa", d: "Desempenho da carteira ao longo do tempo comparado com CDI, Ibovespa e S&P 500.", cta: "Desbloquear dados históricos" },
    { s: "#pd-alertas", t: "Alertas do Radar", d: "Sinais de mercado disparados por regras fixas: sentimento extremo, fluxos fortes, eventos e níveis técnicos.", cta: "Conhecer todos os recursos" },
    { s: "#pd-rels", t: "Novos relatórios", d: "As últimas edições e relatórios do Alpha Radar.", cta: "Conhecer todos os recursos" },
    { s: "#ac-pro", t: "Academy completa", d: "Níveis Intermediário e Avançado, com DeFi, on-chain, macro, gestão de risco e construção de carteira.", cta: "Desbloquear Alpha Pro" },
    { s: "#au-wrap", t: "Aulas em vídeo", d: "Os módulos completos do curso com vídeos, comentários e avaliação.", cta: "Desbloquear Alpha Pro" }
  ];
  function aplicaPro() {
    var pro = ehPro();
    PRO_ALVOS.forEach(function (a) {
      var e = document.querySelector(a.s); if (!e) return;
      var trancado = !pro && logado() && !e.closest(".bloq");
      e.classList.add("pro-alvo"); e.classList.toggle("pro-on", trancado);
      var lk = e.querySelector(":scope>.pro-lock");
      if (trancado && !lk) {
        lk = h("div", "pro-lock"); var d = h("div");
        d.appendChild(h("div", null, "🔒")); d.appendChild(h("h3", null, "Recurso Alpha Pro"));
        d.appendChild(h("p", null, a.t + ". " + "Tenha acesso a dados avançados, histórico completo e ferramentas profissionais."));
        var p2 = h("p", null, a.d); p2.style.fontSize = "13px"; d.appendChild(p2);
        var b = h("button", "bt-pro", a.cta || "Conhecer Alpha Pro"); b.type = "button"; b.addEventListener("click", function () { ir("prem"); });
        var b2 = h("button", "bt-sec", "Conhecer Alpha Pro"); b2.type = "button"; b2.style.marginLeft = "8px"; b2.addEventListener("click", function () { ir("prem"); });
        d.appendChild(b); if ((a.cta || "") !== "Conhecer Alpha Pro") d.appendChild(b2);
        lk.appendChild(d); e.appendChild(lk);
        [].forEach.call(e.children, function (c) { if (c !== lk) c.setAttribute("inert", ""); });
      } else if (!trancado && lk) { lk.remove(); [].forEach.call(e.children, function (c) { if (!c.closest(".bloq")) c.removeAttribute("inert"); }); }
    });
    if (!pro) { var f = $("sim-real"); if (f && f.getAttribute("src")) f.removeAttribute("src"); }
    espelhaOriginais();
  }
  function embrulha(nome, depois) { var t = 0; (function tenta() { var f = window[nome]; if (typeof f !== "function") { if (t++ < 40) setTimeout(tenta, 300); return; } if (f._pl) return; var w = function () { var r = f.apply(this, arguments); try { depois.apply(this, arguments); } catch (e) { console.warn("[plataforma]", nome, e); } return r; }; w._pl = 1; window[nome] = w; })(); }

  /* ================= Dashboard ================= */
  var D = { feito: false, oc: null, ls: null, top: null, fngH: null, rel: null };
  function saudacao() { var hr = new Date().getHours(); return hr < 12 ? "Bom dia" : hr < 18 ? "Boa tarde" : "Boa noite"; }
  function nomeUsuario() { var u = G("USUARIO"); if (!u) return ""; var m = u.user_metadata || {}; var n = (m.nome || m.name || m.full_name || "").trim(); if (n) return n.split(" ")[0]; var e = (u.email || "").split("@")[0].replace(/[._\d]+/g, " ").trim().split(" ")[0]; return e ? e.charAt(0).toUpperCase() + e.slice(1) : ""; }
  function montaDash() {
    var ar = $("area-inicio"); if (!ar || $("pd-top")) return;
    var cab = h("section", "pd-top"); cab.id = "pd-top";
    var a = h("div"); a.appendChild(h("h2", null, saudacao())); a.firstChild.id = "pd-ola";
    a.appendChild(h("p", null, "Veja o que está acontecendo no mercado e acompanhe seus principais indicadores.")); cab.appendChild(a);
    var q = h("p", "pd-vazio"); q.id = "pd-quando"; cab.appendChild(q);
    var cards = h("div", "pd-cards"); cards.id = "pd-cards";
    var radar = h("section", "pd-radar"); radar.id = "pd-radar";
    radar.innerHTML = '<header><h2>🔥 Radar do Dia</h2><p>Leitura dos dados de hoje. É análise de mercado, não previsão nem recomendação.</p></header>' +
      '<div class="pd-rgrid"><div class="pd-rb" id="pr-btc"><h3>Bitcoin</h3><p class="pd-load">Carregando</p></div><div class="pd-rb" id="pr-macro"><h3>Macro</h3><p class="pd-load">Carregando</p></div>' +
      '<div class="pd-rb" id="pr-oc"><h3>On-chain</h3><p class="pd-load">Carregando</p></div><div class="pd-rb" id="pr-defi"><h3>DeFi</h3><p class="pd-load">Carregando</p></div><div class="pd-rb" id="pr-sent"><h3>Sentimento</h3><p class="pd-load">Carregando</p></div></div>' +
      '<div class="pd-acontece"><h3>O que está acontecendo?</h3><ul id="pd-acontece"><li class="pd-load">Montando o resumo</li></ul></div>';
    var row = h("div", "pd-row3");
    row.innerHTML = '<section class="box"><h2>Eventos importantes</h2><p class="sub">Próximos dados e decisões nos Estados Unidos e no Brasil.</p><div id="pd-eventos"><p class="pd-load">Carregando</p></div><p style="margin-top:auto;padding-top:8px"><button type="button" class="bt-sec" id="pd-ir-cal">Ver o calendário completo</button></p></section>' +
      '<section class="box" id="pd-alertas"><h2>Alertas do Radar</h2><p class="sub">Regras fixas aplicadas aos dados de agora. Servem para chamar atenção, não para indicar compra ou venda.</p><div id="pd-al-lista"><p class="pd-load">Verificando</p></div></section>' +
      '<section class="box"><h2>Sua carteira</h2><p class="sub">Evolução do seu patrimônio cadastrado.</p><div id="pd-cart"></div></section>';
    var row2 = h("div", "pd-row3"); row2.style.gridTemplateColumns = "minmax(0,2fr) minmax(0,1fr)";
    row2.innerHTML = '<section class="box"><h2>Novas notícias</h2><ul class="nots" id="pd-nots"></ul><p style="margin-top:8px"><button type="button" class="bt-sec" id="pd-ir-nots">Ver todas as notícias</button></p></section>' +
      '<section class="box" id="pd-rels"><h2>Novos relatórios</h2><p class="sub">Alpha Reports e edições da newsletter.</p><div id="pd-rel-lista"><p class="pd-load">Carregando</p></div><p style="margin-top:8px"><button type="button" class="bt-sec" id="pd-ir-rel">Abrir o Alpha Report de hoje</button></p></section>';
    var sep = h("p", "pd-sec-tit", "Análise do dia e mercados");
    var ini = ar.querySelector(":scope>.pd-guia"); var ref = ini ? ini.nextSibling : ar.firstChild;
    [cab, cards, radar, row, row2, sep].forEach(function (x) { ar.insertBefore(x, ref); });
    $("pd-ir-cal").addEventListener("click", function () { ir("m-cal"); });
    $("pd-ir-nots").addEventListener("click", function () { ir("i-nots"); });
    $("pd-ir-rel").addEventListener("click", function () { ir("i-rel"); });
    var rh = ar.querySelector(".radar h3"); if (rh && /Radar do dia/i.test(rh.textContent)) rh.textContent = "Termômetro dos mercados";
    var dupNots = $("in-nots"); if (dupNots) { var bx = dupNots.closest("section"); if (bx) bx.hidden = true; }
  }
  function card(box, rot, val, varTxt, v, onClick, dica) {
    var b = h("button", "pd-card"); b.type = "button"; if (dica) b.title = dica;
    b.appendChild(h("span", "rot", rot)); b.appendChild(h("strong", null, val));
    var s = h("small", v == null ? "" : cl(v)); if (v != null && v !== 0) s.appendChild(h("span", "seta", v > 0 ? "▲" : "▼")); s.appendChild(document.createTextNode(varTxt || "")); b.appendChild(s);
    b.addEventListener("click", onClick); box.appendChild(b);
  }
  function kv(box, k, v, c) { var d = h("div", "pd-kv"); d.appendChild(h("span", null, k)); var b = h("b", c || "", v); d.appendChild(b); box.appendChild(d); return d; }
  function bloco(id, titulo, tag) { var b = $(id); if (!b) return null; b.textContent = ""; var t = h("h3", null, titulo); if (tag) t.appendChild(tag); b.appendChild(t); return b; }
  function tagEl(txt, v) { return h("span", "pd-tag " + (v > 0 ? "pos" : v < 0 ? "neg" : ""), txt); }
  function linkEl(b, txt, k) { var l = h("button", "lk", txt + " →"); l.type = "button"; l.addEventListener("click", function () { ir(k); }); b.appendChild(l); }
  function media(a, n) { if (a.length < n) return null; var s = 0; for (var i = a.length - n; i < a.length; i++) s += a[i]; return s / n; }
  function rsi14(a) { if (a.length < 15) return null; var g = 0, p = 0; for (var i = a.length - 14; i < a.length; i++) { var d = a[i] - a[i - 1]; if (d > 0) g += d; else p -= d; } if (!p) return 100; var rs = g / p; return 100 - 100 / (1 + rs); }
  function proxEventos(n) { var M = G("MERC"), agora = Date.now() - 3600e3; return ((M && M.calendario) || []).filter(function (e) { return (e.moeda === "USD" || e.moeda === "BRL") && (e.impacto === "High" || e.impacto === "Medium") && Date.parse(e.data) > agora; }).sort(function (a, b) { return Date.parse(a.data) - Date.parse(b.data); }).slice(0, n); }
  function quando(d) { var t = new Date(d); return t.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "") + " " + t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
  function pais(e) { return e.moeda === "BRL" ? "Brasil" : "EUA"; }

  function dashDes() {
    var ar = $("area-inicio"); if (!ar || ar.hidden) return; montaDash();
    var nm = nomeUsuario(); $("pd-ola").textContent = saudacao() + (nm ? ", " + nm : "");
    var M = G("MERC") || {}, P = G("PRECOS") || {}, g = M.panorama, fng = M.fng, btc = P.BTC, eth = P.ETH, S = (M.macro && M.macro.series) || {};
    $("pd-quando").textContent = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) + (M.t ? " · dados macro de " + new Date(M.t * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");
    /* cartões */
    var cs = $("pd-cards"); cs.textContent = "";
    var abreAtivo = function (s) { return function () { ir("m-cripto"); setTimeout(function () { criptoAbre(s === "BTC" ? "bitcoin" : "ethereum"); }, 300); }; };
    card(cs, "Bitcoin", btc ? preco(btc.p) : "–", btc ? pc(btc.v) + " em 24h" : "carregando", btc ? btc.v : null, abreAtivo("BTC"), "Preço ao vivo do Bitcoin em dólar. Clique para ver o detalhe.");
    card(cs, "Ethereum", eth ? preco(eth.p) : "–", eth ? pc(eth.v) + " em 24h" : "carregando", eth ? eth.v : null, abreAtivo("ETH"), "Preço ao vivo do Ethereum em dólar.");
    card(cs, "Market cap", g ? din(g.cap) : "–", g ? pc(g.var24 / 100) + " em 24h" : "–", g ? g.var24 : null, function () { ir("m-resumo"); }, "Valor somado de todas as criptomoedas.");
    card(cs, "Dominância do BTC", g ? nf(g.dom_btc, 1) + "%" : "–", g && g.dom_eth ? "ETH: " + nf(g.dom_eth, 1) + "%" : "participação no total", null, function () { ir("m-resumo"); }, "Fatia do Bitcoin no valor total do mercado cripto. Sobe quando o dinheiro prefere o BTC às outras moedas.");
    var fv = fng ? +fng.valor : null, fOnt = D.fngH && D.fngH.length > 1 ? +D.fngH[1].value : null;
    card(cs, "Fear & Greed", fng ? fng.valor + " / 100" : "–", fng ? ((G("FNG_PT") || {})[fng.classe] || fng.classe) + (fOnt != null ? " · " + (fv - fOnt >= 0 ? "+" : "") + (fv - fOnt) + " em 24h" : "") : "–", fOnt != null ? fv - fOnt : null, function () { ir("m-resumo"); }, "Índice de medo e ganância (0 a 100). Abaixo de 25 é medo extremo; acima de 75, ganância extrema.");
    card(cs, "Volume de mercado", g ? din(g.vol) : "–", "negociado em 24h", null, function () { ir("m-cripto"); }, "Total negociado em criptomoedas nas últimas 24 horas.");
    if (!D.fngH) { D.fngH = []; gjson("https://api.alternative.me/fng/?limit=2").then(function (j) { if (j && j.data) { D.fngH = j.data; dashDes(); } }); }
    radarBtc(btc, M); radarMacro(M, S); radarSent(fng, fv); eventosDes(); carteiraDes(); noticiasDes(M); relDes();
    if (!D.oc) { D.oc = "…"; if (typeof window.ocCarrega === "function") window.ocCarrega().then(function (o) { D.oc = o && typeof window.ocLeitura === "function" ? window.ocLeitura(o) : null; radarOc(); acontece(); alertas(); }).catch(function () { D.oc = null; radarOc(); }); }
    else radarOc();
    if (!D.defi) { D.defi = "…"; if (typeof window.defiCarrega === "function") window.defiCarrega().then(function (d) { D.defi = d; radarDefi(); acontece(); alertas(); }).catch(function () { D.defi = null; radarDefi(); }); }
    else radarDefi();
    if (!D.ls) { D.ls = "…"; Promise.all([gjson("https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=BTCUSDT&period=1d&limit=8"), gjson("https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=1d&limit=2")]).then(function (r) { D.top = r[0]; D.ls = r[1]; radarOc(); radarSent(G("MERC") && G("MERC").fng, fv); }); }
    if (!D.etf && typeof window.etfCarrega === "function") { D.etf = "…"; window.etfCarrega().then(function (e) { D.etf = e; acontece(); alertas(); }).catch(function () { D.etf = null; }); }
    if (!D.hist && typeof window.histDe === "function") { D.hist = "…"; window.histDe("BTCUSDT").then(function (m) { var k = Object.keys(m || {}).sort(); D.hist = k.map(function (d) { return m[d]; }); radarBtc(G("PRECOS").BTC, G("MERC")); acontece(); alertas(); }); }
    acontece(); alertas(); aplicaPro();
  }
  function btcTec() {
    if (!D.hist || D.hist === "…" || !D.hist.length) return null;
    var P = G("PRECOS") || {}, a = D.hist.slice(); if (P.BTC) a[a.length - 1] = P.BTC.p;
    var p = a[a.length - 1], m50 = media(a, 50), m200 = media(a, 200), u30 = a.slice(-30);
    var tend = m50 && m200 ? (p > m50 && m50 > m200 ? { t: "Tendência de alta", v: 1 } : p < m50 && m50 < m200 ? { t: "Tendência de baixa", v: -1 } : { t: "Tendência indefinida", v: 0 }) : { t: "Sem histórico", v: 0 };
    return { p: p, m50: m50, m200: m200, max30: Math.max.apply(null, u30), min30: Math.min.apply(null, u30), rsi: rsi14(a), tend: tend, v30: a.length > 30 ? p / a[a.length - 31] - 1 : null };
  }
  function radarBtc(btc) {
    var T = btcTec(), b = bloco("pr-btc", "Bitcoin", T ? tagEl(T.tend.t.replace("Tendência de ", "").replace("Tendência ", ""), T.tend.v) : null); if (!b) return;
    if (!btc) { b.appendChild(h("p", "pd-load", "Buscando o preço")); return; }
    var big = h("div", "big", preco(btc.p)); b.appendChild(big);
    kv(b, "Variação 24h", pc(btc.v), cl(btc.v));
    if (T) {
      if (T.v30 != null) kv(b, "Variação 30 dias", pc(T.v30), cl(T.v30));
      kv(b, "Média de 50 dias", preco(T.m50)); kv(b, "Média de 200 dias", preco(T.m200));
      kv(b, "Faixa de 30 dias", preco(T.min30).replace("US$ ", "") + " a " + preco(T.max30).replace("US$ ", ""));
      if (T.rsi != null) kv(b, "RSI (14 dias)", nf(T.rsi, 0) + (T.rsi >= 70 ? " · sobrecomprado" : T.rsi <= 30 ? " · sobrevendido" : ""));
    }
    var oc = D.oc && D.oc !== "…" ? D.oc.k : null; if (oc && oc.real) kv(b, "Preço realizado (on-chain)", preco(oc.real));
    linkEl(b, "Ver detalhe do Bitcoin", "m-cripto");
  }
  function radarMacro(M, S) {
    var sU = G("sUlt"), sV = G("sVar"), b = bloco("pr-macro", "Macro"); if (!b) return;
    var ev = proxEventos(1)[0];
    if (ev) { var p = h("p", null); p.style.cssText = "margin:0 0 4px;font-size:13.5px;line-height:1.4"; p.innerHTML = "<b>Próximo evento:</b> " + esc(ev.titulo) + " <span style='color:var(--muted)'>(" + pais(ev) + ", " + quando(ev.data) + ")</span>"; b.appendChild(p); }
    var fed = M.macro && M.macro.fed;
    if (fed && fed.ate != null) kv(b, "Juros EUA (Fed)", nf(fed.de, 2) + "% a " + nf(fed.ate, 2) + "%");
    if (sU && S.selic) kv(b, "Selic", nf(sU(S.selic), 2) + "%");
    if (sU && S.ipca12) kv(b, "Inflação Brasil (IPCA 12m)", nf(sU(S.ipca12), 2) + "%");
    if (sU && S.us10y) kv(b, "Treasury 10 anos", nf(sU(S.us10y), 2) + "%");
    if (sU && S.usdbrl) { var dv = sV ? sV(S.usdbrl, 1) : null; kv(b, "Dólar", "R$ " + nf(sU(S.usdbrl), 2) + (dv != null ? " (" + pc(dv) + ")" : ""), cl(dv)); }
    if (sU && S.dxy) kv(b, "Índice do dólar (DXY)", nf(sU(S.dxy), 1));
    if (b.children.length < 2) b.appendChild(h("p", "pd-load", "Aguardando os dados macro"));
    linkEl(b, "Abrir Macro", "m-macro");
  }
  function radarOc() {
    var b = bloco("pr-oc", "On-chain"); if (!b) return;
    var R = D.oc && D.oc !== "…" ? D.oc : null;
    if (D.oc === "…") { b.appendChild(h("p", "pd-load", "Carregando")); }
    else if (!R) b.appendChild(h("p", "pd-vazio", "Fonte on-chain sem resposta agora."));
    else {
      var k = R.k;
      if (k.liq7 != null) kv(b, "Fluxo líquido nas corretoras (7d)", (k.liq7 < 0 ? "saída de " : "entrada de ") + din(Math.abs(k.liq7)), k.liq7 < 0 ? "pos" : "neg").title = "Saída das corretoras reduz a oferta pronta para venda; entrada aumenta.";
      if (k.exs30 != null) kv(b, "BTC nas corretoras (30d)", pc(k.exs30), k.exs30 < 0 ? "pos" : "neg");
      if (k.mvrv != null) kv(b, "MVRV", nf(k.mvrv, 2)).title = "Valor de mercado dividido pelo valor realizado. Acima de 3,5 historicamente foi euforia; abaixo de 1, fundo.";
      if (k.nupl != null) kv(b, "NUPL", nf(k.nupl, 2) + (k.nuplF ? " · " + k.nuplF : ""));
      if (k.sopr != null) kv(b, "SOPR (7d)", nf(k.sopr, 3));
    }
    if (Array.isArray(D.top) && D.top.length) {
      var u = D.top[D.top.length - 1], lp = +u.longAccount, an = D.top[0] ? +D.top[0].longAccount : null;
      kv(b, "Grandes contas (top traders)", nf(lp * 100, 0) + "% compradas" + (an != null ? " (" + (lp - an >= 0 ? "+" : "−") + nf(Math.abs(lp - an) * 100, 0) + " p.p. em 7d)" : "")).title = "Posição das maiores contas de futuros da Binance. É um retrato do posicionamento das baleias em derivativos, não das carteiras on-chain.";
    }
    linkEl(b, "Abrir On-chain", "m-onchain");
  }
  function radarDefi() {
    var b = bloco("pr-defi", "DeFi"); if (!b) return; var d = D.defi && D.defi !== "…" ? D.defi : null;
    if (D.defi === "…") { b.appendChild(h("p", "pd-load", "Carregando")); return; }
    if (!d) { b.appendChild(h("p", "pd-vazio", "DefiLlama sem resposta agora.")); linkEl(b, "Abrir DeFi", "m-defi"); return; }
    var ult = function (l) { return l && l.length ? l[l.length - 1].value : null; }, ant = function (l, n) { return l && l.length > n ? l[l.length - 1 - n].value : null; };
    var tv = ult(d.tvl), tv7 = ant(d.tvl, 7); b.appendChild(h("div", "big", din(tv)));
    if (tv7) kv(b, "TVL em 7 dias", pc(tv / tv7 - 1), cl(tv / tv7 - 1));
    if (d.dex) kv(b, "Volume em DEX (24h)", din(d.dex.v) + (d.dex.c != null ? " (" + pc(d.dex.c / 100) + ")" : ""), cl(d.dex.c));
    var sb = ult(d.stb), sb30 = ant(d.stb, 30); if (sb) kv(b, "Stablecoins", din(sb) + (sb30 ? " (" + pc(sb / sb30 - 1) + " em 30d)" : ""), sb30 ? cl(sb / sb30 - 1) : "");
    (d.prot || []).slice(0, 3).forEach(function (p, i) { kv(b, (i + 1) + "º " + p.name, din(p.tvl)); });
    linkEl(b, "Abrir DeFi", "m-defi");
  }
  function radarSent(fng, fv) {
    var cls = fv == null ? null : fv <= 25 ? { t: "Medo extremo", v: -1 } : fv < 45 ? { t: "Medo", v: -1 } : fv <= 55 ? { t: "Neutro", v: 0 } : fv < 75 ? { t: "Ganância", v: 1 } : { t: "Ganância extrema", v: 1 };
    var b = bloco("pr-sent", "Sentimento", cls ? tagEl(cls.t, cls.v) : null); if (!b) return;
    if (fv == null) { b.appendChild(h("p", "pd-load", "Carregando")); return; }
    b.appendChild(h("div", "big", fv + " / 100"));
    var bar = h("div"); bar.style.cssText = "height:8px;border-radius:5px;background:linear-gradient(90deg,var(--bad),#d9b44a 50%,var(--good));position:relative;margin:4px 0 6px";
    var mk = h("i"); mk.style.cssText = "position:absolute;top:-4px;width:3px;height:16px;background:var(--fg);border-radius:2px;left:calc(" + fv + "% - 1px)"; bar.appendChild(mk); b.appendChild(bar);
    if (D.fngH && D.fngH.length > 1) kv(b, "Ontem", D.fngH[1].value + " / 100");
    if (Array.isArray(D.ls) && D.ls.length) { var r = +D.ls[D.ls.length - 1].longAccount; kv(b, "Contas compradas em BTC (Binance)", nf(r * 100, 0) + "%"); }
    var pred = fv <= 25 ? "Predomina o medo: muita gente vendendo ou fora do mercado." : fv >= 75 ? "Predomina a euforia: muita gente otimista ao mesmo tempo." : fv < 45 ? "O mercado está cauteloso." : fv > 55 ? "O mercado está otimista." : "O mercado está dividido.";
    var p = h("p", null, pred); p.style.cssText = "margin:6px 0 0;font-size:13.5px;line-height:1.45"; b.appendChild(p);
    linkEl(b, "Visão geral do mercado", "m-resumo");
  }
  function acontece() {
    var ul = $("pd-acontece"); if (!ul) return; var L = [];
    var P = G("PRECOS") || {}, M = G("MERC") || {}, btc = P.BTC, g = M.panorama, T = btcTec();
    if (btc) L.push("O Bitcoin " + (btc.v > 0.005 ? "sobe " + pc(btc.v).replace("+", "") : btc.v < -0.005 ? "cai " + pc(btc.v).replace("−", "") : "anda de lado (" + pc(btc.v) + ")") + " em 24 horas, a " + preco(btc.p) + (T && T.m200 ? ", " + (btc.p > T.m200 ? "acima" : "abaixo") + " da média de 200 dias (" + preco(T.m200) + ")" : "") + ".");
    if (g) L.push("O mercado cripto inteiro vale " + din(g.cap) + " (" + pc(g.var24 / 100) + " em 24h), com o Bitcoin respondendo por " + nf(g.dom_btc, 1) + "% do total.");
    if (M.fng) L.push("O índice de medo e ganância marca " + M.fng.valor + " de 100: " + ((G("FNG_PT") || {})[M.fng.classe] || M.fng.classe).toLowerCase() + ".");
    var e = D.etf && D.etf !== "…" ? D.etf : null;
    if (e && e.fl && e.fl.length) { var s5 = 0; e.fl.slice(-5).forEach(function (x) { s5 += x.usd; }); L.push("Nos últimos 5 pregões, os ETFs de Bitcoin nos EUA tiveram " + (s5 >= 0 ? "entrada" : "saída") + " líquida de " + din(Math.abs(s5)) + "."); }
    var R = D.oc && D.oc !== "…" ? D.oc : null; if (R && R.k.liq7 != null) L.push("Em 7 dias, " + (R.k.liq7 < 0 ? "saiu das corretoras" : "entrou nas corretoras") + " o equivalente a " + din(Math.abs(R.k.liq7)) + " em Bitcoin, em termos líquidos.");
    var d = D.defi && D.defi !== "…" ? D.defi : null; if (d && d.stb && d.stb.length > 30) { var a = d.stb[d.stb.length - 1].value, b = d.stb[d.stb.length - 31].value; L.push("A oferta de stablecoins está em " + din(a) + " (" + pc(a / b - 1) + " em 30 dias), um termômetro da liquidez disponível no cripto."); }
    var ev = proxEventos(1)[0]; if (ev) L.push("Próximo evento relevante: " + ev.titulo + " (" + pais(ev) + "), " + quando(ev.data) + ".");
    ul.textContent = ""; if (!L.length) ul.appendChild(h("li", "pd-load", "Montando o resumo")); L.forEach(function (t) { ul.appendChild(h("li", null, t)); });
  }
  function alertas() {
    var bx = $("pd-al-lista"); if (!bx) return; var A = [];
    var P = G("PRECOS") || {}, M = G("MERC") || {}, btc = P.BTC, T = btcTec(), fv = M.fng ? +M.fng.valor : null;
    if (fv != null && fv <= 25) A.push(["⚠", "Medo extremo no índice de sentimento (" + fv + "/100)."]);
    if (fv != null && fv >= 75) A.push(["⚠", "Ganância extrema no índice de sentimento (" + fv + "/100)."]);
    if (btc && Math.abs(btc.v) >= 0.05) A.push(["⚡", "Bitcoin com movimento forte: " + pc(btc.v) + " em 24h."]);
    if (T && T.m200 && btc && Math.abs(btc.p / T.m200 - 1) <= 0.02) A.push(["◎", "Bitcoin a menos de 2% da média de 200 dias (" + preco(T.m200) + ")."]);
    if (T && T.rsi != null && (T.rsi >= 70 || T.rsi <= 30)) A.push(["◎", "RSI de 14 dias do Bitcoin em " + nf(T.rsi, 0) + " (" + (T.rsi >= 70 ? "sobrecomprado" : "sobrevendido") + ")."]);
    var R = D.oc && D.oc !== "…" ? D.oc : null; if (R && R.k.liq7 != null && Math.abs(R.k.liq7) >= 1e9) A.push(["⛓", "Fluxo forte nas corretoras: " + (R.k.liq7 < 0 ? "saída" : "entrada") + " líquida de " + din(Math.abs(R.k.liq7)) + " em 7 dias."]);
    var e = D.etf && D.etf !== "…" ? D.etf : null; if (e && e.fl && e.fl.length) { var s5 = 0; e.fl.slice(-5).forEach(function (x) { s5 += x.usd; }); if (Math.abs(s5) >= 1e9) A.push(["▤", "ETFs de Bitcoin com " + (s5 > 0 ? "entrada" : "saída") + " de " + din(Math.abs(s5)) + " em 5 pregões."]); }
    var d = D.defi && D.defi !== "…" ? D.defi : null; if (d && d.stb && d.stb.length > 30) { var v = d.stb[d.stb.length - 1].value / d.stb[d.stb.length - 31].value - 1; if (Math.abs(v) >= 0.02) A.push(["◇", "Oferta de stablecoins " + (v > 0 ? "cresceu" : "encolheu") + " " + pc(Math.abs(v)).replace("+", "") + " em 30 dias."]); }
    proxEventos(10).forEach(function (ev) { if (ev.impacto === "High" && Date.parse(ev.data) - Date.now() < 48 * 3600e3) A.push(["▦", "Em menos de 48h: " + ev.titulo + " (" + pais(ev) + ", " + quando(ev.data) + ")."]); });
    bx.textContent = ""; if (!A.length) bx.appendChild(h("p", "pd-vazio", "Nenhum alerta disparado agora."));
    A.slice(0, 7).forEach(function (a) { var r = h("div", "pd-al"); r.appendChild(h("i", null, a[0])); r.appendChild(h("span", null, a[1])); bx.appendChild(r); });
  }
  function eventosDes() {
    var bx = $("pd-eventos"); if (!bx) return; var l = proxEventos(6); bx.textContent = "";
    if (!l.length) { bx.appendChild(h("p", "pd-vazio", "Sem eventos relevantes nos próximos dias.")); return; }
    l.forEach(function (e) { var r = h("div", "pd-ev"); r.appendChild(h("time", null, quando(e.data))); var s = h("span"); s.appendChild(h("span", "pd-tag " + (e.impacto === "High" ? "neg" : ""), pais(e))); s.appendChild(document.createTextNode(" " + e.titulo)); r.appendChild(s); bx.appendChild(r); });
  }
  function carteiraDes() {
    var bx = $("pd-cart"); if (!bx) return; bx.textContent = "";
    var cheio = $("c-cheio"), txt = function (id) { var e = $(id); return e ? e.textContent.trim() : ""; };
    if (cheio && !cheio.hidden && txt("k-valor") && txt("k-valor") !== "–") {
      var r = h("div", "pf-res"); r.style.margin = "4px 0 10px";
      [["Patrimônio", txt("k-valor")], ["Lucro ou prejuízo", txt("k-lp") + " " + txt("k-lpp")], ["Hoje (24h)", txt("k-24")]].forEach(function (x) { var d = h("div"); d.appendChild(h("span", null, x[0])); d.appendChild(h("b", null, x[1])); r.appendChild(d); });
      bx.appendChild(r);
      var b = h("button", "bt-sec", "Abrir minha carteira"); b.type = "button"; b.addEventListener("click", function () { ir("cart"); }); bx.appendChild(b);
    } else {
      bx.appendChild(h("p", "pd-vazio", "Você ainda não cadastrou ativos. Adicione suas compras para acompanhar patrimônio, preço médio e rentabilidade."));
      var b2 = h("button", "bt-pro", "+ Adicionar ativo"); b2.type = "button"; b2.addEventListener("click", adicionarAtivo); bx.appendChild(b2);
    }
  }
  function noticiasDes(M) {
    var ul = $("pd-nots"); if (!ul) return; ul.textContent = ""; var ni = G("notItem");
    var l = (M.noticias || []).slice(0, 6); if (!l.length) { ul.appendChild(h("li", "vazio", "Ainda sem notícias coletadas.")); return; }
    l.forEach(function (n) { ul.appendChild(typeof ni === "function" ? ni(n) : h("li", null, n.titulo)); });
  }
  function relDes() {
    var bx = $("pd-rel-lista"); if (!bx) return; var SB = G("SB");
    if (!ehPro() || !SB) { bx.textContent = ""; bx.appendChild(h("p", "pd-vazio", "As edições aparecem aqui para assinantes.")); return; }
    if (D.rel && Date.now() - D.rel.t < 300000) return mostra(D.rel.l);
    SB.from("newsletters").select("id,titulo,criado_em").order("criado_em", { ascending: false }).limit(4).then(function (r) { D.rel = { t: Date.now(), l: r.data || [] }; mostra(D.rel.l); });
    function mostra(l) { bx.textContent = ""; var hoje = h("div", "pd-ev"); hoje.appendChild(h("time", null, "Hoje")); hoje.appendChild(h("span", null, "Alpha Report do dia, gerado com os dados de agora")); bx.appendChild(hoje);
      l.forEach(function (e) { var r = h("div", "pd-ev"); r.appendChild(h("time", null, new Date(e.criado_em).toLocaleDateString("pt-BR"))); var a = h("a", null, e.titulo); a.href = "#newsletter"; a.addEventListener("click", function (ev) { ev.preventDefault(); ir("i-nl"); }); r.appendChild(a); bx.appendChild(r); });
      if (!l.length) bx.appendChild(h("p", "pd-vazio", "Nenhuma edição da newsletter publicada ainda.")); }
  }

  /* ================= Mercado: Cripto ================= */
  var CR = { l: null, ord: { k: "cap", d: -1 }, f: { q: "", min: 0, dir: "", stb: true } };
  var STABLES = { usdt: 1, usdc: 1, dai: 1, fdusd: 1, tusd: 1, usde: 1, usds: 1, pyusd: 1, usd1: 1, busd: 1, susde: 1, frax: 1, usdd: 1, rlusd: 1, usdtb: 1, bsc_usd: 1, "bsc-usd": 1, susds: 1, usdf: 1, usdg: 1, usd0: 1, buidl: 1 };
  function montaCripto() {
    var sec = $("mj-ativos"); if (!sec || $("cr-box")) return;
    var box = h("section", "box"); box.id = "cr-box";
    box.innerHTML = '<h2>Criptomoedas</h2><p class="sub">As 100 maiores por valor de mercado. Clique em um ativo para ver gráfico, desempenho, indicadores, dados on-chain e notícias.</p>' +
      '<div class="pf-bar" style="margin-top:12px"><label>Pesquisar<input id="cr-q" type="search" placeholder="Nome ou código" autocomplete="off"></label>' +
      '<label>Valor de mercado mínimo<select id="cr-min"><option value="0">Todos</option><option value="1e9">US$ 1 bi</option><option value="1e10">US$ 10 bi</option><option value="1e11">US$ 100 bi</option></select></label>' +
      '<label>Variação em 24h<select id="cr-dir"><option value="">Todas</option><option value="up">Só em alta</option><option value="down">Só em queda</option></select></label>' +
      '<label style="flex-direction:row;align-items:center;gap:6px;padding-bottom:8px"><input type="checkbox" id="cr-stb" checked> Ocultar stablecoins</label><span class="sub" id="cr-n" style="padding-bottom:9px"></span></div>' +
      '<div class="pscroll"><table class="pt" id="cr-t"><thead><tr><th class="t" data-k="rank">#</th><th class="t" data-k="name">Ativo</th><th data-k="price">Preço</th><th data-k="c24">24h</th><th data-k="c7">7d</th><th data-k="cap">Market cap</th><th data-k="vol">Volume 24h</th><th class="t">7 dias</th></tr></thead><tbody id="cr-tb"><tr><td class="t" colspan="8"><span class="pd-load">Carregando</span></td></tr></tbody></table></div>' +
      '<p class="note">Fonte: CoinGecko. Preços em dólar, atualizados a cada poucos minutos.</p>';
    sec.insertBefore(box, sec.firstChild);
    ["cr-q", "cr-min", "cr-dir", "cr-stb"].forEach(function (id) { $(id).addEventListener("input", criptoTab); $(id).addEventListener("change", criptoTab); });
    [].forEach.call(box.querySelectorAll("th[data-k]"), function (th) { th.setAttribute("aria-sort", "none"); th.addEventListener("click", function () { var k = th.dataset.k; CR.ord = { k: k, d: CR.ord.k === k ? -CR.ord.d : (k === "name" || k === "rank" ? 1 : -1) }; criptoTab(); }); });
  }
  function criptoDes() {
    montaCripto(); if (CR.l) { criptoTab(); return; }
    cache("ar_cg_mk", 180000, function () { return gjson("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=24h,7d"); }).then(function (l) {
      if (!Array.isArray(l)) { $("cr-tb").innerHTML = '<tr><td class="t" colspan="8">A CoinGecko não respondeu agora. Tente de novo em um minuto.</td></tr>'; return; }
      CR.l = l.map(function (c) { return { id: c.id, rank: c.market_cap_rank || 999, name: c.name, sym: (c.symbol || "").toUpperCase(), img: c.image, price: c.current_price, c24: c.price_change_percentage_24h_in_currency != null ? c.price_change_percentage_24h_in_currency / 100 : null, c7: c.price_change_percentage_7d_in_currency != null ? c.price_change_percentage_7d_in_currency / 100 : null, cap: c.market_cap, vol: c.total_volume, sp: c.sparkline_in_7d ? c.sparkline_in_7d.price : [], stb: !!STABLES[(c.symbol || "").toLowerCase()] || /usd/i.test(c.symbol || "") && Math.abs((c.current_price || 0) - 1) < 0.02, raw: c }; });
      criptoTab();
    });
  }
  function spark(vals, v) { var sk = G("sparkEl"); if (typeof sk === "function") { var s = sk((vals || []).filter(function (x, i) { return i % 4 === 0; }), v == null ? "#7fb0ea" : v >= 0 ? "#2f9e6a" : "#d0574b"); s.style.width = "100px"; s.style.height = "26px"; return s; } return h("span"); }
  function criptoTab() {
    var tb = $("cr-tb"); if (!tb || !CR.l) return;
    var q = ($("cr-q").value || "").trim().toLowerCase(), mn = +$("cr-min").value, dir = $("cr-dir").value, stb = $("cr-stb").checked, o = CR.ord;
    var l = CR.l.filter(function (c) { return (!q || c.name.toLowerCase().indexOf(q) >= 0 || c.sym.toLowerCase().indexOf(q) >= 0) && (c.cap || 0) >= mn && (!dir || (dir === "up" ? c.c24 > 0 : c.c24 < 0)) && (!stb || !c.stb); });
    l.sort(function (a, b) { var x = a[o.k], y = b[o.k]; if (typeof x === "string") return x.localeCompare(y) * o.d; return ((x == null ? -1e18 : x) - (y == null ? -1e18 : y)) * o.d; });
    [].forEach.call(document.querySelectorAll("#cr-t th[data-k]"), function (th) { th.setAttribute("aria-sort", th.dataset.k === o.k ? (o.d > 0 ? "ascending" : "descending") : "none"); });
    tb.textContent = ""; $("cr-n").textContent = l.length + " ativos";
    if (!l.length) { tb.innerHTML = '<tr><td class="t" colspan="8">Nenhum ativo com esses filtros.</td></tr>'; return; }
    l.forEach(function (c) {
      var tr = h("tr"); tr.tabIndex = 0;
      tr.appendChild(h("td", "t", String(c.rank === 999 ? "–" : c.rank)));
      var td = h("td", "t"), nm = h("div", "nm"); if (/^https:/.test(c.img || "")) { var im = h("img"); im.src = c.img; im.alt = ""; im.loading = "lazy"; nm.appendChild(im); } nm.appendChild(h("b", null, c.name)); nm.appendChild(h("small", null, c.sym)); td.appendChild(nm); tr.appendChild(td);
      tr.appendChild(h("td", null, preco(c.price))); tr.appendChild(h("td", cl(c.c24), pc(c.c24))); tr.appendChild(h("td", cl(c.c7), pc(c.c7)));
      tr.appendChild(h("td", null, din(c.cap))); tr.appendChild(h("td", null, din(c.vol)));
      var ts = h("td", "t"); ts.appendChild(spark(c.sp, c.c7)); tr.appendChild(ts);
      var abre = function () { criptoAbre(c.id); }; tr.addEventListener("click", abre); tr.addEventListener("keydown", function (e) { if (e.key === "Enter") abre(); });
      tb.appendChild(tr);
    });
  }
  function gaveta() {
    var g = $("pd-gaveta"); if (g) return g;
    g = h("div"); g.id = "pd-gaveta"; g.hidden = true; g.setAttribute("role", "dialog"); g.setAttribute("aria-modal", "true");
    var s = h("section"); g.appendChild(s); document.body.appendChild(g);
    g.addEventListener("click", function (e) { if (e.target === g) fechaGaveta(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !g.hidden) fechaGaveta(); });
    return g;
  }
  function fechaGaveta() { var g = $("pd-gaveta"); if (!g) return; g.hidden = true; if (D.gch) { try { D.gch.remove(); } catch (e) {} D.gch = null; } document.body.style.overflow = ""; }
  function criptoAbre(id) {
    var g = gaveta(), s = g.firstChild; g.hidden = false; document.body.style.overflow = "hidden";
    var c = (CR.l || []).filter(function (x) { return x.id === id; })[0];
    s.innerHTML = '<div class="pd-gcab"><h2>' + (c && /^https:/.test(c.img) ? '<img src="' + esc(c.img) + '" alt="">' : "") + esc(c ? c.name : id) + ' <small style="font:500 14px var(--sans);color:var(--muted)">' + esc(c ? c.sym : "") + '</small></h2><button type="button" class="bt-sec" id="cg-fecha">Fechar</button></div>' +
      '<div class="pf-res" id="cg-res"><div><span>Preço</span><b>' + (c ? preco(c.price) : "–") + '</b></div></div>' +
      '<section class="box"><div class="pf-bar" style="justify-content:space-between;margin:0 0 8px"><h2 style="margin:0">Preço</h2><div class="pers" id="cg-per"><button type="button" data-d="30">30 dias</button><button type="button" data-d="90" aria-pressed="true">90 dias</button><button type="button" data-d="365">1 ano</button></div></div><div class="graf-p" id="cg-graf"><p class="pd-load">Carregando o gráfico</p></div></section>' +
      '<section class="box"><h2>Desempenho e indicadores</h2><div id="cg-ind"><p class="pd-load">Calculando</p></div></section>' +
      '<section class="box"><h2>Dados on-chain relacionados</h2><div id="cg-oc"></div></section>' +
      '<section class="box"><h2>Notícias relacionadas</h2><ul class="nots" id="cg-nots"></ul></section>' +
      '<p style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="bt-pro" id="cg-an">Ver análise completa</button><button type="button" class="bt-sec" id="cg-tv">Gráfico avançado</button></p><p class="pd-risco">' + AVISO + '</p>';
    $("cg-fecha").addEventListener("click", fechaGaveta); $("cg-fecha").focus();
    $("cg-an").addEventListener("click", function () { fechaGaveta(); ir("i-an"); var i = $("an-nomes"), f = $("an-form"); if (i && f && ehPro() && c) { i.value = c.name + ", " + c.sym; if (f.requestSubmit) f.requestSubmit(); } });
    var P = G("PRECOS") || {}; $("cg-tv").hidden = !(c && P[c.sym] && typeof window.abrirGrafico === "function"); $("cg-tv").addEventListener("click", function () { fechaGaveta(); window.abrirGrafico(c.sym); });
    var dias = 90, info = null, serie = null;
    var desenha = function () {
      gjson("https://api.coingecko.com/api/v3/coins/" + encodeURIComponent(id) + "/market_chart?vs_currency=usd&days=" + Math.max(dias, 365) + "&interval=daily").then(function (j) {
        var alvo = $("cg-graf"); if (!alvo) return;
        if (!j || !j.prices) { alvo.innerHTML = '<p class="pd-vazio">Gráfico indisponível agora (limite da CoinGecko). Tente de novo em um minuto.</p>'; return; }
        var vis = {}; serie = j.prices.map(function (p) { return [new Date(p[0]).toISOString().slice(0, 10), p[1]]; }).filter(function (p) { if (vis[p[0]]) return false; vis[p[0]] = 1; return true; });
        indicadores(); var corte = new Date(Date.now() - dias * 864e5).toISOString().slice(0, 10);
        alvo.textContent = ""; if (!window.LightweightCharts) return;
        var esc_ = typeof window.escuro === "function" && window.escuro();
        var ch = window.LightweightCharts.createChart(alvo, { height: 320, layout: { background: { color: "transparent" }, textColor: esc_ ? "#93a0b3" : "#5a6678" }, grid: { vertLines: { visible: false }, horzLines: { color: esc_ ? "#243042" : "#e6e9ee" } }, rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false }, handleScroll: false, handleScale: false });
        var cor = c && c.c7 < 0 ? "#d0574b" : "#2f9e6a"; var sr = ch.addAreaSeries({ lineColor: cor, topColor: cor + "44", bottomColor: cor + "05", lineWidth: 2, priceLineVisible: false });
        sr.setData(serie.filter(function (p) { return p[0] >= corte; }).map(function (p) { return { time: p[0], value: p[1] }; })); ch.timeScale().fitContent(); if (D.gch) { try { D.gch.remove(); } catch (e) {} } D.gch = ch;
      });
    };
    [].forEach.call(s.querySelectorAll("#cg-per button"), function (b) { b.addEventListener("click", function () { dias = +b.dataset.d; [].forEach.call(s.querySelectorAll("#cg-per button"), function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); }); desenha(); }); });
    desenha();
    gjson("https://api.coingecko.com/api/v3/coins/" + encodeURIComponent(id) + "?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false").then(function (j) { info = j; resumo(); indicadores(); });
    function resumo() {
      var m = info && info.market_data; if (!m) return; var r = $("cg-res"); if (!r) return;
      var it = [["Preço", preco(m.current_price.usd)], ["24h", pc(m.price_change_percentage_24h / 100)], ["7 dias", pc(m.price_change_percentage_7d / 100)], ["30 dias", pc(m.price_change_percentage_30d / 100)], ["1 ano", m.price_change_percentage_1y != null ? pc(m.price_change_percentage_1y / 100) : "–"], ["Market cap", din(m.market_cap.usd)], ["Volume 24h", din(m.total_volume.usd)], ["Máxima histórica", preco(m.ath.usd) + " (" + pc(m.ath_change_percentage.usd / 100) + ")"]];
      r.textContent = ""; it.forEach(function (x) { var d = h("div"); d.appendChild(h("span", null, x[0])); var v = h("b", null, x[1]); if (/^[+−]/.test(x[1])) v.className = x[1].charAt(0) === "+" ? "pos" : "neg"; v.style.color = /^[+]/.test(x[1]) ? "var(--good)" : /^−/.test(x[1]) ? "var(--bad)" : ""; d.appendChild(v); r.appendChild(d); });
    }
    function indicadores() {
      var bx = $("cg-ind"); if (!bx) return; bx.textContent = "";
      if (serie && serie.length > 20) {
        var a = serie.map(function (p) { return p[1]; }), p = a[a.length - 1], m50 = media(a, 50), m200 = media(a, 200), r = rsi14(a);
        var vol = (function () { var rs = []; for (var i = Math.max(1, a.length - 30); i < a.length; i++) rs.push(Math.log(a[i] / a[i - 1])); var mu = rs.reduce(function (x, y) { return x + y; }, 0) / rs.length; var v = rs.reduce(function (x, y) { return x + (y - mu) * (y - mu); }, 0) / (rs.length - 1); return Math.sqrt(v * 365); })();
        if (m50) kv(bx, "Média de 50 dias", preco(m50) + " (preço " + (p > m50 ? "acima" : "abaixo") + ")", p > m50 ? "pos" : "neg");
        if (m200) kv(bx, "Média de 200 dias", preco(m200) + " (preço " + (p > m200 ? "acima" : "abaixo") + ")", p > m200 ? "pos" : "neg");
        if (r != null) kv(bx, "RSI de 14 dias", nf(r, 0) + (r >= 70 ? " · sobrecomprado" : r <= 30 ? " · sobrevendido" : " · neutro"));
        if (isFinite(vol)) kv(bx, "Volatilidade anualizada (30 dias)", nf(vol * 100, 0) + "%");
        var mx = Math.max.apply(null, a.slice(-365)); kv(bx, "Distância da máxima de 1 ano", pc(p / mx - 1), cl(p / mx - 1));
      }
      var m = info && info.market_data;
      if (m) { if (m.circulating_supply) kv(bx, "Oferta em circulação", nf(m.circulating_supply, 0) + (m.max_supply ? " de " + nf(m.max_supply, 0) + " (" + nf(m.circulating_supply / m.max_supply * 100, 1) + "%)" : "")); if (m.fully_diluted_valuation && m.fully_diluted_valuation.usd) kv(bx, "Valor totalmente diluído", din(m.fully_diluted_valuation.usd)); }
      if (!bx.children.length) bx.appendChild(h("p", "pd-load", "Calculando"));
      var oc = $("cg-oc"); if (oc && !oc.dataset.ok) { oc.dataset.ok = 1; ocDetalhe(oc, c ? c.sym : ""); }
    }
    var nl = $("cg-nots"), M = G("MERC") || {}, ni = G("notItem");
    var re = c ? new RegExp("\\b(" + c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "|" + c.sym + ")\\b", "i") : null;
    var ns = re ? (M.noticias || []).filter(function (n) { return re.test(n.titulo || ""); }).slice(0, 8) : [];
    if (!ns.length) nl.appendChild(h("li", "vazio", "Nenhuma notícia recente citando este ativo nas fontes acompanhadas.")); ns.forEach(function (n) { nl.appendChild(typeof ni === "function" ? ni(n) : h("li", null, n.titulo)); });
  }
  function ocDetalhe(bx, sym) {
    if (sym === "BTC") {
      var R = D.oc && D.oc !== "…" ? D.oc : null;
      var mostra = function (R) { bx.textContent = ""; if (!R) { bx.appendChild(h("p", "pd-vazio", "Fonte on-chain sem resposta agora.")); return; } var k = R.k;
        if (k.real) kv(bx, "Preço realizado (custo médio da rede)", preco(k.real)); if (k.sth) kv(bx, "Custo médio de quem comprou em 5 meses", preco(k.sth)); if (k.mvrv != null) kv(bx, "MVRV", nf(k.mvrv, 2)); if (k.nupl != null) kv(bx, "NUPL", nf(k.nupl, 2) + (k.nuplF ? " · " + k.nuplF : "")); if (k.sopr != null) kv(bx, "SOPR (média de 7 dias)", nf(k.sopr, 3)); if (k.liq7 != null) kv(bx, "Fluxo líquido nas corretoras (7d)", din(k.liq7), k.liq7 < 0 ? "pos" : "neg");
        var b = h("button", "lk", "Abrir o painel On-chain →"); b.className = "bt-sec"; b.style.marginTop = "8px"; b.addEventListener("click", function () { fechaGaveta(); ir("m-onchain"); }); bx.appendChild(b); };
      if (R) mostra(R); else if (typeof window.ocCarrega === "function") { bx.appendChild(h("p", "pd-load", "Carregando")); window.ocCarrega().then(function (o) { D.oc = window.ocLeitura(o); mostra(D.oc); }).catch(function () { mostra(null); }); }
      return;
    }
    if (sym === "ETH" && typeof window.ocCarrega === "function") {
      bx.appendChild(h("p", "pd-load", "Carregando"));
      window.ocCarrega().then(function (o) { bx.textContent = ""; var e = (o && o.eth) || []; var u = e[e.length - 1], a30 = e[e.length - 31]; if (u && u.AdrActCnt) kv(bx, "Endereços ativos por dia", nf(+u.AdrActCnt, 0) + (a30 && a30.AdrActCnt ? " (" + pc(+u.AdrActCnt / +a30.AdrActCnt - 1) + " em 30d)" : "")); if (u && u.TxCnt) kv(bx, "Transações por dia", nf(+u.TxCnt, 0)); if (!bx.children.length) bx.appendChild(h("p", "pd-vazio", "Sem dados on-chain agora.")); });
      return;
    }
    bx.appendChild(h("p", "pd-vazio", "O Alpha Radar acompanha dados on-chain dedicados para Bitcoin e Ethereum. Para os demais ativos, veja oferta em circulação e valor diluído acima e o painel DeFi para protocolos."));
  }

  /* ================= Mercado: Macro ================= */
  function mjMacro() {
    var ab = $("mabas"); if (!ab) return;
    var bt = ab.querySelector('button[data-mj="macro"]');
    if (!bt) {
      bt = h("button", null, "Macro"); bt.type = "button"; bt.setAttribute("role", "tab"); bt.dataset.mj = "macro"; bt.setAttribute("aria-selected", "false");
      var ref = ab.querySelector('button[data-mj="onchain"]'); ab.insertBefore(bt, ref);
      bt.addEventListener("click", function () { mjMacro(); });
      var sec = h("section"); sec.id = "mj-macro"; sec.hidden = true; var ancora = $("mj-onchain"); ancora.parentNode.insertBefore(sec, ancora);
    }
    if (typeof window.mjanela === "function") window.mjanela("macro");
    macroDes();
  }
  function macroDes() {
    var sec = $("mj-macro"); if (!sec) return; var M = G("MERC") || {}, S = (M.macro && M.macro.series) || {}, sU = G("sUlt"), sV = G("sVar"), sD = G("sDif");
    if (!sec.dataset.ok) {
      sec.dataset.ok = 1;
      sec.innerHTML = '<div class="tiles" id="mc-tiles"></div>' +
        '<div class="duas" style="margin-top:20px"><div class="box"><h2>Juros</h2><p class="sub">Selic, título de 3 meses e de 10 anos dos EUA, em % ao ano. Juros altos encarecem o dinheiro e pesam sobre ativos de risco.</p><div class="graf" id="mc-g-juros"></div></div>' +
        '<div class="box"><h2>Inflação no Brasil</h2><p class="sub">IPCA acumulado em 12 meses. É o que guia as decisões do Copom sobre a Selic.</p><div class="graf" id="mc-g-ipca"></div></div></div>' +
        '<div class="duas" style="margin-top:20px"><div class="box"><h2>Dólar</h2><p class="sub">Cotação em reais. Dólar forte costuma coincidir com aperto de liquidez global.</p><div class="graf" id="mc-g-dol"></div></div>' +
        '<div class="box"><h2>Índice do dólar (DXY)</h2><p class="sub">O dólar contra uma cesta de moedas fortes. Historicamente, DXY em alta pesa sobre o Bitcoin.</p><div class="graf" id="mc-g-dxy"></div></div></div>' +
        '<div class="duas" style="margin-top:20px"><div class="box"><h2>Liquidez no cripto</h2><p class="sub">Oferta total de stablecoins: o dinheiro que está dentro do mercado cripto, pronto para ser usado.</p><div class="graf" id="mc-g-liq"></div></div>' +
        '<div class="box"><h2>Próximos eventos</h2><p class="sub">Estados Unidos e Brasil, impacto alto e médio.</p><div id="mc-ev"></div></div></div>' +
        '<p class="note">Fontes: Banco Central do Brasil, Yahoo Finance, Federal Reserve de Nova York e DefiLlama. Valores de fechamento.</p>';
    }
    var t = $("mc-tiles"), tl = G("tile"); t.textContent = "";
    var T = function (r, v, sub, c) { if (typeof tl === "function") tl(t, r, v, sub, c); };
    var fed = M.macro && M.macro.fed;
    if (fed && fed.ate != null) T("Juros dos EUA (Fed)", nf(fed.de, 2) + "% a " + nf(fed.ate, 2) + "%", "faixa definida pelo Fed");
    if (sU) {
      if (S.selic) T("Selic", nf(sU(S.selic), 2) + "%", "ao ano");
      if (S.ipca12) T("IPCA em 12 meses", nf(sU(S.ipca12), 2) + "%", "inflação oficial do Brasil");
      if (S.us3m) T("Treasury 3 meses", nf(sU(S.us3m), 2) + "%", sD ? pp(sD(S.us3m, 1)) + " no dia" : "");
      if (S.us10y) T("Treasury 10 anos", nf(sU(S.us10y), 2) + "%", sD ? pp(sD(S.us10y, 1)) + " no dia" : "");
      if (S.usdbrl) T("Dólar", "R$ " + nf(sU(S.usdbrl), 2), pc(sV(S.usdbrl, 1)) + " no dia", cl(sV(S.usdbrl, 1)));
      if (S.dxy) T("DXY", nf(sU(S.dxy), 2), pc(sV(S.dxy, 1)) + " no dia", cl(sV(S.dxy, 1)));
      if (S.sp500) T("S&P 500", nf(sU(S.sp500), 0), pc(sV(S.sp500, 1)) + " no dia", cl(sV(S.sp500, 1)));
      if (S.ibov) T("Ibovespa", nf(sU(S.ibov), 0), pc(sV(S.ibov, 1)) + " no dia", cl(sV(S.ibov, 1)));
      if (S.ouro) T("Ouro", "US$ " + nf(sU(S.ouro), 0), pc(sV(S.ouro, 1)) + " no dia", cl(sV(S.ouro, 1)));
    }
    if (!t.children.length) t.appendChild(h("p", "pd-load", "Aguardando os dados macro"));
    var gf = G("grafFaz"), cor = G("cor"), c = function (v, f) { try { return (typeof cor === "function" && cor(v)) || f; } catch (e) { return f; } };
    var ser = function (s, n) { return (s || []).slice(-(n || 800)).map(function (x) { return { time: x[0], value: x[1] }; }); };
    if (typeof gf === "function") {
      gf("mc-g-juros", [{ tipo: "linha", cor: c("--s1", "#1f4e8c"), titulo: "Selic", dados: ser(S.selic), degrau: 1 }, { tipo: "linha", cor: c("--s2", "#b8690a"), titulo: "EUA 3m", dados: ser(S.us3m) }, { tipo: "linha", cor: c("--s3", "#6a4fb3"), titulo: "EUA 10a", dados: ser(S.us10y) }], function (v) { return nf(v, 2) + "%"; });
      gf("mc-g-ipca", [{ tipo: "linha", cor: c("--bad", "#b23a30"), titulo: "IPCA 12m", dados: ser(S.ipca12) }], function (v) { return nf(v, 2) + "%"; });
      gf("mc-g-dol", [{ tipo: "linha", cor: c("--s4", "#1a7a4c"), titulo: "USD/BRL", dados: ser(S.usdbrl, 520) }], function (v) { return nf(v, 2); });
      gf("mc-g-dxy", [{ tipo: "linha", cor: c("--s1", "#1f4e8c"), titulo: "DXY", dados: ser(S.dxy, 520) }], function (v) { return nf(v, 1); });
      if (typeof window.defiCarrega === "function") window.defiCarrega().then(function (d) { if (d && d.stb) gf("mc-g-liq", [{ tipo: "area", cor: "#1a7a4c", dados: d.stb.slice(-730) }], function (v) { return din(v).replace("US$ ", ""); }); });
    }
    var ev = $("mc-ev"); ev.textContent = ""; var l = proxEventos(8); if (!l.length) ev.appendChild(h("p", "pd-vazio", "Sem eventos relevantes nos próximos dias."));
    l.forEach(function (e) { var r = h("div", "pd-ev"); r.appendChild(h("time", null, quando(e.data))); var s = h("span"); s.appendChild(h("span", "pd-tag " + (e.impacto === "High" ? "neg" : ""), pais(e))); s.appendChild(document.createTextNode(" " + e.titulo)); r.appendChild(s); ev.appendChild(r); });
  }
  function pp(v) { return v == null || !isFinite(v) ? "–" : (v >= 0 ? "+" : "−") + nf(Math.abs(v), 2) + " p.p."; }

  /* ================= Ferramentas ================= */
  function novaArea(id, titulo) {
    var m = document.querySelector("main"); if (!m || $("area-" + id)) return $("area-" + id);
    var d = h("div", "area"); d.id = "area-" + id; d.hidden = true; m.appendChild(d);
    var T = G("TITULOS"); if (T) T[id] = titulo; return d;
  }
  function montaFer() {
    var ar = novaArea("ferramentas", "Ferramentas"); if (!ar || ar.dataset.ok) return; ar.dataset.ok = 1;
    var tabs = h("div", "pf-tabs"); tabs.setAttribute("role", "tablist");
    [["sim", "Simuladores"], ["est", "Estratégias"], ["calc", "Calculadoras"]].forEach(function (x) { var b = h("button", null, x[1]); b.type = "button"; b.setAttribute("role", "tab"); b.dataset.f = x[0]; b.addEventListener("click", function () { ir("f-" + x[0]); }); tabs.appendChild(b); });
    ar.appendChild(tabs);
    var sim = h("section"); sim.id = "fer-sim"; ar.appendChild(sim);
    sim.appendChild(H("p", "sub", "Todas as ferramentas do Alpha Radar em um lugar. As marcadas como <b>Pro</b> fazem parte do Alpha Pro."));
    var cards = h("div", "pf-cards"); cards.style.marginTop = "14px"; sim.appendChild(cards);
    var FER = [
      ["Simulador de estratégias", "Ranking do que rende agora em vaults, pools e arbitragem, com backtest de cada mercado usando o histórico real e todas as taxas.", 1, function () { ir("f-renda", "sim"); }],
      ["Comparador de estratégias", "Compara DCA, aporte único, aporte em quedas, rebalanceamento e estratégia personalizada com o histórico de preço real.", 0, function () { ir("f-est"); }],
      ["Simulador de DCA", "Quanto teria virado um aporte mensal fixo em Bitcoin, Ethereum ou outro ativo, com taxas incluídas.", 0, function () { ir("f-est"); }],
      ["Simulador de aportes", "Quanto aportar por mês para chegar a uma meta, dada uma taxa de rendimento e um prazo.", 0, function () { ir("f-calc"); setTimeout(function () { var e = $("cc-meta-box"); if (e) e.scrollIntoView({ behavior: "smooth" }); }, 100); }],
      ["Simulador de preço médio", "Calcula o preço médio de várias compras e quanto comprar para levar o preço médio a um alvo.", 0, function () { ir("f-calc"); setTimeout(function () { var e = $("cc-pm-box"); if (e) e.scrollIntoView({ behavior: "smooth" }); }, 100); }],
      ["Simulador de juros compostos", "Evolução de um valor inicial com aportes mensais e juros compostos, mês a mês.", 0, function () { ir("f-calc"); }],
      ["Cenários de carteira", "Monte Carlo com 400 cenários para uma carteira de funding, pools, vaults, opções e trades, com testes de estresse.", 1, function () { ir("f-renda", "sim"); setTimeout(function () { var d = $("sim-mc"); if (d) { d.open = true; d.scrollIntoView({ behavior: "smooth" }); } }, 400); }],
      ["Renda e arbitragem", "Arbitragem de funding entre corretoras, pools de liquidez, vaults, trades e opções, com custos reais.", 1, function () { ir("f-renda", "funding"); }]
    ];
    FER.forEach(function (f) {
      var c = h("article", "pf-card"), t = h("h3"); t.appendChild(h("span", null, f[0])); t.appendChild(h("span", "bdg " + (f[2] ? "pro" : "free"), f[2] ? "Pro" : "Free")); c.appendChild(t);
      c.appendChild(h("p", null, f[1])); var b = h("button", f[2] && !ehPro() ? "bt-sec" : "bt-pro", f[2] && !ehPro() ? "🔒 Desbloquear Alpha Pro" : "Abrir"); b.type = "button"; b.dataset.pro = f[2] ? 1 : "";
      b.addEventListener("click", function () { if (f[2] && !ehPro()) ir("prem"); else f[3](); }); c.appendChild(b); cards.appendChild(c);
    });
    var est = h("section"); est.id = "fer-est"; est.hidden = true; ar.appendChild(est); montaEst(est);
    var calc = h("section"); calc.id = "fer-calc"; calc.hidden = true; ar.appendChild(calc); montaCalc(calc);
  }
  function ferAba(s) {
    montaFer(); s = s || "sim";
    ["sim", "est", "calc"].forEach(function (x) { var e = $("fer-" + x); if (e) e.hidden = x !== s; });
    [].forEach.call(document.querySelectorAll("#area-ferramentas .pf-tabs button"), function (b) { b.setAttribute("aria-selected", b.dataset.f === s ? "true" : "false"); });
    [].forEach.call(document.querySelectorAll("#fer-sim button[data-pro]"), function (b) { if (b.dataset.pro) { b.className = ehPro() ? "bt-pro" : "bt-sec"; b.textContent = ehPro() ? "Abrir" : "🔒 Desbloquear Alpha Pro"; } });
    if (s === "est") estRoda(true);
    if (s === "calc") { jcCalc(); metaCalc(); pmCalc(); }
  }

  /* ---- Comparador de estratégias (backtest com preço real da Binance) ---- */
  var EST = { cache: {} };
  var ESTS = [
    { k: "dca", t: "Aportes periódicos (DCA)", cor: "#1f4e8c", free: 1 },
    { k: "lump", t: "Aporte único no início", cor: "#b8690a", free: 1 },
    { k: "queda", t: "Aporte em quedas", cor: "#6a4fb3" },
    { k: "rebal", t: "Rebalanceamento com caixa", cor: "#1a7a4c" },
    { k: "pers", t: "Personalizada: DCA pela média de 200 dias", cor: "#c2417a" }
  ];
  function montaEst(sec) {
    sec.innerHTML = '<div class="box"><h2>Comparador de estratégias</h2><p class="sub">Todas as estratégias recebem o mesmo dinheiro: o valor inicial e o aporte de todo mês. Muda só quando e como cada uma compra. Preços diários reais da Binance, com a taxa de cada compra.</p>' +
      '<div class="pf-bar" style="margin-top:14px"><label>Ativo<select id="es-ativo"><option value="BTCUSDT">Bitcoin</option><option value="ETHUSDT">Ethereum</option><option value="SOLUSDT">Solana</option><option value="BNBUSDT">BNB</option><option value="XRPUSDT">XRP</option><option value="ADAUSDT">Cardano</option><option value="LINKUSDT">Chainlink</option></select></label>' +
      '<label>Período<select id="es-per"><option value="365">1 ano</option><option value="730" selected>2 anos</option><option value="1095">3 anos</option><option value="1460">4 anos</option></select></label>' +
      '<label>Valor inicial (US$)<input id="es-ini" type="number" min="0" step="100" value="1000" style="width:120px"></label><label>Aporte mensal (US$)<input id="es-mes" type="number" min="0" step="50" value="200" style="width:120px"></label>' +
      '<label>Taxa por compra (%)<input id="es-taxa" type="number" min="0" max="5" step="0.05" value="0.1" style="width:90px"></label></div>' +
      '<div class="pf-chk" id="es-chk"></div>' +
      '<details id="es-par"><summary style="cursor:pointer;color:var(--accent);font-size:14px">Parâmetros das estratégias</summary><div class="pf-bar" style="margin-top:10px">' +
      '<label>Queda que dispara a compra (%)<input id="es-q" type="number" min="1" max="80" step="1" value="10" style="width:90px"></label>' +
      '<label>Peso do ativo no rebalanceamento (%)<input id="es-w" type="number" min="5" max="95" step="5" value="60" style="width:90px"></label>' +
      '<label>Rendimento do caixa (% ao ano)<input id="es-cx" type="number" min="0" max="30" step="0.5" value="4" style="width:90px"></label>' +
      '<label>Multiplicador abaixo da média<input id="es-mb" type="number" min="0" max="5" step="0.25" value="2" style="width:90px"></label>' +
      '<label>Multiplicador acima da média<input id="es-ma" type="number" min="0" max="5" step="0.25" value="0.5" style="width:90px"></label></div>' +
      '<p class="note">Aporte em quedas: o aporte do mês fica em caixa e só compra quando o preço cai a porcentagem escolhida abaixo da máxima de 30 dias. Rebalanceamento: todo mês a carteira volta ao peso escolhido entre o ativo e o caixa em stablecoin. Personalizada: compra o multiplicador do aporte quando o preço está abaixo da média de 200 dias e o outro multiplicador quando está acima; o que sobra fica em caixa rendendo.</p></details>' +
      '<p style="margin-top:12px"><button type="button" class="bt-pro" id="es-rodar">Comparar estratégias</button> <span class="sub" id="es-status"></span></p></div>' +
      '<div class="box" id="es-res" hidden style="margin-top:20px"><h2>Resultado</h2><p class="sub" id="es-resumo"></p><div class="pscroll" style="margin-top:10px"><table class="pt" id="es-tab"></table></div><div class="graf-p" id="es-graf" style="margin-top:16px"></div><p class="note">Linha tracejada: total investido até cada data. Simulações históricas não garantem resultados futuros e não são recomendação de investimento.</p></div>' +
      '<div id="fer-est-pro" style="min-height:10px"></div>';
    var ck = $("es-chk");
    ESTS.forEach(function (e) { var l = h("label"); l.dataset.k = e.k; var i = h("input"); i.type = "checkbox"; i.value = e.k; i.checked = true; l.appendChild(i); var sw = h("i"); sw.style.cssText = "width:10px;height:10px;border-radius:2px;display:inline-block;background:" + e.cor; l.appendChild(sw); l.appendChild(document.createTextNode(e.t + (e.free ? "" : " "))); if (!e.free) { var b = h("span", "bdg pro", "Pro"); l.appendChild(b); } ck.appendChild(l); });
    $("es-rodar").addEventListener("click", function () { estRoda(); });
  }
  function estLibera() {
    var pro = ehPro();
    [].forEach.call(document.querySelectorAll("#es-chk label"), function (l) { var e = ESTS.filter(function (x) { return x.k === l.dataset.k; })[0]; var i = l.querySelector("input"); if (!e.free) { i.disabled = !pro; if (!pro) i.checked = false; l.classList.toggle("lck", !pro); l.title = pro ? "" : "Recurso Alpha Pro"; } });
    var aviso = $("fer-est-pro"); if (aviso) { aviso.textContent = ""; if (!pro) { var d = h("div", "box"); d.style.cssText = "flex-direction:row;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-top:20px"; d.appendChild(H("div", null, "<b>🔒 Recurso Alpha Pro</b><br><span class='sub'>Aporte em quedas, rebalanceamento e estratégias personalizadas fazem parte do Alpha Pro.</span>")); var b = h("button", "bt-pro", "Conhecer Alpha Pro"); b.type = "button"; b.addEventListener("click", function () { ir("prem"); }); d.appendChild(b); aviso.appendChild(d); } }
  }
  function klines(par, dias) {
    var k = par + dias; if (EST.cache[k]) return EST.cache[k];
    var fim = Date.now(), ini = fim - (dias + 210) * 864e5, out = [];
    var pega = function (start) { return fetch("https://data-api.binance.vision/api/v3/klines?symbol=" + par + "&interval=1d&limit=1000&startTime=" + start).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (l) { out = out.concat(l); if (l.length === 1000 && l[l.length - 1][0] < fim - 864e5) return pega(l[l.length - 1][0] + 864e5); return out; }); };
    EST.cache[k] = pega(ini).then(function (l) { return l.map(function (x) { return { t: x[0], d: new Date(x[0]).toISOString().slice(0, 10), c: +x[4] }; }); }).catch(function () { delete EST.cache[k]; return null; });
    return EST.cache[k];
  }
  function estRoda(silencioso) {
    estLibera(); if (silencioso && EST.feito) return;
    var par = $("es-ativo").value, dias = +$("es-per").value, C0 = Math.max(0, +$("es-ini").value || 0), A = Math.max(0, +$("es-mes").value || 0), fee = Math.max(0, +$("es-taxa").value || 0) / 100;
    var ks = [].map.call(document.querySelectorAll("#es-chk input:checked"), function (i) { return i.value; });
    if (!ks.length) { $("es-status").textContent = "Escolha ao menos uma estratégia."; return; }
    if (!C0 && !A) { $("es-status").textContent = "Informe um valor inicial ou um aporte mensal."; return; }
    $("es-status").textContent = "Buscando o histórico de preços…"; EST.feito = 1;
    klines(par, dias).then(function (k) {
      if (!k || k.length < 60) { $("es-status").textContent = "Não consegui o histórico agora. Tente de novo em instantes."; return; }
      var desde = new Date(Date.now() - dias * 864e5).toISOString().slice(0, 10), i0 = 0; while (i0 < k.length && k[i0].d < desde) i0++;
      var P = { q: (+$("es-q").value || 10) / 100, w: Math.min(0.95, Math.max(0.05, (+$("es-w").value || 60) / 100)), cx: (+$("es-cx").value || 0) / 100, mb: +$("es-mb").value, ma: +$("es-ma").value };
      var res = ks.map(function (s) { return estSim(s, k, i0, C0, A, fee, P); });
      estMostra(res, k, i0, par);
      $("es-status").textContent = "Período de " + k[i0].d.split("-").reverse().join("/") + " a " + k[k.length - 1].d.split("-").reverse().join("/") + ".";
    });
  }
  function estSim(s, k, i0, C0, A, fee, P) {
    var u = 0, cash = 0, inv = 0, compras = 0, gasto = 0, curva = [], pico = 0, dd = 0, ultMes = null, dCx = Math.pow(1 + P.cx, 1 / 365) - 1;
    var compra = function (v, p) { if (v <= 0) return; v = Math.min(v, cash); if (v <= 0.0001) return; cash -= v; u += v * (1 - fee) / p; gasto += v; compras++; };
    var totalMeses = 0; for (var j = i0; j < k.length; j++) { var m = k[j].d.slice(0, 7); if (m !== ultMes) { totalMeses++; ultMes = m; } } ultMes = null;
    var mesN = 0;
    for (var i = i0; i < k.length; i++) {
      var p = k[i].c, mes = k[i].d.slice(0, 7), novoMes = mes !== ultMes; cash *= 1 + dCx;
      if (i === i0) { var aporteIni = s === "lump" ? C0 + A * totalMeses : C0; cash += aporteIni; inv += aporteIni; if (s === "rebal") compra(cash * P.w, p); else if (s === "queda" || s === "pers") compra(C0, p); else compra(cash, p); }
      if (novoMes) {
        if (i !== i0 && s !== "lump") { cash += A; inv += A; }
        if (i === i0 && s !== "lump") { cash += A; inv += A; }
        mesN++;
        if (s === "dca") compra(A, p);
        if (s === "rebal") { var tot = cash + u * p, alvo = tot * P.w, atual = u * p; if (atual < alvo) compra(alvo - atual, p); else if (atual > alvo) { var vend = (atual - alvo) / p; u -= vend; cash += vend * p * (1 - fee); } }
        if (s === "pers") { var j0 = Math.max(0, i - 199), sm = 0; for (var z = j0; z <= i; z++) sm += k[z].c; var mm = sm / (i - j0 + 1); compra(A * (p < mm ? P.mb : P.ma), p); }
        ultMes = mes;
      }
      if (s === "queda" && cash > 1) { var mx = 0; for (var y = Math.max(0, i - 29); y <= i; y++) mx = Math.max(mx, k[y].c); if (p <= mx * (1 - P.q)) compra(cash, p); }
      var val = cash + u * p; curva.push({ time: k[i].d, value: val, inv: inv }); if (val > pico) pico = val; if (pico > 0) dd = Math.max(dd, 1 - val / pico);
    }
    var fim = curva[curva.length - 1];
    return { k: s, final: fim.value, inv: inv, lucro: fim.value - inv, ret: inv ? fim.value / inv - 1 : 0, dd: dd, compras: compras, pm: u > 0 ? (gasto * (1 - fee)) / u : null, caixa: cash, curva: curva };
  }
  function estMostra(res, k, i0, par) {
    $("es-res").hidden = false; var t = $("es-tab"), nome = function (s) { return ESTS.filter(function (e) { return e.k === s; })[0]; };
    var melhor = res.slice().sort(function (a, b) { return b.final - a.final; })[0];
    var p0 = k[i0].c, p1 = k[k.length - 1].c;
    $("es-resumo").textContent = "No período, o preço foi de " + preco(p0) + " para " + preco(p1) + " (" + pc(p1 / p0 - 1) + "). Com o mesmo dinheiro investido (" + din(melhor.inv) + "), o melhor resultado foi de \"" + nome(melhor.k).t + "\": " + din(melhor.final) + ".";
    t.innerHTML = "<thead><tr><th class='t'>Estratégia</th><th>Investido</th><th>Valor final</th><th>Lucro ou prejuízo</th><th>Retorno</th><th>Maior queda</th><th>Compras</th><th>Preço médio</th><th>Sobrou em caixa</th></tr></thead>";
    var tb = h("tbody");
    res.forEach(function (r) { var e = nome(r.k), tr = h("tr"); tr.style.cursor = "default"; var td = h("td", "t"); td.innerHTML = '<span style="display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:7px;background:' + e.cor + '"></span>' + esc(e.t) + (r === melhor ? ' <span class="pd-tag pos">maior saldo</span>' : ""); tr.appendChild(td);
      [[din(r.inv)], [din(r.final)], [din(r.lucro), cl(r.lucro)], [pc(r.ret), cl(r.ret)], ["−" + nf(r.dd * 100, 1) + "%"], [String(r.compras)], [r.pm && r.k !== "rebal" ? preco(r.pm) : "–"], [din(r.caixa)]].forEach(function (c) { tr.appendChild(h("td", c[1] || "", c[0])); }); tb.appendChild(tr); });
    t.appendChild(tb);
    var alvo = $("es-graf"); alvo.textContent = ""; if (!window.LightweightCharts) return;
    var dk = typeof window.escuro === "function" && window.escuro();
    var ch = window.LightweightCharts.createChart(alvo, { height: 320, layout: { background: { color: "transparent" }, textColor: dk ? "#93a0b3" : "#5a6678" }, grid: { vertLines: { visible: false }, horzLines: { color: dk ? "#243042" : "#e6e9ee" } }, rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false }, localization: { priceFormatter: function (v) { return "US$ " + nf(v, 0); } } });
    res.forEach(function (r) { var s = ch.addLineSeries({ color: nome(r.k).cor, lineWidth: 2, priceLineVisible: false, title: "" }); s.setData(r.curva.map(function (x) { return { time: x.time, value: x.value }; })); });
    var inv = ch.addLineSeries({ color: dk ? "#93a0b3" : "#5a6678", lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false }); inv.setData(res[0].curva.map(function (x) { return { time: x.time, value: x.inv }; }));
    ch.timeScale().fitContent(); if (EST.ch) { try { EST.ch.remove(); } catch (e) {} } EST.ch = ch;
  }

  /* ---- Calculadoras ---- */
  function montaCalc(sec) {
    sec.innerHTML = '<div class="duas"><div class="box"><h2>Juros compostos</h2><p class="sub">Valor inicial, aporte mensal e taxa ao ano. Os juros de cada mês passam a render também.</p>' +
      '<div class="pf-bar" style="margin-top:12px"><label>Valor inicial (R$)<input id="jc-ini" type="number" min="0" step="100" value="1000" style="width:120px"></label><label>Aporte mensal (R$)<input id="jc-mes" type="number" min="0" step="50" value="500" style="width:120px"></label><label>Taxa (% ao ano)<input id="jc-tx" type="number" min="0" max="200" step="0.5" value="10" style="width:90px"></label><label>Prazo (anos)<input id="jc-anos" type="number" min="1" max="50" step="1" value="10" style="width:80px"></label></div>' +
      '<div class="pf-res" id="jc-res"></div><div class="graf" id="jc-graf"></div></div>' +
      '<div class="box" id="cc-meta-box"><h2>Simulador de aportes</h2><p class="sub">Quanto aportar por mês para chegar a uma meta.</p>' +
      '<div class="pf-bar" style="margin-top:12px"><label>Meta (R$)<input id="mt-meta" type="number" min="0" step="1000" value="100000" style="width:130px"></label><label>Já tenho (R$)<input id="mt-ini" type="number" min="0" step="100" value="5000" style="width:120px"></label><label>Taxa (% ao ano)<input id="mt-tx" type="number" min="0" max="200" step="0.5" value="10" style="width:90px"></label><label>Prazo (anos)<input id="mt-anos" type="number" min="1" max="50" step="1" value="5" style="width:80px"></label></div>' +
      '<div class="pf-res" id="mt-res"></div><p class="note">A taxa é convertida para mensal: (1 + taxa anual)^(1/12) − 1. Não considera impostos nem inflação.</p></div></div>' +
      '<div class="box" id="cc-pm-box" style="margin-top:20px"><h2>Simulador de preço médio</h2><p class="sub">Some as suas compras para ver o preço médio. Depois, veja quanto comprar ao preço de hoje para levar o preço médio a um alvo.</p>' +
      '<div class="pscroll" style="margin-top:12px"><table class="pt" id="pm-tab"><thead><tr><th class="t">Compra</th><th>Quantidade</th><th>Preço pago</th><th>Total</th><th></th></tr></thead><tbody></tbody></table></div>' +
      '<p style="margin-top:8px"><button type="button" class="bt-sec" id="pm-add">+ Adicionar compra</button></p><div class="pf-res" id="pm-res"></div>' +
      '<div class="pf-bar"><label>Preço de hoje<input id="pm-hoje" type="number" min="0" step="any" value="" style="width:130px"></label><label>Preço médio desejado<input id="pm-alvo" type="number" min="0" step="any" value="" style="width:130px"></label><span class="sub" id="pm-alvo-res" style="padding-bottom:8px"></span></div></div>' +
      '';
    ["jc-ini", "jc-mes", "jc-tx", "jc-anos"].forEach(function (id) { $(id).addEventListener("input", jcCalc); });
    ["mt-meta", "mt-ini", "mt-tx", "mt-anos"].forEach(function (id) { $(id).addEventListener("input", metaCalc); });
    ["pm-hoje", "pm-alvo"].forEach(function (id) { $(id).addEventListener("input", pmCalc); });
    $("pm-add").addEventListener("click", function () { pmLinha(); pmCalc(); });
    pmLinha(1, 50000); pmLinha(1, 40000);
  }
  function brl(v) { return "R$ " + nf(v, 2); }
  function res(id, it) { var r = $(id); if (!r) return; r.textContent = ""; it.forEach(function (x) { var d = h("div"); d.appendChild(h("span", null, x[0])); d.appendChild(h("b", x[2] || "", x[1])); r.appendChild(d); }); }
  function jcCalc() {
    if (!$("jc-ini")) return; var C = +$("jc-ini").value || 0, A = +$("jc-mes").value || 0, i = Math.pow(1 + (+$("jc-tx").value || 0) / 100, 1 / 12) - 1, n = Math.round((+$("jc-anos").value || 1) * 12);
    var v = C, inv = C, pts = [], d0 = new Date(); for (var m = 1; m <= n; m++) { v = v * (1 + i) + A; inv += A; var dt = new Date(d0.getFullYear(), d0.getMonth() + m, 1); pts.push({ time: dt.toISOString().slice(0, 10), value: v, inv: inv }); }
    res("jc-res", [["Valor final", brl(v)], ["Total investido", brl(inv)], ["Juros ganhos", brl(v - inv), "pos"], ["Juros sobre o investido", nf(inv ? (v / inv - 1) * 100 : 0, 1) + "%"]]);
    var gf = G("grafFaz"); if (typeof gf === "function") gf("jc-graf", [{ tipo: "area", cor: "#1a7a4c", titulo: "Saldo", dados: pts.map(function (p) { return { time: p.time, value: p.value }; }) }, { tipo: "linha", cor: "#5a6678", titulo: "Investido", dados: pts.map(function (p) { return { time: p.time, value: p.inv }; }) }], function (x) { return nf(x, 0); });
  }
  function metaCalc() {
    if (!$("mt-meta")) return; var F = +$("mt-meta").value || 0, C = +$("mt-ini").value || 0, i = Math.pow(1 + (+$("mt-tx").value || 0) / 100, 1 / 12) - 1, n = Math.round((+$("mt-anos").value || 1) * 12);
    var fv0 = C * Math.pow(1 + i, n), falta = F - fv0, A = falta <= 0 ? 0 : i > 0 ? falta * i / (Math.pow(1 + i, n) - 1) : falta / n;
    res("mt-res", [["Aporte mensal necessário", brl(A)], ["Total que você vai aportar", brl(C + A * n)], ["Juros no período", brl(Math.max(0, F - C - A * n)), "pos"]].concat(falta <= 0 ? [["Observação", "o valor atual já chega à meta"]] : []));
  }
  function pmLinha(q, p) {
    var tb = document.querySelector("#pm-tab tbody"), tr = h("tr"); tr.style.cursor = "default"; var n = tb.children.length + 1;
    tr.appendChild(h("td", "t", n + "ª"));
    var a = h("td"), ia = h("input"); ia.type = "number"; ia.step = "any"; ia.min = "0"; ia.value = q != null ? q : ""; ia.style.width = "110px"; a.appendChild(ia); tr.appendChild(a);
    var b = h("td"), ib = h("input"); ib.type = "number"; ib.step = "any"; ib.min = "0"; ib.value = p != null ? p : ""; ib.style.width = "130px"; b.appendChild(ib); tr.appendChild(b);
    tr.appendChild(h("td", "pm-tot", "–")); var x = h("td"), bx = h("button", "bt-sec", "Remover"); bx.type = "button"; bx.addEventListener("click", function () { tr.remove(); pmCalc(); }); x.appendChild(bx); tr.appendChild(x);
    [ia, ib].forEach(function (i) { i.style.cssText += ";font:inherit;padding:5px 7px;border:1px solid var(--line);border-radius:4px;background:var(--surface);color:var(--fg);text-align:right"; i.addEventListener("input", pmCalc); });
    tb.appendChild(tr);
  }
  function pmCalc() {
    var tb = document.querySelector("#pm-tab tbody"); if (!tb) return; var Q = 0, T = 0;
    [].forEach.call(tb.children, function (tr, ix) { var i = tr.querySelectorAll("input"), q = +i[0].value || 0, p = +i[1].value || 0; tr.firstChild.textContent = (ix + 1) + "ª"; tr.querySelector(".pm-tot").textContent = q && p ? nf(q * p, 2) : "–"; Q += q; T += q * p; });
    var PM = Q ? T / Q : 0; res("pm-res", [["Quantidade total", nf(Q, 6).replace(/,?0+$/, "")], ["Total gasto", nf(T, 2)], ["Preço médio", PM ? nf(PM, PM < 1 ? 6 : 2) : "–"]]);
    var hj = +$("pm-hoje").value, al = +$("pm-alvo").value, o = $("pm-alvo-res");
    if (!PM || !hj || !al) { o.textContent = "Informe o preço de hoje e o preço médio que deseja."; return; }
    if (hj >= PM && al < PM) { o.textContent = "Com o preço de hoje acima do seu preço médio, novas compras aumentam o preço médio."; return; }
    if (!((al - hj) * (PM - al) > 0)) { o.textContent = "O alvo precisa estar entre o preço de hoje e o seu preço médio atual."; return; }
    var q = Q * (PM - al) / (al - hj); o.textContent = "Compre " + nf(q, 6).replace(/,?0+$/, "") + " unidades ao preço de hoje (" + nf(q * hj, 2) + " no total) para o preço médio ir a " + nf(al, 2) + ".";
  }

  /* ================= Academy ================= */
  var AC = [
    { n: "Básico", id: "ac-niv-bas", free: 1, l: [
      ["bitcoin", "Bitcoin", ["O Bitcoin é uma moeda digital criada em 2009 que funciona sem banco central nem empresa por trás. As regras estão no código e são seguidas por milhares de computadores no mundo inteiro.", "A oferta é limitada a 21 milhões de unidades, e a emissão de novas moedas cai pela metade a cada quatro anos, no evento chamado halving. Essa escassez programada é o principal argumento de quem vê o Bitcoin como reserva de valor.", "O preço oscila muito: quedas de 50% ou mais já aconteceram várias vezes. Por isso o tamanho da posição importa mais do que o momento da compra."], "m-cripto"],
      ["blockchain", "Blockchain", ["Blockchain é um registro público de transações dividido em blocos, em que cada bloco aponta para o anterior. Alterar um bloco antigo exigiria refazer todos os seguintes, o que torna o histórico praticamente imutável.", "Quem mantém a rede são os validadores (ou mineradores, no Bitcoin), que recebem uma recompensa para processar as transações e seguir as regras.", "Como tudo é público, dá para medir o comportamento dos investidores direto na rede. É daí que vêm os indicadores on-chain do Alpha Radar."], "m-onchain"],
      ["exchanges", "Exchanges", ["Exchanges (corretoras) são as empresas onde se compra e vende cripto em troca de reais ou dólares. Elas guardam as moedas dos clientes enquanto estão na plataforma.", "Há dois mercados principais: o à vista (spot), em que você compra a moeda de verdade, e o de futuros, em que se negocia um contrato sobre o preço, muitas vezes com alavancagem.", "Prefira corretoras reguladas, com prova de reservas publicada, e evite deixar valores grandes parados nelas. O ditado do mercado resume: quem não tem a chave não tem a moeda."], "f-renda"],
      ["wallets", "Wallets", ["Uma wallet (carteira) guarda as chaves privadas que dão acesso às suas moedas. Quem tem a chave controla os fundos.", "Carteiras de autocustódia podem ser apps (hot wallets) ou dispositivos físicos desconectados da internet (hardware wallets), mais seguros para valores altos.", "A frase de recuperação, de 12 ou 24 palavras, é a cópia de segurança da carteira. Ela nunca deve ser digitada em sites, fotografada ou enviada a ninguém."], null],
      ["stablecoins", "Stablecoins", ["Stablecoins são tokens que acompanham o valor de uma moeda, quase sempre o dólar. As maiores, USDT e USDC, são lastreadas em dinheiro e títulos do Tesouro americano.", "Elas são o caixa do mercado cripto: servem para sair de posições sem voltar ao banco e para aplicar em rendimentos em dólar dentro do DeFi.", "O risco está no emissor e no lastro. Por isso o Alpha Radar acompanha a oferta total de stablecoins como termômetro de liquidez."], "m-defi"],
      ["seguranca", "Segurança", ["Ative a autenticação em dois fatores por aplicativo em todas as contas e use senhas diferentes para cada serviço.", "Golpes comuns: falso suporte pedindo a frase de recuperação, sites que imitam corretoras, promessas de rendimento garantido e links de airdrop que pedem para assinar transações.", "Antes de assinar qualquer transação em uma carteira, leia o que está sendo autorizado. Na dúvida, não assine."], null]] },
    { n: "Intermediário", id: "ac-niv-int", l: [
      ["defi", "DeFi", ["DeFi (finanças descentralizadas) são serviços financeiros feitos por contratos inteligentes: empréstimos, trocas, derivativos e rendimentos sem intermediário.", "O TVL (valor total depositado) mede quanto dinheiro está nesses contratos e é o principal indicador do tamanho de um protocolo.", "Os riscos são de contrato (falhas no código), de oráculo (preço errado) e de governança. Rendimentos muito acima do mercado quase sempre pagam por algum desses riscos."], "m-defi"],
      ["staking", "Staking", ["Em redes de prova de participação, como o Ethereum, quem deposita moedas para validar blocos recebe uma recompensa: é o staking.", "O staking líquido entrega um token que representa a moeda depositada (como stETH), que pode ser usado em outros protocolos.", "O rendimento vem em moeda, não em dólar: se o preço cair, a recompensa não compensa a perda. Há também risco de penalidade (slashing) e de prazo para sacar."], "f-renda"],
      ["liquidez", "Liquidez", ["Pools de liquidez são reservas de dois ativos usadas para trocas em corretoras descentralizadas. Quem deposita recebe parte das taxas de cada troca.", "Quando o preço de um dos ativos muda muito, o depositante fica com mais do ativo que caiu: é a perda impermanente, que pode superar as taxas recebidas.", "Pools de stablecoins contra stablecoins quase não têm perda impermanente; pools de ativos voláteis pedem mais atenção."], "f-renda"],
      ["tokenomics", "Tokenomics", ["Tokenomics é a economia de um token: oferta total, emissão, distribuição entre equipe, investidores e comunidade, e o calendário de desbloqueios.", "Compare o valor de mercado com o valor totalmente diluído: uma diferença grande significa muita oferta ainda por entrar no mercado.", "Pergunte de onde vem a demanda pelo token: uso na rede, divisão de receita, governança ou só especulação."], "m-cripto"],
      ["onchain", "On-chain", ["Indicadores on-chain medem o comportamento dos investidores direto na blockchain.", "MVRV compara o preço com o custo médio de todas as moedas; SOPR mostra se quem vende está no lucro ou no prejuízo; NUPL mede o lucro não realizado do mercado; o fluxo nas corretoras mostra se moedas estão chegando para venda ou saindo para guarda.", "Nenhum indicador funciona sozinho. Eles descrevem a fase do ciclo, não o próximo movimento do preço."], "m-onchain"]] },
    { n: "Avançado", id: "ac-niv-adv", l: [
      ["protocolos", "Análise de protocolos", ["Para analisar um protocolo, comece pelo que ele faz e por quem paga por isso: receita e taxas mostram uso real; TVL sozinho pode ser inflado por incentivos.", "Avalie auditorias, tempo no ar sem incidentes, concentração de depositantes e dependência de outros protocolos.", "Compare valor de mercado com receita anualizada para ter uma noção de preço, como se faz com empresas na bolsa."], "i-an"],
      ["onchain-av", "Análise on-chain", ["Combine indicadores de ciclo (MVRV, NUPL) com indicadores de fluxo (corretoras, stablecoins, ETFs).", "O preço realizado dos detentores de curto prazo funciona como suporte em tendência de alta e resistência em tendência de baixa.", "Confirme sinais em mais de uma métrica antes de tirar conclusões e lembre que os dados chegam com atraso de um dia."], "m-onchain"],
      ["macro", "Macro", ["Cripto é um ativo de risco sensível à liquidez global. Juros altos e dólar forte costumam retirar dinheiro do mercado; o contrário costuma ajudar.", "Acompanhe as decisões do Fed e do Copom, a inflação (CPI e IPCA), os juros de 10 anos dos EUA e o índice do dólar (DXY).", "O calendário econômico do Alpha Radar mostra quando cada dado sai. Volatilidade costuma aumentar nesses horários."], "m-macro"],
      ["risco", "Gestão de risco", ["Defina antes de entrar quanto pode perder em cada operação e na carteira inteira. Uma regra comum é arriscar uma pequena fração do patrimônio por ideia.", "Alavancagem multiplica ganhos e perdas e traz o risco de liquidação. Em arbitragem, o risco está em uma das pernas ser liquidada.", "Diversificar entre estratégias com riscos diferentes (direção, contrato, contraparte) reduz a chance de uma perda grande."], "f-est"],
      ["carteira-av", "Construção de carteira", ["Uma carteira começa pelo objetivo e pelo prazo. Depois vem a divisão entre reserva, ativos principais e apostas menores.", "Rebalancear periodicamente devolve a carteira aos pesos escolhidos e força a vender o que subiu demais e comprar o que ficou para trás.", "Use o comparador de estratégias para ver como DCA, aporte único e rebalanceamento teriam se comportado no histórico."], "f-est"]] }
  ];
  function acChave() { var u = G("USUARIO"); return "ar_academy_" + (u ? u.id : "anon"); }
  function acFeitos() { return lsGet(acChave()) || {}; }
  function montaAc() {
    var ar = $("area-aulas"); if (!ar || $("ac-box")) return;
    var box = h("section", "box"); box.id = "ac-box";
    box.innerHTML = '<div class="ac-top"><div><h2 style="margin:0">Alpha Academy</h2><p class="sub" style="margin:4px 0 0">Do básico ao avançado, ligado aos painéis do Alpha Radar.</p></div><div><p class="sub" id="ac-prog-txt" style="margin:0 0 6px;text-align:right"></p><div class="ac-barra"><i id="ac-prog"></i></div></div></div>';
    var pz = h("div"); pz.id = "ac-pro";
    AC.forEach(function (nv) { var s = h("div", "ac-niv"); s.id = nv.id; var t = h("h3", null, nv.n); t.appendChild(h("span", "bdg " + (nv.free ? "free" : "pro"), nv.free ? "Free" : "Pro")); s.appendChild(t); var g = h("div", "ac-grid"); g.dataset.niv = nv.n; s.appendChild(g); (nv.free ? box : pz).appendChild(s); });
    box.appendChild(pz);
    var lei = h("section", "box"); lei.id = "ac-leitura"; lei.hidden = true;
    var cursos = h("p", "pd-sec-tit", "Aulas em vídeo do curso"); cursos.style.marginTop = "18px";
    var ref = ar.querySelector(":scope>.pd-guia"); ref = ref ? ref.nextSibling : ar.firstChild;
    ar.insertBefore(box, ref); ar.insertBefore(lei, ref); ar.insertBefore(cursos, ref);
  }
  function acDes() {
    montaAc(); var F = acFeitos(), tot = 0, ok = 0;
    AC.forEach(function (nv) { var g = document.querySelector('.ac-grid[data-niv="' + nv.n + '"]'); if (!g) return; g.textContent = "";
      nv.l.forEach(function (l) { tot++; if (F[l[0]]) ok++; var b = h("button", "ac-it" + (F[l[0]] ? " ok" : "")); b.type = "button"; b.appendChild(h("span", null, l[1])); b.appendChild(h("span", "st", F[l[0]] ? "✓ concluída" : "ler")); b.addEventListener("click", function () { acAbre(nv, l); }); g.appendChild(b); }); });
    $("ac-prog").style.width = (tot ? ok / tot * 100 : 0) + "%"; $("ac-prog-txt").textContent = ok + " de " + tot + " aulas concluídas";
    aplicaPro();
  }
  function acAbre(nv, l) {
    if (!nv.free && !ehPro()) { ir("prem"); return; }
    var s = $("ac-leitura"); s.hidden = false; var F = acFeitos();
    s.innerHTML = '<p class="pd-sec-tit" style="margin:0 0 6px">' + esc(nv.n) + '</p><h2 style="margin:0 0 12px;font:600 24px var(--serif)">' + esc(l[1]) + '</h2><div class="prosa">' + l[2].map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + '</div>' +
      '<p style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><button type="button" class="' + (F[l[0]] ? "bt-sec" : "bt-pro") + '" id="ac-feito">' + (F[l[0]] ? "✓ Concluída (desmarcar)" : "Marcar como concluída") + '</button>' + (l[3] ? '<button type="button" class="bt-sec" id="ac-ir">Ver na prática no Alpha Radar →</button>' : "") + '<button type="button" class="bt-sec" id="ac-fechar">Fechar</button></p>';
    $("ac-feito").addEventListener("click", function () { var f = acFeitos(); if (f[l[0]]) delete f[l[0]]; else f[l[0]] = Date.now(); lsSet(acChave(), f); acDes(); acAbre(nv, l); });
    if (l[3]) $("ac-ir").addEventListener("click", function () { ir(l[3]); });
    $("ac-fechar").addEventListener("click", function () { s.hidden = true; });
    s.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ================= Premium ================= */
  var ANUAL = { link: "" };
  function premDes() {
    var ar = novaArea("premium", "Alpha Pro"); if (!ar) return; var A = G("ASSINA") || {}, pro = ehPro();
    var mes = PRECO_MES, ano = PRECO_ANO, mesN = parseFloat(mes.replace(",", ".")), anoN = parseFloat(ano.replace(",", ".")), eco = mesN * 12 - anoN;
    ar.innerHTML = '<div class="pp-hero"><span class="rot" style="color:#7fd6e6;font:600 12px var(--sans);letter-spacing:.12em;text-transform:uppercase">Alpha Pro</span><h2>Inteligência de mercado completa, sem anúncios</h2><p>Dados avançados, histórico completo, simuladores profissionais, relatórios e a Academy inteira. ' + (pro ? "<b style='color:#7fd6e6'>Você já é Alpha Pro.</b>" : "Cancele quando quiser.") + '</p></div>' +
      '<div class="pp-planos">' +
      '<div class="pp-plano"><h3 style="margin:0;font:600 18px var(--sans)">Mensal</h3><div class="vl">R$ ' + mes + ' <small>/mês</small></div><p class="sub" style="margin:0">Sem fidelidade. Reembolso integral nos primeiros 7 dias.</p><button type="button" class="bt-pro" id="pp-mes"' + (pro ? " disabled" : "") + '>' + (pro ? "Plano ativo" : "Desbloquear Alpha Pro") + '</button><p class="sub" id="pp-msg-mes" hidden></p></div>' +
      '<div class="pp-plano dest"><span class="pp-selo">Economize ' + nf(eco / (mesN * 12) * 100, 0) + '%</span><h3 style="margin:0;font:600 18px var(--sans)">Anual</h3><div class="vl">R$ ' + ano + ' <small>/ano</small></div><p class="sub" style="margin:0">Equivale a R$ ' + nf(anoN / 12, 2) + ' por mês: <b>R$ ' + nf(eco, 2) + ' a menos</b> do que 12 meses do plano mensal.</p><button type="button" class="bt-pro" id="pp-ano"' + (pro ? " disabled" : "") + '>' + (pro ? "Plano ativo" : "Assinar o plano anual") + '</button><p class="sub" id="pp-msg-ano" hidden></p></div></div>' +
      '<section class="box"><h2>O que está incluído</h2><div class="pscroll"><table class="pp-comp"><thead><tr><th>Recurso</th><th>Free</th><th>Alpha Pro</th></tr></thead><tbody>' +
      [["Dashboard com Radar do Dia", 1, 1], ["Preços, tabela de criptomoedas e detalhe de cada ativo", 1, 1], ["Notícias e calendário econômico EUA e Brasil", 1, 1], ["Macro: juros, inflação, dólar e liquidez", 1, 1], ["Calculadoras e simuladores básicos (juros compostos, aportes, preço médio, DCA)", 1, 1], ["Minha Carteira: patrimônio, preço médio e lucro", 1, 1], ["Academy: nível Básico", 1, 1],
       ["Simulador de estratégias com dados históricos reais", 0, 1], ["Comparador de estratégias avançadas (quedas, rebalanceamento, personalizada)", 0, 1], ["Indicadores on-chain avançados (MVRV, SOPR, NUPL, fluxos)", 0, 1], ["Dados de ETFs de Bitcoin e Ethereum", 0, 1], ["DeFi avançado: TVL, protocolos, redes e yields", 0, 1], ["Renda e arbitragem: funding, pools, vaults, trades e opções", 0, 1], ["TradFi on-chain", 0, 1], ["Desempenho histórico da carteira", 0, 1], ["Alpha Reports, análises de ativos e newsletter", 0, 1], ["Alertas do Radar", 0, 1], ["Academy completa e aulas em vídeo", 0, 1]]
        .map(function (r) { return "<tr><td>" + esc(r[0]) + "</td><td class='" + (r[1] ? "s" : "n") + "'>" + (r[1] ? "✓" : "—") + "</td><td class='s'>✓</td></tr>"; }).join("") +
      '</tbody></table></div></section>' +
      '<section class="box"><h2>Dúvidas</h2><div class="lp-faq"><details><summary>Posso cancelar quando quiser?</summary><p>Sim. Não há fidelidade nem multa, e nos primeiros 7 dias você pode pedir o reembolso integral pela aba Suporte.</p></details><details><summary>O Alpha Pro diz o que comprar?</summary><p>Não. O Alpha Radar entrega dados, simulações e análises para você entender o mercado. A decisão é sempre sua.</p></details><details><summary>Como a assinatura é liberada?</summary><p>Assim que o pagamento é confirmado, o acesso Pro é liberado na sua conta. Se tiver qualquer problema, fale com o suporte.</p></details></div></section>' +
      '';
    var assinar = G("assinar");
    if (!pro) {
      $("pp-mes").addEventListener("click", function () { var m = $("pp-msg-mes"); if (typeof assinar === "function") assinar(m); });
      $("pp-ano").addEventListener("click", function () { var m = $("pp-msg-ano"); if (/^https:\/\//.test(ANUAL.link)) { window.open(ANUAL.link, "_blank", "noopener"); return; } if (typeof assinar === "function") assinar(m); });
    }
  }
  function cfgPremium() { var SB = G("SB"); if (!SB) return; SB.from("config_site").select("chave,valor").in("chave", ["link_pagamento_anual", "preco_anual", "preco"]).then(function (r) { (r.data || []).forEach(function (x) { if (x.chave === "link_pagamento_anual") ANUAL.link = x.valor || ""; if (x.chave === "preco_anual" && x.valor) PRECO_ANO = x.valor; if (x.chave === "preco" && x.valor) PRECO_MES = x.valor; }); if (!$("area-premium") || !$("area-premium").hidden) premDes(); }); }

  /* ================= Configurações ================= */
  function confDes() {
    var ar = novaArea("config", "Configurações"); if (!ar) return; var u = G("USUARIO"), p = plano();
    var nomePlano = p === "admin" ? "Administrador (acesso completo)" : p === "assinante" ? "Alpha Pro" : "Gratuito";
    var m = (u && u.user_metadata) || {};
    ar.innerHTML = '<div class="pc-grid">' +
      '<section class="box"><h2>Perfil</h2><form class="pc-form" id="pc-perfil"><label class="sub">Como quer ser chamado<input id="pc-nome" type="text" maxlength="40" value="' + esc(m.nome || "") + '" placeholder="Seu nome"></label><label class="sub">E-mail<input type="email" value="' + esc(u ? u.email : "") + '" disabled></label><p><button type="submit" class="bt-pro">Salvar</button></p><p class="pc-msg" id="pc-perfil-msg"></p></form></section>' +
      '<section class="box"><h2>Plano</h2><p style="font-size:18px;margin:6px 0"><b>' + esc(nomePlano) + '</b></p><p class="sub">' + (ehPro() ? "Você tem acesso a todos os recursos do Alpha Radar." : "Você usa o plano gratuito. Recursos marcados como Pro ficam disponíveis no Alpha Pro.") + '</p><p style="margin-top:10px"><button type="button" class="' + (ehPro() ? "bt-sec" : "bt-pro") + '" id="pc-ir-prem">' + (ehPro() ? "Ver o que está incluído" : "Conhecer Alpha Pro") + '</button></p><p class="sub" style="margin-top:12px">Para cancelar ou pedir reembolso, use a aba Suporte.</p></section>' +
      '<section class="box"><h2>Aparência</h2><p class="sub">Escolha o tema do painel.</p><div class="pers" id="pc-tema" style="margin-top:10px"><button type="button" data-t="light">Claro</button><button type="button" data-t="dark">Escuro</button><button type="button" data-t="">Seguir o sistema</button></div></section>' +
      '<section class="box"><h2>Segurança</h2><form class="pc-form" id="pc-senha"><label class="sub">Nova senha<input id="pc-nova" type="password" minlength="6" autocomplete="new-password" placeholder="6 ou mais caracteres" required></label><p><button type="submit" class="bt-sec">Alterar senha</button></p><p class="pc-msg" id="pc-senha-msg"></p></form></section>' +
      '<section class="box"><h2>Integrações</h2><p class="sub">Em breve: conexão automática com corretoras e carteiras para importar a sua carteira. Hoje, os ativos são cadastrados em Minha Carteira.</p><p style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="bt-sec" disabled>Conectar corretora · em breve</button><button type="button" class="bt-sec" disabled>Conectar carteira · em breve</button></p></section>' +
      '<section class="box"><h2>Sessão</h2><p class="sub">Sair desta conta neste aparelho.</p><p style="margin-top:10px"><button type="button" class="bt-sec" id="pc-sair">Sair</button></p></section></div>' +
      '';
    $("pc-ir-prem").addEventListener("click", function () { ir("prem"); });
    var tema = document.documentElement.getAttribute("data-theme") || "";
    [].forEach.call(ar.querySelectorAll("#pc-tema button"), function (b) { b.setAttribute("aria-pressed", b.dataset.t === tema ? "true" : "false"); b.addEventListener("click", function () { if (typeof window.temaPoe === "function") window.temaPoe(b.dataset.t || null); confDes(); }); });
    $("pc-perfil").addEventListener("submit", function (e) { e.preventDefault(); var SB = G("SB"), n = $("pc-nome").value.trim().slice(0, 40), msg = $("pc-perfil-msg"); if (!SB) return; msg.textContent = "Salvando…"; SB.auth.updateUser({ data: { nome: n } }).then(function (r) { if (r.error) { msg.textContent = "Não consegui salvar agora."; return; } if (r.data && r.data.user) window.USUARIO = r.data.user; msg.textContent = "Salvo."; }); });
    $("pc-senha").addEventListener("submit", function (e) { e.preventDefault(); var SB = G("SB"), msg = $("pc-senha-msg"), v = $("pc-nova").value; if (!SB || v.length < 6) { msg.textContent = "A senha precisa de 6 ou mais caracteres."; return; } msg.textContent = "Alterando…"; SB.auth.updateUser({ password: v }).then(function (r) { $("pc-nova").value = ""; msg.textContent = r.error ? "Não consegui alterar: " + (r.error.message || "tente de novo.") : "Senha alterada."; }); });
    $("pc-sair").addEventListener("click", function () { var s = $("conta-sair"); if (s) s.click(); });
  }

  /* ================= Minha Carteira ================= */
  function adicionarAtivo() { ir("cart"); if (typeof window.janela === "function") window.janela("lanc"); setTimeout(function () { var f = $("f-ativo"); if (f) { f.scrollIntoView({ behavior: "smooth", block: "center" }); f.focus(); } }, 200); }
  function montaCart() {
    var ar = $("area-carteira"); if (!ar || $("pc-cart-bar")) return;
    var bar = h("div"); bar.id = "pc-cart-bar"; bar.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between";
    var a = h("button", "bt-pro", "+ Adicionar ativo"); a.type = "button"; a.addEventListener("click", adicionarAtivo);
    var b = h("button", "bt-sec", "Conectar corretora ou carteira · em breve"); b.type = "button"; b.disabled = true; b.title = "Integração automática em preparação.";
    var w = h("div"); w.style.cssText = "display:flex;gap:8px;flex-wrap:wrap"; w.appendChild(a); w.appendChild(b); bar.appendChild(w);
    var ref = ar.querySelector(":scope>.pd-guia"); ar.insertBefore(bar, ref ? ref.nextSibling : ar.firstChild);
  }

  /* ================= Simulador dentro de Renda e arbitragem ================= */
  function simReal() {
    var f = $("sim-real"); if (!f) return; var painel = $("est-sim");
    var ativa = function () { if (!painel || painel.hidden || !painel.getClientRects().length) return; if (!ehPro()) { f.removeAttribute("src"); return; } if (!f.getAttribute("src")) f.setAttribute("src", f.dataset.src); };
    new MutationObserver(ativa).observe($("area-funding"), { attributes: true, subtree: true, attributeFilter: ["hidden"] });
    f.addEventListener("load", function () { try { var d = f.contentDocument; if (!d || !d.body) return; var ajusta = function () { var hgt = Math.ceil(d.documentElement.scrollHeight) + 4; if (hgt > 200) f.style.height = hgt + "px"; }; ajusta(); new ResizeObserver(ajusta).observe(d.body); var t = document.documentElement.getAttribute("data-theme"); if (t) d.documentElement.setAttribute("data-theme", t); } catch (e) {} });
    new MutationObserver(function () { try { var d = f.contentDocument, t = document.documentElement.getAttribute("data-theme"); if (d) { if (t) d.documentElement.setAttribute("data-theme", t); else d.documentElement.removeAttribute("data-theme"); } } catch (e) {} }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    ativa();
  }

  /* ================= Inicialização ================= */
  function rodape() { var m = document.querySelector("main"); if (!m || $("pd-rodape")) return; var p = h("p", "pd-risco", AVISO); p.id = "pd-rodape"; m.appendChild(p); }
  function rotaInicial() {
    var hs = (window.HASH0 || location.hash || "").replace("#", ""); window.HASH0 = ""; if (!hs || /access_token|refresh_token|error/.test(hs)) return;
    var a = hs.split("/")[0], s = hs.split("/")[1], k = null;
    NAV.some(function (g) { return g.it.some(function (i) { if (i.a === a && (i.s || "") === (s || (i.s || ""))) { k = i.k; return true; } }); });
    if (!k) NAV.some(function (g) { return g.it.some(function (i) { if (i.a === a) { k = i.k; return true; } }); });
    if (k && logado()) ir(k);
  }
  function init() {
    if (!$("areas") || !document.querySelector("main")) return;
    var st = h("style"); st.id = "plataforma-css"; st.textContent = css; document.head.appendChild(st);
    var T = G("TITULOS"); if (T) T.inicio = "Dashboard";
    novaArea("ferramentas", "Ferramentas"); novaArea("premium", "Alpha Pro"); novaArea("config", "Configurações");
    montaNav(); guias(); montaDash(); montaCripto(); montaCart(); montaAc(); rodape(); simReal();
    embrulha("acessoAplica", function () { aplicaPro(); estLibera(); });
    embrulha("contaDesenha", function () { aplicaPro(); if (!$("area-inicio").hidden) dashDes(); if (logado() && !D.rota) { D.rota = 1; setTimeout(rotaInicial, 400); cfgPremium(); } });
    embrulha("mercDesenha", function () { if (!$("area-inicio").hidden) dashDes(); if ($("mj-macro") && !$("mj-macro").hidden) macroDes(); });
    embrulha("cDesenha", function () { carteiraDes(); });
    embrulha("abasAplica", function () { var T2 = G("TITULOS"); if (T2) { T2.inicio = "Dashboard"; T2.ferramentas = "Ferramentas"; T2.premium = "Alpha Pro"; T2.config = "Configurações"; } espelhaOriginais(); });
    embrulha("mjanela", function (j) { if (j === "ativos") criptoDes(); var mk = { resumo: "m-resumo", ativos: "m-cripto", etfs: "m-etfs", macro: "m-macro", onchain: "m-onchain", defi: "m-defi", calendario: "m-cal", noticias: "i-nots" }[j]; if (mk && areaVisivel() === "mercado") marca(mk); });
    [].forEach.call(document.querySelectorAll("#mabas button"), function (b) { b.addEventListener("click", function () { var mx = $("mj-macro"); if (mx && b.dataset.mj !== "macro") mx.hidden = true; var bm = document.querySelector('#mabas button[data-mj="macro"]'); if (bm && b.dataset.mj !== "macro") bm.setAttribute("aria-selected", "false"); }); });
    mjMacroBotao();
    setInterval(function () { if (!$("area-inicio").hidden) dashDes(); }, 60000);
    setTimeout(function () { aplicaPro(); dashDes(); }, 1200);
    setTimeout(function () { aplicaPro(); dashDes(); }, 4000);
  }
  function mjMacroBotao() { var ab = $("mabas"); if (!ab || ab.querySelector('button[data-mj="macro"]')) return; var bt = h("button", null, "Macro"); bt.type = "button"; bt.setAttribute("role", "tab"); bt.dataset.mj = "macro"; bt.setAttribute("aria-selected", "false"); ab.insertBefore(bt, ab.querySelector('button[data-mj="onchain"]')); bt.addEventListener("click", function () { mjMacro(); marca("m-macro"); }); var sec = h("section"); sec.id = "mj-macro"; sec.hidden = true; var an = $("mj-onchain"); an.parentNode.insertBefore(sec, an); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
