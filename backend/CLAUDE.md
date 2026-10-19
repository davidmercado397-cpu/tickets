# CLAUDE.md — Ticketing API

Guía para retomar este repo sin contexto previo. Léela entera antes de tocar código.

## Qué es

Backend del producto **Ticketing** (mesa de ayuda / gestión de requerimientos genérica; cliente piloto
Servigpoder de NextByte). Servicio **FastAPI** separado que expone la API de dominio (tickets, áreas,
categorías) que consume el **WhatsApp Gateway + IA** (`meta-waba`, repo hermano, en producción).

- **Este repo = negocio**: tickets, SLA, reportes, RBAC, áreas/categorías. Dueño de su BD (Postgres).
- **El Gateway = mensajería**: WhatsApp, inbox, SSE, `/send`. No duplicamos mensajería.
- Frontera de correlación: `conversation_id` (Gateway) ↔ `ticket_id` (aquí).

## Estado: incrementos 1–7 (hechos)

Suite verde (`pytest`, 85 tests sobre SQLite).

**Inc 1 — catálogos + tickets:**
- **Catálogos Area/Category** con `code` público **inmutable** (`^[a-z0-9_-]{2,40}$`, autogenerado con
  `slugify(name)`, editable solo en la creación). Categoría **pertenece a un área (1—*)**.
- **Tickets**: `POST /tickets` recibe `category` (code, requerida) → **deriva el área** de la categoría.
  `area` es hint opcional de cross-check: en mismatch se ACEPTA y se usa la de la categoría + warning
  (no se pierde el ticket). `area_id` es NOT NULL. Radicado `{PREFIX}-{YYYY}-{NNNNNN}` (secuencia anual
  atómica vía tabla `counters`; el **año sigue la hora local Colombia** vía `LOG_TZ_OFFSET_HOURS`; el
  prefijo es configurable y se omite limpio si va vacío). History por cambio de estado. Adjuntos = **solo
  se referencia la URL** pública de R2 (no se descarga ni copia).

