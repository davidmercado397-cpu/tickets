# NextByte Seguimientos

SaaS multiempresa para gestionar **PQRS** (peticiones, quejas, reclamos, sugerencias, felicitaciones y
denuncias) de **clientes externos** (clientes corporativos y sus sedes/puestos) y **clientes internos**
(empleados), más **visitas de supervisión a puesto** con formularios dinámicos, **tareas** de seguimiento
e **indicadores**.

- `backend/`: API FastAPI organizada como monolito modular (ver [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)).
- `frontend/`: SPA React + Vite + Tailwind, responsive, servida por nginx.
- `docker-compose.yml`: la **misma** infraestructura en local y en la nube: Postgres, Redis, SeaweedFS (S3),
  API, worker, web y Mailpit (solo en el perfil local).

## Arranque local

Requisitos: Docker Desktop.

```bash
cp .env.example .env
```

Edita `.env` y reemplaza todos los valores `CAMBIAR` (contraseñas y secretos). Después:

```bash
docker compose up -d --build
```

| Servicio | URL |
|---|---|
| Aplicación (personal) | http://localhost:8080 |
| Portal público de PQRS | http://localhost:8080/portal/demo |
| API y documentación OpenAPI | http://localhost:8000/docs |
| Correos de prueba (Mailpit) | http://localhost:8025 |

Al arrancar por primera vez se siembran:

- el **superadministrador** (`SEED_SUPERADMIN_*`), que crea empresas en *Plataforma → Empresas*;
- la empresa demo **demo** ("Empresa Demo") con su administrador (`SEED_DEMO_*`), con roles, áreas, tipos y
  categorías de PQRS, SLA de 15 días hábiles y un formulario de visita de ejemplo.

## Desarrollo

```bash
# Pruebas del backend (en contenedor, sin Python local)
docker build --build-arg INSTALL_DEV=true -t pqrs-api:test backend
./backend/run-tests.sh

# Frontend con recarga en caliente (el proxy de Vite apunta a la API en :8000)
cd frontend && corepack pnpm install && corepack pnpm dev
corepack pnpm lint && corepack pnpm test && corepack pnpm build
```

Cambios de esquema: agrega una migración Alembic en `backend/alembic/versions/`. El contenedor `api`
ejecuta `alembic upgrade head` al arrancar.

## Integraciones

Desde *Configuración → Empresa → Integraciones* se generan API keys (cabecera `X-Api-Key`):

- `POST /api/integrations/pqrs`: radicación desde el bot de WhatsApp (`channel: "whatsapp"`) u otros sistemas.
- `GET /api/integrations/pqrs/{radicado}?code=`: consulta de estado.
- `POST /api/integrations/tasks`: tareas desde otros módulos (p. ej. **minutas**).

## Despliegue en la nube

Se usa el mismo `docker-compose.yml` con un `.env` de producción:

- `COMPOSE_PROFILES` vacío (sin Mailpit);
- SMTP real;
- `PUBLIC_BASE_URL` con el dominio;
- secretos nuevos;
- opcionalmente `S3_ENDPOINT_URL` apuntando a R2/S3.

Un proxy con TLS (Coolify, Traefik, Caddy) se pone delante del servicio `web` (puerto 80 del contenedor).
