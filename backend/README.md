# Ticketing API

Backend del producto **Ticketing** (mesa de ayuda / gestión de requerimientos, cliente Servigpoder de
NextByte). Servicio **FastAPI** separado que expone la API de dominio (tickets, áreas, categorías) que
el **WhatsApp Gateway + IA** (`meta-waba`) consume para crear/consultar tickets. Este repo es dueño del
**negocio**; el Gateway es dueño de la **mensajería**.

## Stack

Python 3.13 · FastAPI · Pydantic v2 · SQLAlchemy 2.0 async + asyncpg · PostgreSQL · Alembic.
Tests con pytest + aiosqlite (no requieren Postgres real).

## Arquitectura

Capas: `api` (routers) → `services` (lógica) → `adapters/repos` (datos) → `domain` (modelos + puertos).
El dominio no conoce FastAPI ni SQLAlchemy. Patrones: Ports & Adapters lite (`typing.Protocol`),
Repository, DI nativo de FastAPI. Ver `CLAUDE.md` para el detalle.

## Endpoints (incremento 1)

Todo bajo `API_PREFIX` (por defecto `/api`) y protegido por **service-token** (`Authorization: Bearer`).

- `POST /api/tickets` — crear (categoría por code → deriva área; devuelve `ticket_id`+`radicado`+`status`).
- `GET /api/tickets` — listar (filtros: status, category, assignee, from, to; page, page_size).
- `GET /api/tickets/{ticket_id}` · `PATCH /api/tickets/{ticket_id}` · `GET /api/tickets/by-radicado/{radicado}`.
- `GET/POST/PATCH/DELETE /api/areas` y `/api/categories` — catálogos (code público inmutable).
- `GET /health` — healthcheck (sin auth).

OpenAPI vivo en `/docs` y `/openapi.json`.

## Configuración (entorno)

Obligatorias (fail-fast): `DATABASE_URL`, `TICKETING_SERVICE_TOKEN`. Ver `.env.example` para el resto
(radicado, R2 groundwork, etc.). Genera el token con:
`python -c "import secrets; print(secrets.token_urlsafe(48))"`.

## Desarrollo (WSL)

El repo vive en WSL; la Bash del host es MINGW (sin python3). Usa el venv de WSL:

```bash
# Tests (SQLite en memoria; sin Postgres):
wsl -d ubuntu bash -lc "cd /home/ndrs/www/app_tickets && .venv/bin/python -m pytest -q"

# Stack local completo (app + postgres):
wsl -d ubuntu bash -lc "cd /home/ndrs/www/app_tickets && docker compose up --build"
```

En Postgres el esquema lo gestiona **Alembic** (`alembic upgrade head`, lo corre el entrypoint del
contenedor). En SQLite (tests) se usa `create_all`.

## Integración con el Gateway

El bot crea tickets por `POST /api/tickets` mandando `category` (code); el Ticketing valida y **deriva
el área**. El catálogo (`GET /api/areas`, `/api/categories`) lo cachea el Gateway para poblar menús y
validar codes. El evento de vuelta (Ticketing → usuario) y la descarga/copia de adjuntos llegan en
incrementos posteriores. Ver `docs/TICKETING_INTEGRATION.md` del repo `meta-waba`.
