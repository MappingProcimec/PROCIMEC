@echo off
title PROCIMEC Autonomous Dev Runner
cd /d "%~dp0\..\.."
echo Iniciando Runner Dev Autonomo de PROCIMEC...
npm run worker:dev
pause
