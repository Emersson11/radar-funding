#!/usr/bin/env bash
# Monta a pasta publicada: home, aplicação, simulador, guias e recursos de SEO.
set -e
rm -rf dist && mkdir dist
cp home.html dist/index.html
cp index.html dist/app.html
# Recursos extras do painel (calendário EUA+Brasil, filtros TradFi, sessão para páginas protegidas)
if [ -f extras.js ]; then echo "<script src=\"extras.js?v=$(date +%s)\"></script>" >> dist/app.html; fi
for f in simulador-estrategias.html extras.js plataforma.js config.js logo_claro.png logo_escuro.png aulas.json; do [ -f "$f" ] && cp "$f" dist/; done
[ -f _headers ] && cp _headers dist/
# Versão nos scripts para o navegador sempre pegar a publicação nova
V=$(date +%s); sed -i "s#src=\"plataforma.js\"#src=\"plataforma.js?v=$V\"#" dist/app.html
# SEO: título, descrição, metatags, ícones, robots, sitemap e guias
if [ -d seo ]; then
  for f in seo/google*.html; do [ -f "$f" ] && cp "$f" dist/; done
  for f in robots.txt sitemap.xml site.webmanifest og-image.png favicon.ico favicon-32.png apple-touch-icon.png icon-192.png icon-512.png; do [ -f "seo/$f" ] && cp "seo/$f" dist/; done
  sed -i 's#<title>[^<]*</title>#<title>Alpha Radar | Inteligência de mercado cripto, ETFs, macro e DeFi</title>#' dist/index.html
  sed -i 's#<meta name="description" content="[^"]*">#<meta name="description" content="Painel em português com dados ao vivo de cripto, ETFs de Bitcoin, macro, on-chain e DeFi, simuladores com histórico real e Alpha Academy. Comece grátis.">#' dist/index.html
  if [ -f seo/seo_head.html ] && ! grep -q 'rel="canonical"' dist/index.html; then awk 'FNR==NR{b=b $0 "\n"; next} /<\/head>/ && !d {printf "%s", b; d=1} {print}' seo/seo_head.html dist/index.html > dist/i.tmp && mv dist/i.tmp dist/index.html; fi
  if [ -f seo/app_head.html ]; then awk 'FNR==NR{b=b $0 "\n"; next} /<\/head>/ && !d {printf "%s", b; d=1} {print}' seo/app_head.html dist/app.html > dist/a.tmp && mv dist/a.tmp dist/app.html; fi
fi
[ -d guias ] && cp -r guias dist/guias
ls -la dist