**Inc 2 — usuarios + RBAC + cola de área:**
- **Usuarios** (`users`) con **Role** `admin|agent`, contraseña **scrypt**, membresía **muchos-a-muchos**
  usuario↔área (`user_areas`). Login `POST /api/auth/login` → **JWT HS256** (sesión 8h); `GET /api/auth/me`.
  Bootstrap: el **primer admin se siembra en el arranque** (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`,
  idempotente; ver `main._seed_admin`), sin endpoint operador. Gestión **in-app por admin**:
  `POST/GET/GET{id}/PATCH /api/users` (JWT admin) — crear agentes/admins, cambiar rol/áreas/estado, resetear
  contraseña; agente → 403. Rol/estado/áreas se resuelven de BD en cada request (revocación inmediata).
- **Dos audiencias de auth**: el **service-token** del bot = acceso total (integración confiable); el **JWT**
  de usuario = RBAC. `require_caller` acepta ambos (mismo header Bearer: prueba service-token, si no, JWT).
- **Alcance por área**: `GET/PATCH/GET{id} /tickets` → un **agente** solo ve/gestiona tickets de SUS áreas
  (fuera de alcance → 404, no filtra existencia); **admin/service** ven todo. Filtro `open_only` = "cola"
  (excluye `closed`/`rejected`). CRUD de catálogo/usuarios → **admin o service** (`require_privileged`); agente
  → 403. `POST /tickets` y `by-radicado` siguen siendo del bot (service-token).

**Inc 3 — notificaciones push:**
- Al **crear** un ticket → avisa al **grupo del área**; al **asignar** (`assignee` = email de un usuario) →
  avisa a **esa persona**. Disparado desde los endpoints (POST/PATCH tickets) con `BackgroundTasks`.
- **Canales**: **in-app** (SIEMPRE, núcleo): persiste en `notifications` (síncrono, confiable) + publica al
  **bus Redis** para **SSE** (`GET /api/notifications/stream`); **WhatsApp** (plantilla vía `/send` del
  Gateway, requiere `user.phone`) y **email** (SMTP) como **canales externos** best-effort en background.
  Añadir un canal = una clase que cumpla `NotificationChannel` (Strategy, Open/Closed).
- Feed: `GET /api/notifications` (+ `unread-count`, `{id}/read`, `read-all`), cada quien ve solo las suyas.
- Config: `NOTIFY_WHATSAPP_ENABLED`/`NOTIFY_EMAIL_ENABLED`; si un canal no está configurado, se omite limpio.
  `user.phone` (wa_id) opcional para WhatsApp.

**Inc 4 — empleados (base para autoservicio laboral):**
- Tabla propia `employees` (`document`/cédula única, `full_name`, `position`, `hire_date`, `contract_type`,
  `status`, `data` JSONB para campos extra tipo prórrogas) detrás del puerto **`EmployeeDirectory`** (para
  poder proxear el ERP a futuro sin tocar servicios). `GET /api/employees/{document}` = **bot/flujos**
  (`require_caller`); CRUD + lista con búsqueda `?q=` = **admin/service** (`require_privileged`).

**Inc 5 — certificado laboral (generación documental):**
- `POST /api/employees/{document}/certificate` (bot): valida empleado → **genera el PDF fresco** (datos
  actuales + fecha de emisión = hoy, hora Colombia; **se regenera en cada solicitud**, no se cachea) con
  **fpdf2** (plantilla del ejemplo de Servigpoder; logo opcional vía `CERT_LOGO_PATH`) → sube a **R2 propio**
  (puerto `ObjectStorage`, aioboto3) → **URL firmada corta** → **registra la emisión como ticket**
  `certificado_laboral` (mide volumen/tiempos del bot; el bot lo cierra tras enviar el PDF vía `PATCH`).
- Sin R2 configurado → 503 limpio. Salario en el certificado = **diferido** (el ejemplo no lo lleva).
  Textos fijos (firmante/ciudad/pie) por config. Sin cambios de esquema.

**Inc 6 — SLA por prioridad (calendario 24/7):**
- Tabla `sla_policies` (config-as-data): por prioridad → `response_minutes`/`resolution_minutes`. **Arranca
  VACÍA**: los tiempos de atención de los tickets los define **el cliente (Servigpoder)** vía
  `PUT /api/sla-policies/{priority}` (`GET /api/sla-policies` para listar). OJO: la tabla SLA de la propuesta
  (99.5% + Crítico/Alto/Medio/Leve) es el **SLA del SERVICIO de NextByte** hacia el cliente, **no** el SLA de
  los tickets del negocio → NO se siembra.
- Al crear, el ticket calcula `response_due_at`/`resolution_due_at` (prioridad efectiva = la del ticket o
  `DEFAULT_PRIORITY`=media). En las transiciones se marcan `first_response_at` (primera gestión/asignación) y
  `resolved_at` (`closed`/`rejected`). El **incumplimiento se deriva al leer** (`ticket.sla` en la respuesta).
  Editar una política afecta solo a tickets nuevos.

**Inc 7 — evento de vuelta al usuario final (B3):**
- Al cambiar un ticket a un estado que dispara (`NOTIFY_USER_STATUSES`, por defecto `closed`), se avisa al
  **solicitante** por WhatsApp llamando al `POST /send` del Gateway con **plantilla aprobada**
  (`UserEventNotifier`, reusa `HttpGatewayClient`). Disparado en el `PATCH /tickets/{id}` (compara estado
  anterior vs nuevo; no reenvía si no cambió), best-effort en background. Gateado por config
  (`user_event_configured`); si no está configurado, se omite limpio. Sin cambios de esquema.

### Pendiente (roadmap, ver `~/.claude/plans/scalable-brewing-cosmos.md`)
Reportes/BI (usa las marcas SLA para "cumplimiento de tiempos"; casos por área/responsable/categoría; conector
BI). Menores: SLA en horario hábil + pausa por `on_hold`; certificado con salario; refresh-token del
JWT; import masivo de empleados (CSV); ¿ERP para empleados? Falta el **logo PNG** y las **credenciales R2** del
certificado, y las **plantillas WhatsApp aprobadas** (staff + usuario) en producción.

## Arquitectura y decisiones (respétalas)

- **KISS manda** → SOLID → DRY balanceado → YAGNI. Patrones permitidos SOLO: **Ports & Adapters lite**
  (`typing.Protocol` en `app/domain/ports.py`), **Repository** (`app/adapters/*_repo.py`), **DI nativa
  de FastAPI** (`Depends`, en `app/dependencies.py`). Strategy+registro se reserva para reportes/
  notificaciones/generación documental (aún no hay 2º caso → YAGNI). **PROHIBIDO**: CQRS,
  event-sourcing, mediator, microservicios prematuros, ORMs mágicos, contenedor DI propio.
- **Sí usamos ORM** (SQLAlchemy 2.0 async) pero **explícito**: carga con `selectinload` (relaciones con
  `lazy="raise"` para que un lazy-load accidental FALLE en vez de disparar N+1). El dominio NO importa
  SQLAlchemy; los repos mapean filas ORM ↔ dataclasses de dominio.
- **Single-tenant** (Servigpoder = una empresa). No hay filtro `org_id`; costura de identidad limpia
  (`Principal`) para evolucionar si algún día se necesita multi-tenant.
- **Config-as-data**: áreas/categorías/procesos se modelan con datos (catálogo), no con código nuevo
  (Open/Closed). El dominio NO codifica procesos específicos de RRHH.
- **Errores de dominio** (`app/domain/errors.py`, puros) traducidos a HTTP por un exception handler en
  `main.py` → `{"detail": ...}` (calca el schema `Error` del contrato). 401/404/409/422 distinguidos.
- **Migraciones Alembic** canónicas en Postgres (`alembic upgrade head`); en SQLite (tests) `create_all`.
  Tipo `GUID` portable (uuid nativo en PG, CHAR(32) en SQLite) en `app/adapters/types.py`.
- **Comentarios en español** (el porqué de lo no obvio). **Identificadores en inglés en TODO el repo,
  incluidos los nombres de tests** (a diferencia de `meta-waba`, que usa nombres de test en español).
  **`code`/valores de enum también en inglés** (TicketStatus `open|in_review|assigned|in_progress|on_hold|
  closed|rejected`, Priority `low|medium|high|critical`, HistoryActor `user|ai|human|system`); el **español
  va SOLO en labels** que ve el cliente (los pone el frontend, o el `name` de un catálogo). Excepción: los
  `code` de áreas/categorías son **data del cliente** (slugify de nombres en español). `logging` estructurado
  JSON; NUNCA loguear tokens/secretos/PII.

## Estructura

```
app/
  config.py logging_config.py dependencies.py main.py
  domain/   models.py (enums+dataclasses)  ports.py (Protocols)  errors.py
  adapters/ types.py (GUID)  db_models.py (ORM)  ticket_repo.py  catalog_repo.py
  services/ ticket_service.py  catalog_service.py  slugify.py  radicado.py  auth.py
  api/      schemas.py (Pydantic + mappers)  tickets.py  catalog.py  health.py
alembic/ (0001_baseline)  tests/ (pytest+aiosqlite)  docs/
```

## Cómo trabajar (entorno)

El repo vive en **WSL** (`/home/ndrs/www/app_tickets`); la Bash del host es MINGW (sin python3). Usa el
venv de WSL:

```bash
wsl -d ubuntu bash -lc "cd /home/ndrs/www/app_tickets && .venv/bin/python -m pytest -q"
```

## Al hacer cambios

- Mantén verde `pytest` y añade tests para lo nuevo (mismo estilo: TestClient + SQLite; nombres en
  inglés). Tras cambios de esquema: **añade una migración Alembic** y verifica `alembic upgrade head`
  en un Postgres real (los tests SQLite usan `create_all`).
- Endpoints nuevos: protégelos con `Depends(require_service_token)` (hasta que llegue el RBAC humano).
- No metas el dominio de mensajería (chats/mensajes) aquí: eso vive en el Gateway.
