@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo ==============================================
echo   AutoFix Gestion - inicio de la aplicacion
echo ==============================================
echo.

docker info >nul 2>&1
if errorlevel 1 (
  echo Docker Desktop no esta en ejecucion.
  echo Abralo, espere a que indique "Engine running" y vuelva a ejecutar este archivo.
  pause
  exit /b 1
)

if not exist .env copy .env.example .env >nul
set API_PORT=3000
set WEB_PORT=5173
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
  if "%%a"=="API_PORT" set API_PORT=%%b
  if "%%a"=="WEB_PORT" set WEB_PORT=%%b
)

echo [1/4] Construyendo y levantando los contenedores.
echo       La primera vez descarga dependencias y puede tardar entre 5 y 10 minutos.
docker compose up -d --build
if errorlevel 1 goto error

echo [2/4] Esperando la API y la base de datos...
set /a intentos=0
:esperar_api
set /a intentos+=1
if !intentos! gtr 300 goto error
curl -s -f http://localhost:%API_PORT%/salud >nul 2>&1
if errorlevel 1 (
  ping -n 3 127.0.0.1 >nul
  goto esperar_api
)

echo [3/4] Cargando los datos del caso de prueba AutoFix Conecta...
docker compose exec -T api pnpm --filter @autofix/api db:seed
if errorlevel 1 goto error
docker compose exec -T api touch /app/apps/api/dist/main.js
ping -n 6 127.0.0.1 >nul

echo [4/4] Esperando la aplicacion web...
set /a intentos=0
:esperar_web
set /a intentos+=1
if !intentos! gtr 150 goto error
curl -s -f http://localhost:%API_PORT%/salud >nul 2>&1
if errorlevel 1 (
  ping -n 3 127.0.0.1 >nul
  goto esperar_web
)
curl -s -f http://localhost:%WEB_PORT% >nul 2>&1
if errorlevel 1 (
  ping -n 3 127.0.0.1 >nul
  goto esperar_web
)

echo.
echo Listo. La aplicacion esta disponible en http://localhost:%WEB_PORT%
echo Para volver a los datos iniciales ejecute reiniciar-datos.bat
echo Para apagarla ejecute detener.bat
start "" http://localhost:%WEB_PORT%
pause
exit /b 0

:error
echo.
echo Ocurrio un error al iniciar. Revise que los puertos 3000, 5173, 5432 y 8088 esten libres
echo o cambielos en el archivo .env. Para ver el detalle ejecute: docker compose logs api
pause
exit /b 1
