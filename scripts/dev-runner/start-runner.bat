@echo off
title PROCIMEC Autonomous DevOps Engine
cd /d "%~dp0\..\.."

echo =======================================================
echo   PROCIMEC PCM CLOUD — AUTONOMOUS DEVOPS ENGINE
echo =======================================================
echo.

:: 1. Iniciar Bot de Telegram en segundo plano / minimizado
echo [1/2] Iniciando Telegram Bot (@procimec_dev_bot)...
start "PROCIMEC Telegram Bot" /min cmd /c "cd /d "%~dp0\..\..\bot-telegram" && node bot.js"

:: 2. Iniciar Runner Autónomo CLI
echo [2/2] Iniciando Runner DevOps CLI Continuo...
npm run devops

pause
