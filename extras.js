/* Alpha Radar: complementos carregados depois do app (login no servidor, calendário do Brasil,
   painel de TradFi com filtros e barras, atalho para o simulador). */
(function(){
"use strict";
function $(id){ return document.getElementById(id); }
function el(t,c,x){ var e=document.createElement(t); if(c) e.className=c; if(x!=null) e.textContent=x; return e; }
function pronto(fn){ if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",fn); else fn(); }
function nf(v,d){ return Number(v).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d}); }
function din(v){ var a=Math.abs(v), s=v<0?"− ":""; return s+"US$ "+(a>=1e9?nf(a/1e9,2)+" bi":a>=1e6?nf(a/1e6,1)+" mi":nf(a,0)); }
function pc(v){ return v==null||!isFinite(v)?"–":(v>=0?"+":"−")+nf(Math.abs(v),1)+"%"; }

/* ---------- 1. Sessão para o portão do servidor ---------- */
function gravaCookie(s){ try{ if(s&&s.access_token){ var ttl=Math.max(60,(s.expires_at?s.expires_at*1000-Date.now():3600e3)/1000|0); document.cookie="ar_at="+encodeURIComponent(s.access_token)+"; Path=/; Max-Age="+ttl+"; Secure; SameSite=Lax"; } else document.cookie="ar_at=; Path=/; Max-Age=0; Secure; SameSite=Lax"; }catch(e){} }
function ligaSessao(){ if(typeof SB==="undefined"||!SB||!SB.auth){ setTimeout(ligaSessao,500); return; }
  SB.auth.getSession().then(function(r){ gravaCookie(r.data&&r.data.session); });
  SB.auth.onAuthStateChange(function(ev,s){ gravaCookie(s); }); }
pronto(ligaSessao);

/* ---------- 2. Calendário: Estados Unidos e Brasil ---------- */
var CAL={pais:"todos"};
function paisDe(e){ return e.moeda==="BRL"?"Brasil":"EUA"; }
function calBR(){ var tb=$("cal-tb"); if(!tb||typeof MERC==="undefined"||!MERC) return;
  var tab=tb.closest("table"), th=tab&&tab.tHead&&tab.tHead.rows[0]; if(th&&!th.dataset.pais){ th.dataset.pais="1"; th.insertBefore(el("th",null,"País"),th.cells[2]); }
  var sec=$("mj-calendario"); if(sec&&!sec.dataset.br){ sec.dataset.br="1"; var h=sec.querySelector("h2"); if(h) h.textContent="Calendário econômico: Estados Unidos e Brasil"; var ctl=sec.querySelector(".controles"); if(ctl){ var lb=el("label",null,"País"), s=el("select"); [["todos","Estados Unidos e Brasil"],["EUA","Só Estados Unidos"],["Brasil","Só Brasil"]].forEach(function(o){ var op=el("option",null,o[1]); op.value=o[0]; s.appendChild(op); }); s.id="cal-pais"; s.addEventListener("change",function(){ CAL.pais=s.value; calBR(); }); lb.appendChild(s); ctl.insertBefore(lb,ctl.firstChild); }
    var n=sec.querySelector(".note"); if(n) n.textContent="Horários no fuso do seu aparelho. Estados Unidos: Forex Factory (nomes traduzidos). Brasil: Banco Central (Copom e Boletim Focus) e IBGE (IPCA, PIB, desemprego, indústria, comércio e serviços). Cobre a semana atual e a seguinte."; }
  var imp=$("cal-imp")?$("cal-imp").value:"2", per=$("cal-per")?$("cal-per").value:"tudo", h0=new Date(); h0.setHours(0,0,0,0); var agora=Date.now();
  var ev=(MERC.calendario||[]).filter(function(e){ return (e.impacto==="High"||e.impacto==="Medium")&&(e.moeda==="USD"||e.moeda==="BRL"); })
    .filter(function(e){ if(imp==="3"&&e.impacto!=="High") return false; if(CAL.pais!=="todos"&&paisDe(e)!==CAL.pais) return false; return per==="tudo"||Date.parse(e.data)>=h0.getTime(); })
    .sort(function(a,b){ return Date.parse(a.data)-Date.parse(b.data); });
  tb.textContent=""; var diaAnt="";
  ev.forEach(function(e){ var d=new Date(e.data), dia=d.toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit"}), tr=el("tr"); if(Date.parse(e.data)<agora) tr.className="passado";
    var c=function(x,k){ var td=el("td",k||"",x); tr.appendChild(td); return td; };
    c(dia===diaAnt?"":dia,"txt"); diaAnt=dia; c(d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})); c(paisDe(e),"txt"); c(e.impacto==="High"?"★★★":"★★",e.impacto==="High"?"txt estr3":"txt estr2"); c(e.titulo,"txt quebra"); c(e.previsao||"–"); c(e.anterior||"–"); tb.appendChild(tr); });
  if(!ev.length){ var tr=el("tr"), td=el("td","vazio","Nenhum evento com esses filtros."); td.colSpan=7; tr.appendChild(td); tb.appendChild(tr); }
  // Início: agenda com os dois países
  var ag=$("in-agenda"); if(ag){ var prox=(MERC.calendario||[]).filter(function(x){ return (x.moeda==="USD"||x.moeda==="BRL")&&(x.impacto==="High"||x.impacto==="Medium")&&Date.parse(x.data)>agora; }).sort(function(a,b){return Date.parse(a.data)-Date.parse(b.data);}).slice(0,8);
    if(prox.length){ ag.textContent=""; prox.forEach(function(x){ var tr=el("tr"); [new Date(x.data).toLocaleString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}),paisDe(x),x.impacto==="High"?"★★★":"★★",x.titulo].forEach(function(t,i){ tr.appendChild(el("td",i===3?"txt quebra":"txt",t)); }); ag.appendChild(tr); });
      var hh=ag.closest(".box"); if(hh){ var h2=hh.querySelector("h2"); if(h2) h2.textContent="Agenda: Estados Unidos e Brasil"; } } } }
