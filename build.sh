#!/usr/bin/env bash
# Monta a pasta publicada: só os arquivos do site, sem scripts de coleta nem funções.
set -e
rm -rf dist && mkdir dist
for f in index.html config.js logo_claro.png logo_escuro.png aulas.json; do [ -f "$f" ] && cp "$f" dist/; done; [ -f _headers ] && cp _headers dist/
ls -la dist
