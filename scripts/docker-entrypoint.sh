#!/bin/sh
set -eu

attempt=1
max_attempts=5

while [ "$attempt" -le "$max_attempts" ]; do
  echo "[homevault-entrypoint] Iniciando HomeVault (intento ${attempt}/${max_attempts})..."

  if node dist/index.js; then
    exit 0
  fi

  if [ "$attempt" -eq "$max_attempts" ]; then
    echo "[homevault-entrypoint] Fallo definitivo tras ${max_attempts} intentos."
    exit 1
  fi

  attempt=$((attempt + 1))
  echo "[homevault-entrypoint] Reintentando en 5 segundos..."
  sleep 5
done