function embrulha(nome,depois){ var f=window[nome]; if(typeof f!=="function"||f.__ar) return false; var g=function(){ var r=f.apply(this,arguments); try{ depois(); }catch(e){} return r; }; g.__ar=1; window[nome]=g; return true; }

/* ---------- 3. TradFi: filtros, barras e plataformas ---------- */
var TFX={busca:"",rede:"",min:0,max:0,var7:"",vis:"tabela",formato:""};
function redesDe(p){ return Object.keys(p.chainTvls||{}).filter(function(c){ return !/-|borrowed|staking|pool2|treasury|vesting/i.test(c); }); }
function tfFiltra(){ var l=(window.TF&&TF.rwa)||[]; return l.filter(function(p){ if(TFX.busca&&(p.name+" "+(p.category||"")).toLowerCase().indexOf(TFX.busca)<0) return false; if(TFX.rede&&redesDe(p).indexOf(TFX.rede)<0) return false; if(TFX.min&&p.tvl<TFX.min) return false; if(TFX.max&&p.tvl>TFX.max) return false; if(TFX.var7==="alta"&&!(p.change_7d>0)) return false; if(TFX.var7==="queda"&&!(p.change_7d<0)) return false; return true; }); }
function tfBarra(){ var tb=$("tf-rwa"); if(!tb) return; var box=tb.closest(".box"); if(!box||box.querySelector(".tfx-barra")) return;
  var bar=el("div","controles tfx-barra"); bar.style.cssText="margin:12px 0 4px;display:flex;flex-wrap:wrap;gap:10px 14px;align-items:flex-end";
  var campo=function(rot,inp){ var lb=el("label",null,rot); lb.appendChild(inp); bar.appendChild(lb); return inp; };
  var b=el("input"); b.type="search"; b.placeholder="Nome do protocolo"; campo("Buscar",b).addEventListener("input",function(){ TFX.busca=b.value.trim().toLowerCase(); tfAplica(); });
  var r=el("select"); r.id="tfx-rede"; campo("Rede",r).addEventListener("change",function(){ TFX.rede=r.value; tfAplica(); });
  var mn=el("select"); [["0","Qualquer"],["1e6","US$ 1 mi"],["1e7","US$ 10 mi"],["5e7","US$ 50 mi"],["1e8","US$ 100 mi"]].forEach(function(o){ var op=el("option",null,o[1]); op.value=o[0]; mn.appendChild(op); }); campo("Valor mínimo",mn).addEventListener("change",function(){ TFX.min=+mn.value; tfAplica(); });
  var mx=el("select"); [["0","Sem limite"],["1e7","US$ 10 mi"],["5e7","US$ 50 mi"],["1e8","US$ 100 mi"],["5e8","US$ 500 mi"],["1e9","US$ 1 bi"]].forEach(function(o){ var op=el("option",null,o[1]); op.value=o[0]; mx.appendChild(op); }); campo("Valor máximo",mx).addEventListener("change",function(){ TFX.max=+mx.value; tfAplica(); });
  var v7=el("select"); [["","Todas"],["alta","Só em alta"],["queda","Só em queda"]].forEach(function(o){ var op=el("option",null,o[1]); op.value=o[0]; v7.appendChild(op); }); campo("Variação em 7 dias",v7).addEventListener("change",function(){ TFX.var7=v7.value; tfAplica(); });
  var vs=el("div","pers"); vs.style.margin="0"; [["tabela","Tabela"],["barras","Gráfico de barras"]].forEach(function(o,i){ var bt=el("button",null,o[1]); bt.type="button"; bt.setAttribute("aria-pressed",i===0?"true":"false"); bt.addEventListener("click",function(){ TFX.vis=o[0]; [].forEach.call(vs.children,function(x){ x.setAttribute("aria-pressed",x===bt?"true":"false"); }); tfAplica(); }); vs.appendChild(bt); }); var lv=el("label",null,"Visualização"); lv.appendChild(vs); bar.appendChild(lv);
  var cont=el("p","sub tfx-cont"); cont.style.margin="6px 0 0";
  var sc=tb.closest(".scroll"); box.insertBefore(bar,sc); box.insertBefore(cont,sc); var gb=el("div","barras tfx-bars"); gb.hidden=true; gb.style.marginTop="10px"; box.insertBefore(gb,sc.nextSibling); }
