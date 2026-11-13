#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo "Deteniendo AutoFix Gestión. Los datos se conservan para el próximo inicio."
docker compose down
