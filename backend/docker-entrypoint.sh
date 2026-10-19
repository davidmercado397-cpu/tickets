#!/bin/sh
# Rol del contenedor: "api" (por defecto) aplica migraciones y arranca uvicorn; "worker" arranca el worker.
set -e

if [ "$1" = "worker" ]; then
  exec python -m app.worker
fi

echo "Aplicando migraciones (alembic upgrade head)..."
alembic upgrade head

if [ "${APP_RELOAD:-false}" = "true" ]; then
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --proxy-headers --forwarded-allow-ips='*'
fi
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'