function tfAplica(){ var tb=$("tf-rwa"); if(!tb) return; tfBarra(); var l=tfFiltra(), nomes={}; l.forEach(function(p){ nomes[p.name]=1; });
  var rs=$("tfx-rede"); if(rs&&rs.options.length<2){ var m={}; ((window.TF&&TF.rwa)||[]).forEach(function(p){ redesDe(p).forEach(function(c){ m[c]=(m[c]||0)+1; }); }); rs.textContent=""; var o0=el("option",null,"Todas"); o0.value=""; rs.appendChild(o0); Object.keys(m).sort(function(a,b){return m[b]-m[a];}).forEach(function(c){ var o=el("option",null,c+" ("+m[c]+")"); o.value=c; rs.appendChild(o); }); rs.value=TFX.rede; }
  [].forEach.call(tb.rows,function(tr){ tr.hidden=!(tr._v&&nomes[tr._v[1]]); });
  var tot=0; l.forEach(function(p){ tot+=p.tvl; }); var box=tb.closest(".box"), c=box.querySelector(".tfx-cont"); if(c) c.textContent=l.length+" protocolos com esses filtros, somando "+din(tot)+".";
  var sc=tb.closest(".scroll"), gb=box.querySelector(".tfx-bars"); sc.hidden=TFX.vis!=="tabela"; gb.hidden=TFX.vis!=="barras";
  if(TFX.vis==="barras"){ gb.textContent=""; var mx=l.length?l[0].tvl:1; l.slice(0,30).forEach(function(p){ var r=el("div","bl"), em=el("em"), i=el("i"), b=el("b",null,din(p.tvl)); var nm=el("span"); if(/^https:\/\//.test(p.url||"")){ var a=el("a",null,p.name); a.href=p.url; a.target="_blank"; a.rel="noopener"; nm.appendChild(a); } else nm.textContent=p.name; nm.title=p.name; r.appendChild(nm); i.style.width=Math.max(1.5,p.tvl/mx*100)+"%"; if(p.change_7d!=null) i.style.background=p.change_7d>=0?"var(--good)":"var(--bad)"; em.appendChild(i); r.appendChild(em); b.appendChild(el("small",null,pc(p.change_7d)+" em 7 dias")); r.appendChild(b); gb.appendChild(r); }); if(!l.length) gb.appendChild(el("p","sub","Nenhum protocolo com esses filtros.")); } }
function tfCards(){ var tp=$("tf-plat"); if(!tp||!window.TF||!TF.plat) return; var box=tp.closest(".box"); if(box.querySelector(".tfx-cards")) { tfCardsDes(); return; }
  var st=el("style"); st.textContent=".tfx-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-top:14px}.tfx-card{border:1px solid var(--line);border-top:3px solid var(--accent);border-radius:4px;padding:16px 18px;background:var(--surface);display:flex;flex-direction:column;gap:8px}.tfx-card h3{margin:0;font:600 17px/1.25 var(--serif)}.tfx-card h3 a{text-decoration:none}.tfx-card p{margin:0;font-size:14px;line-height:1.5;color:var(--muted)}.tfx-card .tg{display:flex;flex-wrap:wrap;gap:6px}.tfx-card .tg span{font:600 11.5px var(--sans);padding:3px 9px;border-radius:999px;background:var(--soft);color:var(--fg)}.tfx-card .tg span.perp{background:color-mix(in srgb,var(--warn) 18%,transparent)}.tfx-card .tg span.lastro{background:color-mix(in srgb,var(--good) 16%,transparent)}.tfx-card .ir{margin-top:auto;font-weight:600;font-size:14px}";
  document.head.appendChild(st);
  var fb=el("div","pers"); fb.style.marginTop="10px"; [["","Todas"],["Token lastreado no ativo","Tokens lastreados"],["Contrato perpétuo","Contratos perpétuos"],["Token que acompanha o preço","Tokens que acompanham o preço"]].forEach(function(o,i){ var b=el("button",null,o[1]); b.type="button"; b.setAttribute("aria-pressed",i===0?"true":"false"); b.addEventListener("click",function(){ TFX.formato=o[0]; [].forEach.call(fb.children,function(x){ x.setAttribute("aria-pressed",x===b?"true":"false"); }); tfCardsDes(); }); fb.appendChild(b); });
  var cards=el("div","tfx-cards"); var sc=tp.closest(".scroll"); sc.hidden=true; box.insertBefore(fb,sc); box.insertBefore(cards,sc); tfCardsDes(); }
function tfCardsDes(){ var box=$("tf-plat").closest(".box"), cards=box.querySelector(".tfx-cards"); cards.textContent=""; TF.plat.filter(function(p){ return !TFX.formato||p[3]===TFX.formato; }).forEach(function(p){ var c=el("article","tfx-card"), h=el("h3"), a=el("a",null,p[0]); a.href=p[1]; a.target="_blank"; a.rel="noopener"; h.appendChild(a); c.appendChild(h); var tg=el("div","tg"); tg.appendChild(el("span",/perp/i.test(p[3])?"perp":/lastreado/i.test(p[3])?"lastro":"",p[3])); p[4].split(/,| e /).map(function(x){return x.trim();}).filter(Boolean).slice(0,3).forEach(function(r){ tg.appendChild(el("span",null,r)); }); c.appendChild(tg); c.appendChild(el("p",null,p[2])); c.appendChild(el("p",null,p[5])); var ir=el("a","ir","Abrir o site"); ir.href=p[1]; ir.target="_blank"; ir.rel="noopener"; c.appendChild(ir); cards.appendChild(c); }); }

/* ---------- 4. Atalho para o simulador completo ---------- */
function atalhoSim(){ var s=$("est-sim"); if(!s||s.querySelector(".tfx-sim")) return; var b=el("div","box tfx-sim"); b.style.cssText="margin-bottom:20px;border-top:3px solid #3ebed6;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap"; var t=el("div"); t.appendChild(el("h2",null,"Simulador completo com backtest")); t.appendChild(el("p","sub","Compare onde o capital rende mais agora, faça backtest com dados reais de qualquer pool, vault, funding, trade ou opção e acompanhe uma carteira de simulação.")); b.appendChild(t); var a=el("a","btn-capa","Abrir o simulador"); a.href="simulador-estrategias.html"; a.style.textDecoration="none"; b.appendChild(a); s.insertBefore(b,s.firstChild); }

pronto(function(){
  var tenta=0; (function liga(){ tenta++; var ok1=embrulha("mercDesenha",calBR), ok2=embrulha("inicioDes",calBR), ok3=embrulha("tfRwa",tfAplica), ok4=embrulha("tfDes",tfCards); if(tenta<20&&!(ok1&&ok3&&ok4)) setTimeout(liga,500); })();
  ["cal-imp","cal-per"].forEach(function(i){ var e=$(i); if(e) e.addEventListener("change",function(){ setTimeout(calBR,0); }); });
  setTimeout(calBR,2500); atalhoSim();
});
})();
