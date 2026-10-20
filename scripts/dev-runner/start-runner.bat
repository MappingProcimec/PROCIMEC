@echo off
title PROCIMEC Autonomous Dev Engine
cd /d "%~dp0\..\.."

echo =======================================================
echo   INICIANDO MOTOR COMPLETO PROCIMEC (DEV RUNNER + BOT)
echo =======================================================

:: 1. Iniciar Bot de WhatsApp en proceso separado minimizado
echo [1/2] Iniciando WhatsApp Bot...
start "PROCIMEC WhatsApp Bot" /min cmd /c "cd /d "%~dp0\..\..\bot-whatsapp" && node bot.js"

:: 2. Iniciar Runner Dev Autonomo
echo [2/2] Iniciando Runner Dev Autonomo...
npm run worker:dev

pause
