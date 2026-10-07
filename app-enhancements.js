/* Organização visual do painel autenticado. Mantém os botões originais para
   preservar seus eventos e regras de acesso já existentes. */
(function () {
  function init() {
    var nav = document.getElementById('areas');
    if (!nav || nav.dataset.organized === 'true') return;

    var buttons = {};
    nav.querySelectorAll('button[data-area]').forEach(function (button) {
      buttons[button.dataset.area] = button;
    });
    if (!buttons.inicio) return;

    nav.dataset.organized = 'true';
    nav.classList.add('areas-organizadas');

    var title = document.createElement('p');
    title.className = 'nav-produto';
    title.textContent = 'Explorar o Alpha Radar';
    nav.insertBefore(title, nav.firstChild);

    function addDirect(key, label) {
      if (!buttons[key]) return;
      if (label) buttons[key].textContent = label;
      nav.appendChild(buttons[key]);
    }

    function addGroup(name, keys, labels) {
      var group = document.createElement('section');
      group.className = 'nav-grupo';
      var label = document.createElement('p');
      label.className = 'nav-grupo-titulo';
      label.textContent = name;
      group.appendChild(label);
      keys.forEach(function (key) {
        if (!buttons[key]) return;
        if (labels && labels[key]) buttons[key].textContent = labels[key];
        group.appendChild(buttons[key]);
      });
      if (group.querySelector('button')) nav.appendChild(group);
    }

    addDirect('inicio', 'Visão geral');
    addGroup('Mercado', ['mercado', 'tradfi'], {
      mercado: 'Radar de mercado',
      tradfi: 'TradFi on-chain'
    });
    addGroup('Ferramentas', ['funding', 'carteira'], {
      funding: 'Estratégias e DeFi',
      carteira: 'Minha carteira'
    });
    addGroup('Insights', ['analises', 'relatorio', 'newsletter'], {
      analises: 'Análises e notícias',
      relatorio: 'Relatório de mercado',
      newsletter: 'Newsletter'
    });
    addGroup('Academy', ['aulas'], { aulas: 'Aulas e indicadores' });
    addDirect('suporte', 'Suporte');
    addDirect('admin', 'Administração');

    var style = document.createElement('style');
    style.textContent = [
      '#areas.areas-organizadas{gap:2px}',
      '#areas .nav-produto{display:none;margin:0 0 12px;padding:0 14px;color:#7fd6e6;font:600 11px/1.25 var(--sans);letter-spacing:.12em;text-transform:uppercase}',
      '#areas .nav-grupo{display:flex;flex-direction:column;gap:2px;margin:11px 0 3px}',
      '#areas .nav-grupo-titulo{display:none;margin:0;padding:0 14px 5px;color:var(--band-muted);font:600 10px/1.3 var(--sans);letter-spacing:.12em;text-transform:uppercase}',
      '#areas.areas-organizadas button{display:flex;align-items:center;min-height:36px;border-left:2px solid transparent;border-radius:4px}',
      '#areas.areas-organizadas button[aria-current="page"]{border-left-color:#3ebed6;background:rgba(127,214,230,.11)}',
      '@media (min-width:900px){#lado:hover #areas .nav-produto,#lado:focus-within #areas .nav-produto,#lado.aberto #areas .nav-produto,#lado:hover #areas .nav-grupo-titulo,#lado:focus-within #areas .nav-grupo-titulo,#lado.aberto #areas .nav-grupo-titulo{display:block}}',
      '@media (max-width:899px){#lado.aberto #areas .nav-produto,#lado.aberto #areas .nav-grupo-titulo{display:block}}'
    ].join('');
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());

