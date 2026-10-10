#!/usr/bin/env bash
# Monta a pasta publicada: home, aplicação, simulador e recursos necessários.
set -e
rm -rf dist && mkdir dist
cp home.html dist/index.html
cp index.html dist/app.html
# Recursos extras do painel (calendário EUA+Brasil, filtros TradFi, sessão para páginas protegidas)
if [ -f extras.js ]; then echo "<script src=\"extras.js?v=$(date +%s)\"></script>" >> dist/app.html; fi
for f in simulador-estrategias.html extras.js plataforma.js config.js logo_claro.png logo_escuro.png aulas.json; do [ -f "$f" ] && cp "$f" dist/; done
[ -f _headers ] && cp _headers dist/
ls -la dist
