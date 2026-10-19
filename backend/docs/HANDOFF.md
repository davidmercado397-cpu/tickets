# HANDOFF — Ticketing API (contexto completo para retomar en otro chat)

> Pega este documento al inicio de un chat nuevo para dar todo el contexto. Complementa a `CLAUDE.md`
> (arquitectura/convenciones detalladas) y a `~/.claude/plans/scalable-brewing-cosmos.md` (roadmap).

## 1. Qué es

Backend del producto **Ticketing** (mesa de ayuda / gestión de requerimientos genérica; cliente piloto
**Servigpoder** de **NextByte**). Servicio **FastAPI** separado que expone la API de dominio (tickets, áreas,
categorías, empleados, certificados, SLA) que consume el **WhatsApp Gateway + IA** (`meta-waba`, repo hermano
en producción).

- **Este repo = negocio**: tickets, SLA, reportes, RBAC, áreas/categorías, empleados, certificados. Dueño de
  su BD (Postgres).
- **El Gateway (`meta-waba`) = mensajería**: WhatsApp, inbox, SSE, `/send`. No duplicamos mensajería.
- Frontera de correlación: `conversation_id` (Gateway) ↔ `ticket_id` (aquí).
- **El frontend** (React) va en **repo aparte** (no es este). Este repo es solo la API.

## 2. Repos y entorno

- **Este repo (backend):** GitHub `AndresDMO/internal_tickets`, rama `main`. Vive en WSL:
  `/home/ndrs/www/app_tickets`.
- **Gateway hermano (referencia):** `/home/ndrs/www/meta-waba` (solo se lee como referencia de patrones).
- **Entorno:** el repo vive en WSL; la Bash del host es MINGW (sin python3). Usa el venv de WSL:
  ```bash
  wsl -d ubuntu bash -lc "cd /home/ndrs/www/app_tickets && .venv/bin/python -m pytest -q"
  ```

## 3. Stack y arquitectura

- Python 3.13 · FastAPI · Pydantic v2 · **SQLAlchemy 2.0 async + asyncpg** · PostgreSQL · Alembic · Redis
  (bus SSE) · httpx + tenacity (Gateway) · fpdf2 (PDF) · aioboto3 (R2) · aiosmtplib (email). Tests: pytest +
  aiosqlite + fakeredis + respx (**no necesitan Postgres/Redis reales**).
- **Capas:** `api` (routers) → `services` (lógica) → `adapters/repos` (datos/externos) → `domain` (modelos +
  puertos). El dominio NO conoce FastAPI ni SQLAlchemy.
- **Patrones permitidos SOLO:** Ports & Adapters lite (`typing.Protocol` en `app/domain/ports.py`), Repository
  (`app/adapters/*_repo.py`), DI nativa de FastAPI (`Depends`, en `app/dependencies.py`), Strategy+registro
  (usado en canales de notificación). PROHIBIDO: CQRS, event-sourcing, mediator, ORMs mágicos, contenedor DI.
