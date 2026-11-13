#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo
echo "=============================================="
echo "  AutoFix Gestión - inicio de la aplicación"
echo "=============================================="
echo

if ! docker info >/dev/null 2>&1; then
  echo "Docker no está en ejecución. Ábralo y vuelva a ejecutar este script."
  exit 1
fi

[ -f .env ] || cp .env.example .env
API_PORT=$(grep -E '^API_PORT=' .env | cut -d= -f2 || true)
WEB_PORT=$(grep -E '^WEB_PORT=' .env | cut -d= -f2 || true)
API_PORT=${API_PORT:-3000}
WEB_PORT=${WEB_PORT:-5173}

esperar() {
  local url=$1 maximo=$2 intento=0
  until curl -s -f "$url" >/dev/null 2>&1; do
    intento=$((intento + 1))
    if [ "$intento" -gt "$maximo" ]; then
      echo "No respondió $url. Revise: docker compose logs api"
      exit 1
    fi
    sleep 2
  done
}

echo "[1/4] Construyendo y levantando los contenedores (la primera vez tarda entre 5 y 10 minutos)..."
docker compose up -d --build

echo "[2/4] Esperando la API y la base de datos..."
esperar "http://localhost:${API_PORT}/salud" 300

echo "[3/4] Cargando los datos del caso de prueba AutoFix Conecta..."
docker compose exec -T api pnpm --filter @autofix/api db:seed
docker compose exec -T api touch /app/apps/api/dist/main.js
sleep 5

echo "[4/4] Esperando la aplicación web..."
esperar "http://localhost:${API_PORT}/salud" 150
esperar "http://localhost:${WEB_PORT}" 150

echo
echo "Listo. La aplicación está disponible en http://localhost:${WEB_PORT}"
echo "Para volver a los datos iniciales: ./reiniciar-datos.sh"
echo "Para apagarla: ./detener.sh"
if command -v open >/dev/null 2>&1; then
  open "http://localhost:${WEB_PORT}"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:${WEB_PORT}" >/dev/null 2>&1 || true
fi
