#!/bin/sh
# Aplica las migraciones (esquema canónico en Postgres) y arranca el servidor.
set -e

echo "Aplicando migraciones (alembic upgrade head)..."
alembic upgrade head

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