- **KISS manda** → SOLID → DRY balanceado → YAGNI.
- **Single-tenant** (Servigpoder = una empresa). No hay filtro `org_id`.
- **Config-as-data**: áreas/categorías/SLA se modelan con datos, no código nuevo.
- **Convención de idioma:** identificadores/**códigos/valores de enum en INGLÉS**; el **español va SOLO en
  labels** (los pone el frontend, o el `name` de un catálogo). Excepción: los `code` de áreas/categorías son
  data del cliente (slugify de nombres en español). **Nombres de tests en inglés.** Comentarios en español.

## 4. Estado: incrementos 1–7 HECHOS (suite verde, 84 tests)

- **Inc 1 — catálogos + tickets:** Area/Category con `code` público inmutable (slugify, `^[a-z0-9_-]{2,40}$`);
  categoría 1—* área. `POST /tickets` recibe `category` (code) → deriva el área; `area` hint opcional
  (mismatch → acepta + warning). Radicado `{PREFIX}-{YYYY}-{NNNNNN}` (secuencia anual atómica, año hora
  Colombia). History por cambio de estado. Adjuntos = **solo se referencia la URL pública** (no se descarga).
- **Inc 2 — usuarios + RBAC + cola:** `users` (Role `admin|agent`, scrypt), membresía muchos-a-muchos
  usuario↔área. Login `POST /api/auth/login` → JWT HS256 (8h); `GET /api/auth/me`. **Primer admin sembrado
  en el arranque** (`SEED_ADMIN_*`). Gestión in-app: `/api/users` (admin). Auth dual: **service-token** (bot,
  acceso total) o **JWT** (RBAC) vía `require_caller`. Agente ve/gestiona solo tickets de sus áreas (fuera →
  404); admin/service ven todo. Filtro `open_only` = cola.
- **Inc 3 — notificaciones push:** al crear → grupo del área; al asignar (`assignee`=email) → esa persona.
  Canal **in-app** (tabla `notifications` + bus Redis + SSE `GET /api/notifications/stream`) SIEMPRE; canales
  externos **WhatsApp** (plantilla vía `/send`) y **email** (SMTP) best-effort, gateados por config.
- **Inc 4 — empleados:** tabla `employees` (document/cédula única, full_name, position, hire_date,
  contract_type, status, `data` JSONB) tras puerto `EmployeeDirectory`. `GET /api/employees/{document}` (bot);
  CRUD + búsqueda `?q=` (admin).
- **Inc 5 — certificado laboral:** `POST /api/employees/{document}/certificate` (bot): valida empleado →
  genera PDF fresco (fpdf2, plantilla del ejemplo Servigpoder; **se regenera en cada solicitud**, fecha=hoy)
  → sube a **R2 propio** (URL firmada corta) → registra la emisión como **ticket** `certificado_laboral` (el
  bot lo cierra tras enviar). Sin R2 → 503. Salario diferido.
- **Inc 6 — SLA por prioridad (calendario 24/7):** tabla `sla_policies` (config-as-data, **arranca VACÍA**;
  los tiempos los define el cliente por `PUT /api/sla-policies/{priority}`). Al crear, el ticket calcula
  `response_due_at`/`resolution_due_at`; marca `first_response_at`/`resolved_at`; incumplimiento derivado al
  leer (`ticket.sla`). **OJO:** la tabla SLA de la propuesta (99.5%, Crítico/Alto/Medio/Leve) es el SLA del
  SERVICIO de NextByte, NO el de los tickets → no se siembra.
- **Inc 7 — evento de vuelta al usuario:** al cambiar a un estado disparador (`NOTIFY_USER_STATUSES`, default
  `closed`) → avisa al solicitante por WhatsApp vía `/send` del Gateway (best-effort, gateado por config).
- **+ CORS** configurable (`CORS_ORIGINS`), **seed admin**, `GATEWAY_INTERNAL_KEY` separado.

## 5. Enums (codes en inglés; labels los pone el front)

- `TicketStatus`: `open, in_review, assigned, in_progress, on_hold, closed, rejected`
- `Priority`: `low, medium, high, critical`
- `HistoryActor`: `user, ai, human, system`
- `Role`: `admin, agent` · `NotificationType`: `ticket_created, ticket_assigned`

## 6. Endpoints (base `/api`)

- Tickets: `POST /tickets` (bot) · `GET /tickets` (filtros status/category/assignee/from/to/open_only/page) ·
  `GET /tickets/{id}` · `PATCH /tickets/{id}` · `GET /tickets/by-radicado/{radicado}` (bot)
- Catálogos: `GET/POST/GET{id}/PATCH/DELETE /areas` y `/categories`
- Auth: `POST /auth/login` · `GET /auth/me`
- Usuarios: `GET/POST/GET{id}/PATCH /users` (admin)
- Notificaciones: `GET /notifications` · `/unread-count` · `POST /{id}/read` · `/read-all` · `GET /stream` (SSE)
- Empleados: `GET/POST /employees` · `GET/PATCH /employees/{document}`
- Certificado: `POST /employees/{document}/certificate` (bot)
- SLA: `GET /sla-policies` · `PUT /sla-policies/{priority}` (admin)
- `GET /health` (sin auth). OpenAPI vivo en `/docs` y `/openapi.json` (copia en `docs/openapi.json`).

## 7. Modelo de datos / migraciones

Tablas: `areas`, `categories`, `tickets`, `ticket_attachments`, `ticket_history`, `counters`, `users`,
`user_areas`, `notifications`, `employees`, `sla_policies`. Migraciones Alembic `0001`–`0005` (canónicas en
Postgres; en tests SQLite `create_all`). Tipo `GUID` portable (uuid nativo PG / CHAR(32) SQLite).

## 8. Despliegue (Coolify) — estado actual

- **Backend DESPLEGADO y sano:** `https://api-ticket.nextbyte.com.co` (`/health` → `{"status":"ok"}`).
  Dockerizado igual que `meta-waba` (multi-stage; entrypoint corre `alembic upgrade head` + uvicorn en **8000**;
  HEALTHCHECK `/health`). Recursos: PostgreSQL + Redis.
- **Frontend:** `https://demo-ia.nextbyte.com.co` (repo aparte; nginx sirve el SPA + proxya `/api`).
  **BUG ACTUAL:** su nginx proxya `/api` a `host.docker.internal` (solo existe en Docker Desktop) → **502** en
  `/api/*`. **Fix:** apuntar el proxy al backend (`https://api-ticket.nextbyte.com.co`, con `proxy_ssl_server_name
  on` + `Host`), o llamar directo con CORS (`CORS_ORIGINS=https://demo-ia.nextbyte.com.co`). Su nginx usa
  envsubst → probablemente basta setear una env var (`API_URL`/`VITE_API_URL`/similar) al dominio del backend.

### Variables de entorno (backend)
**Obligatorias (fail-fast):**
- `DATABASE_URL=postgresql+asyncpg://user:pass@HOST:5432/db` (¡con `+asyncpg`; HOST interno de Coolify!)
- `TICKETING_SERVICE_TOKEN` — **token de la integración** (el bot lo manda como `Authorization: Bearer`)
- `AUTH_JWT_SIGNING_KEY` — ≥32 chars, firma los JWT del front (interno)

**Bootstrap admin:** `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (crea el 1er admin al arrancar, idempotente).
**Infra:** `REDIS_URL=redis://host:6379/0`. **CORS:** `CORS_ORIGINS` (dominios del front, coma-separados).
**Gateway (WhatsApp saliente):** `GATEWAY_BASE_URL`, `GATEWAY_INTERNAL_KEY` (la clave INTERNA del Gateway).
**Certificado + R2:** `R2_ENDPOINT_URL`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_REGION=auto`,
`R2_SIGNED_URL_TTL_SECONDS=3600`; textos `CERT_SIGNATORY_NAME/TITLE/FOOTER_WHATSAPP/CITY/ORG_HEADER`, `CERT_LOGO_PATH`.
**Notif WhatsApp/email/evento-vuelta:** `NOTIFY_WHATSAPP_ENABLED`, `WHATSAPP_TEMPLATE_NAME`, `NOTIFY_USER_ENABLED`,
`USER_EVENT_TEMPLATE_NAME`, `NOTIFY_USER_STATUSES=closed`, `NOTIFY_EMAIL_ENABLED`, `SMTP_*`. Ver `.env.example`.

### Las 3 claves (no confundirlas)
| Variable | Dirección | Para qué |
|---|---|---|
| `TICKETING_SERVICE_TOKEN` | bot → nosotros | **La integración** (crear/consultar tickets, empleados, certificados) |
| `GATEWAY_INTERNAL_KEY` | nosotros → Gateway | Llamar a su `/send` (WhatsApp) |
| `AUTH_JWT_SIGNING_KEY` | interno | Firma JWT de sesión del front |

Generar tokens: `python -c "import secrets; print(secrets.token_urlsafe(48))"`.

## 9. Para la integración del Gateway (F4)
- base_url: `https://api-ticket.nextbyte.com.co` · auth: `Bearer <TICKETING_SERVICE_TOKEN>`
- El bot llama: `POST /api/tickets`, `GET /api/tickets/by-radicado/{radicado}`, `GET /api/employees/{document}`,
  `POST /api/employees/{document}/certificate`. Prerequisito: crear la categoría `certificado_laboral` y cargar
  empleados. F4 (wiring en el Gateway) está PENDIENTE del lado de `meta-waba`.

## 10. Pendiente / roadmap
- **Paso 8:** estados como **catálogo `ticket_states`** (code inglés + `name` español + `pauses_sla`/`is_final`
  editables + cache, estilo Aranda) reemplazando el enum `TicketStatus`; + **pausa** del reloj SLA (usa
  `pauses_sla`). `on_hold` = "En espera". Fue lo último acordado, sin empezar.
- **Paso 9:** SLA en **horario hábil** (jornada L–V + festivos Colombia con lib `holidays`) + pausa.
- **Reportes/BI** (usan las marcas SLA para "cumplimiento de tiempos"; casos por área/responsable/categoría).
- **Frontend** (repo aparte, no existe aún la parte de agentes/inbox).
- **SSE para el front:** `EventSource` no puede mandar `Authorization` → aceptar el token por query en `/stream`.
- Menores: refresh-token del JWT; certificado con salario (columna + wording); import masivo de empleados (CSV);
  ¿ERP para empleados?; adjuntos: copia solo si cambia la asunción de URL permanente.
- **Config pendiente producción:** logo PNG + credenciales R2 (certificado); **plantillas WhatsApp aprobadas**
  en Meta (staff + usuario); crear categoría `certificado_laboral` + cargar empleados + definir políticas SLA.

## 11. Decisiones clave (respetarlas)
Single-tenant · adjuntos por referencia (URLs públicas del R2 del Gateway) · SLA de tickets ≠ SLA del servicio
(no sembrar los tiempos de la propuesta) · codes/enums en inglés, labels en español · seed del admin (no
endpoint operador) · `GATEWAY_INTERNAL_KEY` ≠ nuestra auth · SLA reloj calendario 24/7 (MVP) · certificado
on-demand (no cachear) · tests en inglés · usuario trabaja **por pasos** y confirma cada decisión.
