# CONTEXT — Frontend Helpdesk (`tickets_front`) · handoff

Documento de traspaso para retomar el proyecto en otra sesión sin re-explorar. Última actualización
tras: Incremento 1 + migración a pnpm + Docker + fix de sesión persistente.

---

## 1. Qué es y ecosistema

Plataforma de **mesa de ayuda con bot de WhatsApp con IA** (primer cliente: **Servigpoder**, agencia
NextByte). La propuesta comercial define: gestión de tickets/requerimientos, autoservicio laboral
(certificados, radicación de incapacidades), canal de tareas internas, base de conocimientos IA,
reportes/indicadores, RBAC.

**Tres repos** (en WSL, `\\wsl.localhost\ubuntu\home\ndrs\www\`):

| Repo | Qué es | Estado |
|---|---|---|
| `meta-waba` | **WhatsApp Gateway** (FastAPI) + módulo IA opcional. Único que habla con Meta. | En producción (canal). Módulo IA apagado por defecto. |
| `app_tickets` | **Backend Ticketing** (FastAPI): dominio del helpdesk (tickets, catálogos, usuarios, empleados, SLA, notificaciones). | Real, 7 incrementos, ~85 tests verdes. Prefijo `/api`. |
| `tickets_front` | **Este repo**: SPA React del helpdesk. Habla SOLO con `app_tickets`. | Incremento 1 hecho. GitHub: https://github.com/AndresDMO/tickets_frontend (rama `main`). |

**Regla dura:** el navegador NUNCA habla con el Gateway directo. El Inbox de WhatsApp y el admin de
Bot/IA los debería **relayar** `app_tickets` reenviando el Gateway `/api/v1` — **ese relay AÚN NO existe**.

---

## 2. Stack y arquitectura del frontend

React 18 + **TypeScript strict** + **Vite 5** · React Router 6 · **TanStack Query** (estado servidor) ·
**Zustand** (estado UI/cliente) · react-hook-form + zod · **Tailwind + shadcn/ui** (Radix) · i18n **es-CO**
(i18next) · tipos generados del OpenAPI (**openapi-typescript**) · **MSW** (mock dev + tests) · **Vitest** +
Testing Library · ESLint (con `eslint-plugin-boundaries`) + Prettier. Gestor: **pnpm 9** (corepack). Node 22.

**Feature-Sliced lite + Ports & Adapters.** Regla de dependencias forzada por boundaries:
`app → features → shared`; **features NUNCA se importan entre sí** (comparten vía `shared/`).

```
src/
  app/         providers/ (Query, Router, Auth, Theme, I18n + AppProviders), layout/ (RootLayout, AuthLayout, NotFound),
               routes.tsx, router.tsx, main.tsx
  features/
    auth/      model/(session.store, login.schema) · hooks/(useLogin, useMe, useSession) · guards/(RequireAuth, RequireRole) · ui/(LoginForm, LoginPage)
    tickets/   hooks/(useTicketsQuery, useTicketQuery, useUpdateTicket, useTicketFilters) · model/(status.registry) · ui/(TicketsListPage, TicketsFilters, ticketColumns, TicketDetailPage, HistoryTimeline, SlaPanel, AttachmentsList, TicketActions, StatusBadge)
    admin/     areas/ · categories/ · users/ (Page + FormDialog c/u) · hooks/(useAreaMutations, useCategoryMutations, useUsers) · model/(schemas) · users/AreaCodesMultiSelect
  shared/
    api/       port.ts (interfaz TicketingApi) · rest.adapter.ts · http.ts · mappers.ts · types.ts · queryKeys.ts · auth-bridge.ts · errors.ts · apiClient.ts · generated/schema.d.ts (openapi-typescript)
    ui/        shadcn (button, input, select, dialog, tabs, badge, checkbox, dropdown-menu, form, table, textarea, label, skeleton, sonner) + DataTable.tsx + states/(Loading/Empty/Error)
    lib/       cn, slugify, date (es-CO), formErrors · hooks/ useCatalog(useAreas/useCategories/useCatalogMaps), useDebouncedValue · config/ env, permissions, theme.store · i18n/ config + locales/es-CO.ts
  mocks/       db.ts (seed) · handlers/(auth, tickets, catalog, users) · browser.ts · server.ts
  test/        renderWithProviders.tsx
```

**Seam de la API (`shared/api/`):**
- `port.ts`: interfaz `TicketingApi` — la UI consume **view models**, nunca DTOs ni `fetch`.
- `http.ts`: wrapper de fetch, inyecta `Authorization: Bearer` (el backend NO declara securityScheme),
  maneja **401** (→ `notifyUnauthorized()` limpia sesión) y **422** (→ `ApiError.fromValidation` con
  errores por campo para rhf).
- `auth-bridge.ts`: puente token/401 entre `shared` y la feature auth (sin romper boundaries).
- `mappers.ts`: DTO→VM. **Ojo:** el id de ticket es `ticket_id`; `TicketSummaryOut` trae códigos de
  área/categoría pero **no nombres** (se resuelven con `useCatalogMaps`).
- `queryKeys.ts`: factories (`ticketKeys`, `areaKeys`, `categoryKeys`, `userKeys`, `authKeys`).

---

## 3. Backend `app_tickets` — contratos (fuente de verdad: `../app_tickets/docs/openapi.json`)

Corre en **`:8001` (host)** / **`:8000` (interno del contenedor)**. Todo bajo `/api`. Genera tipos con
`pnpm gen:api`. Auth: JWT HS256 **8h, sin refresh** (usuarios) + service-token (bot).

**Endpoints reales HOY:**
- **Auth:** `POST /api/auth/login {email,password}` → `{access_token, token_type, expires_in}`;
  `GET /api/auth/me` → `{user_id, email, display_name?, role}`. *(MeOut NO trae `area_codes`.)*
- **Tickets:** `GET /api/tickets` (query `status,category,assignee,open_only,from,to,page,page_size` →
  `TicketPageOut{items:TicketSummaryOut[],total,page,page_size}`); `GET /api/tickets/{id}` → `TicketOut`
  (rico: history[], attachments[], sla{...breached}, contact, fields, category_name?, area_name?);
  `PATCH /api/tickets/{id} {status?,assignee?,priority?,note?}` → `TicketOut`;
  `GET /api/tickets/by-radicado/{radicado}`; `POST /api/tickets` = **solo bot/service-token** (no va en el front).
  Estados: `open,in_review,assigned,in_progress,on_hold,closed,rejected`. Prioridad: `low,medium,high,critical`.
  **Alcance por área:** el servidor filtra tickets del agente por sus áreas (el front NO lo hace; solo gatea por rol).
- **Catálogo:** `GET/POST /api/areas`, `GET/PATCH/DELETE /api/areas/{id}`; ídem `categories` (+ `area`=code).
  `code` = auto-slug del nombre, **editable al crear, inmutable después**. DELETE = soft (active:false).
- **Usuarios (admin):** `GET/POST /api/users`, `GET/PATCH /api/users/{id}`. `role admin|agent`, `area_codes[]`
  (en update **reemplaza** toda la membresía).
- **Empleados:** `GET/POST /api/employees`, `GET/PATCH /api/employees/{document}` *(real, SIN UI todavía)*.
- **Certificados:** `POST /api/employees/{document}/certificate` (bot) *(real, SIN UI)*.
- **SLA:** `GET /api/sla-policies`, `PUT /api/sla-policies/{priority}` *(real; el front solo MUESTRA el SLA
  read-only en el ticket; falta editor)*.
- **Notificaciones (tiempo real):** `GET /api/notifications`, `/unread-count`, `POST /read-all`,
  `/{id}/read`, **SSE `GET /api/notifications/stream`** (event: `notification`) *(real, SIN UI)*.
- **Bootstrap primer admin:** `POST /admin/users` con header `X-Internal-Key` (no hay usuarios al inicio).

---

## 4. Estado del producto

### ✅ Hecho — todo verde (tsc 0, 20 tests, lint 0, build OK, Docker OK)
**Incremento 1:** Auth (login rhf+zod, guards por rol, sesión persistida en localStorage
`helpdesk.session` + revalidación `/me`, 401 limpia), Tickets (lista filtros-URL+paginación+catálogo,
detalle tabs, PATCH optimista), Admin (áreas/categorías code-inmutable, usuarios/roles).

**Incremento 2 (UI/UX profesional + features):**
- **Design system:** paleta índigo+slate, semánticos success/warning/destructive/info, sombras,
  **tipografía Inter** self-hosted. Primitivos shadcn nuevos (avatar, tooltip, popover, command, sheet,
  scroll-area, card, breadcrumb, progress, alert) + `PageHeader`.
- **App shell:** sidebar oscuro **colapsable** (persistido) con nav agrupada + `UserMenu` (avatar+dropdown),
  topbar con **breadcrumbs** + **CommandPalette (⌘K)** + campana, **Sheet** móvil, barra de progreso global,
  login split-screen con panel de marca.
- **Tickets:** PageHeader, page-size selector + total, avatar de responsable, copiar radicado, detalle
  2-columnas con panel sticky y **SLA con barras de progreso**.
- **Notificaciones (tiempo real):** `NotificationsBell` (badge no-leídas + popover + marcar leídas) +
  `NotificationsProvider` SSE (`@microsoft/fetch-event-source` con Bearer; solo en modo real).
- **Empleados** (admin): CRUD con búsqueda `q` + paginación (`/admin/employees`).
- **Editor de SLA** (admin): 4 prioridades editables (`/admin/sla`).

### 🟡 Menores pendientes (no bloquean)
- Selector de agente al asignar (hoy texto libre; no se hizo por la regla de boundaries features↛features).
- Consulta por radicado: **no viable desde el front** (el endpoint `by-radicado` es **service-token/bot**,
  no acepta JWT de usuario) → el ⌘K quedó solo como navegación.
- Code-splitting del bundle (hoy ~780 kB), color/logo real de marca.

### ⛔ Diferido (el backend AÚN no existe)
- **Inbox de WhatsApp** (conversaciones/mensajes/toggle bot/SSE) — falta relay en `app_tickets`.
- **Admin de Bot/IA** (agentes, KBs, auto-respuestas, flujos) — vive en el Gateway `meta-waba` `/api/v1`,
  sin relay en el Ticketing.
- **Reportes/Indicadores + BI**.

---

## 5. Decisiones y gotchas (respétalas)

- **Sesión en localStorage** (`helpdesk.session`, token+usuario). El JWT dura 8h sin refresh → se persiste
  para sobrevivir recargas; 401 la limpia. (Alternativa `sessionStorage` si se quiere borrar al cerrar pestaña.)
- **`code` inmutable** tras crear (áreas/categorías): en edición el campo va read-only aunque el DTO de
  PATCH lo acepte. Slug con `slugify()` (quita tildes/ñ).
- **`MeOut` sin `area_codes`** → el front confía en el scoping del servidor; solo gatea por rol (admin|agent).
- **`TicketSummaryOut` sin nombres** → `useCatalogMaps()` (shared) arma `Map<code,name>` de áreas/categorías.
- **Ticket id = `ticket_id`** en los DTOs.
- **Boundaries:** necesidades cross-feature pasan por `shared/` (p.ej. tickets usa `shared/hooks/useCatalog`),
  nunca importando otra feature. Tests pueden importar cualquier capa (regla desactivada en `*.test.tsx`).
- **Comentarios en español**; nombres de test en español (convención de todos los repos). Código en inglés.
- Mock seed (`src/mocks/db.ts`): `admin@demo.co / admin1234` (admin), `agente@demo.co / agente1234` (agente).

---

## 6. Entorno y toolchain (IMPORTANTE — friccioso)

El repo vive en **WSL** (ubuntu). **No había Node nativo**; se instaló **Node 22 en `~/.local/node`**
(tarball oficial de nodejs.org) y **pnpm 9** por **corepack** (`packageManager: pnpm@9.15.0` en package.json).
Persistido en `~/.bashrc`.

**Para correr comandos Node/pnpm de forma fiable:** escribir un script `.sh` en el FS de WSL (vía la tool
Write a una ruta `\\wsl.localhost\ubuntu\...`) que haga `export PATH="$HOME/.local/node/bin:$PATH"` y
ejecutarlo con **`wsl.exe -d ubuntu bash /ruta/script.sh` desde la tool de PowerShell**. Motivo: dos capas
mutilan comandos inline — el **Bash tool (MINGW)** reescribe rutas Unix (`/home/...`→`C:/Program Files/Git/...`)
y **PowerShell 5.1** rompe comillas dobles embebidas al pasarlas a `wsl.exe`. Un script por ruta evita todo eso.
(Ejemplo de script: `#!/usr/bin/env bash` + `export PATH=...` + `cd /home/ndrs/www/tickets_front` + comando.)

**Comandos (pnpm):**
```
pnpm install
pnpm gen:api      # regenera src/shared/api/generated/schema.d.ts desde ../app_tickets/docs/openapi.json
pnpm dev          # dev contra backend real (proxy /api → :8001)
pnpm dev:mock     # dev contra MSW (sin backend)
pnpm test         # Vitest (siempre MSW)
pnpm lint         # ESLint (0 warnings) ; pnpm build (tsc -b + vite build)
```

---

## 7. Docker y despliegue

**Dockerfile multi-stage:** build con pnpm → **nginx** sirve `dist/` con **SPA fallback** y **proxya `/api`**
al backend. Archivos: `Dockerfile`, `docker/nginx.conf.template`, `docker-compose.yml`, `.dockerignore`.

- **Puerto del contenedor: 80** (nginx). En Coolify el puerto interno = 80. (El 5173 es solo `pnpm dev` local.)
- **Única env de runtime: `API_BACKEND`** = origen del backend Ticketing, **sin slash final**. Acepta:
  - nombre interno de Docker en la misma red, `http://ticketing:8000` (recomendado; el puerto interno es 8000);
  - **URL pública HTTPS**, `https://api.tudominio.com` (nginx manda el **Host** y **SNI** correctos del backend).
- nginx resuelve el backend **en tiempo de request** (`resolver 127.0.0.11`) → **arranca aunque el backend
  esté caído** (no crashea; `/api` da 502 hasta que esté). Nota: `127.0.0.11` solo existe en redes
  **definidas por usuario** (Coolify/compose), no en la bridge por defecto.
- Vars build-time (Vite, opcionales, horneadas): `VITE_API_BASE_URL` (default `/api`), `VITE_API_MODE`
  (`rest`|`mock`). No hace falta tocarlas en prod. (No están expuestas como build-args del Dockerfile aún.)

**Coolify:** build con el Dockerfile, puerto 80, setear `API_BACKEND`. Redesplegar tras cada push.

---

## 8. Git / repo

- GitHub: **https://github.com/AndresDMO/tickets_frontend**, rama **`main`**.
- Historial: `feat: frontend Incremento 1` → `fix(docker): resolución runtime` →
  `feat(docker): URL pública HTTPS (SNI+Host)` → `fix(auth): sesión persistente en localStorage`.
- Working tree limpio tras cada push. Convención de commits: mensaje + `Co-Authored-By: Claude ...`.

---

## 9. Próximos pasos sugeridos (orden recomendado)

1. **Notificaciones** (campana + SSE) — estrena tiempo real; provider SSE que hace merge en la caché de
   Query; badge de no-leídas (`/unread-count` devuelve objeto, confirmar shape en runtime).
2. **Empleados** (CRUD) — mismo patrón que admin (tabla + DataTable + form dialog).
3. **Editor de SLA** por prioridad.
4. Luego, cuando exista relay en `app_tickets`: **Inbox** y **Admin Bot/IA**. Y **Reportes/BI**.
5. Pulidos: selector de agente para asignar, exponer `VITE_*` como build-args si se necesita construir la
   imagen apuntando a otra base, color/logo de marca en los tokens shadcn (`src/index.css`).

**Archivos críticos para arrancar:** `src/shared/api/port.ts` (contrato), `src/shared/api/http.ts`
(auth/errores), `src/shared/ui/DataTable.tsx` (reuso), `src/features/tickets/hooks/useUpdateTicket.ts`
(patrón optimista), `src/features/auth/model/session.store.ts` (sesión), `../app_tickets/docs/openapi.json`
(tipos). Ver también `README.md`.
