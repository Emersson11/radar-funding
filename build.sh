#!/usr/bin/env bash
# Monta a pasta publicada: home, aplicação, simulador e recursos necessários.
set -e
rm -rf dist && mkdir dist
cp home.html dist/index.html
cp index.html dist/app.html
for f in simulador-estrategias.html config.js logo_claro.png logo_escuro.png aulas.json; do [ -f "$f" ] && cp "$f" dist/; done
[ -f _headers ] && cp _headers dist/
ls -la dist
