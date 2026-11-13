@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Deteniendo AutoFix Gestion. Los datos se conservan para el proximo inicio.
docker compose down
pause
