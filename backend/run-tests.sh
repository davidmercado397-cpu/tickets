#!/bin/sh
# Corre la suite dentro del contenedor de desarrollo montando el código (sin Python local).
#   ./run-tests.sh            (toda la suite)
#   ./run-tests.sh -k visits  (argumentos de pytest)
cd "$(dirname "$0")"
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W 2>/dev/null || pwd):/app" -w /app --entrypoint python pqrs-api:test -m pytest -q "$@"
