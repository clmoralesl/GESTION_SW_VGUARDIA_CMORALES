@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set API_PORT=3000
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
  if "%%a"=="API_PORT" set API_PORT=%%b
)

echo Restaurando los datos iniciales del caso de prueba AutoFix Conecta...
docker compose exec -T api pnpm --filter @autofix/api db:reset
if errorlevel 1 goto error
docker compose exec -T api touch /app/apps/api/dist/main.js
ping -n 6 127.0.0.1 >nul

set /a intentos=0
:esperar_api
set /a intentos+=1
if !intentos! gtr 90 goto error
curl -s -f http://localhost:%API_PORT%/salud >nul 2>&1
if errorlevel 1 (
  ping -n 3 127.0.0.1 >nul
  goto esperar_api
)

echo Listo. Recargue la pagina del navegador.
pause
exit /b 0

:error
echo Ocurrio un error. Verifique que la aplicacion este iniciada con iniciar.bat.
pause
exit /b 1
