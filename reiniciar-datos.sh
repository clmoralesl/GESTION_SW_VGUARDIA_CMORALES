#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

API_PORT=$(grep -E '^API_PORT=' .env | cut -d= -f2 || true)
API_PORT=${API_PORT:-3000}

echo "Restaurando los datos iniciales del caso de prueba AutoFix Conecta..."
docker compose exec -T api pnpm --filter @autofix/api db:reset
docker compose exec -T api touch /app/apps/api/dist/main.js
sleep 5

intento=0
until curl -s -f "http://localhost:${API_PORT}/salud" >/dev/null 2>&1; do
  intento=$((intento + 1))
  if [ "$intento" -gt 90 ]; then
    echo "La API no respondió. Verifique que la aplicación esté iniciada con ./iniciar.sh"
    exit 1
  fi
  sleep 2
done

echo "Listo. Recargue la página del navegador."
