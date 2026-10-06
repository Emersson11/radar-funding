@echo off
cd /d "%~dp0"
rem Preencha os dois valores abaixo com os dados do seu bot do Telegram
set TELEGRAM_TOKEN=
set TELEGRAM_CHAT_ID=
python alertas.py
