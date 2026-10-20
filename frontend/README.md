# Mesa de Ayuda — Frontend (`tickets_front`)

SPA React de **NextByte Seguimientos** (PQRS, visitas a puesto, tareas e indicadores para empresas de seguridad).
Habla **solo** con el backend del Ticketing (`app_tickets`, FastAPI en `:8001`). El navegador nunca
toca el WhatsApp Gateway directo.

## Stack

React 18 + TypeScript (strict) · Vite 5 · React Router 6 · TanStack Query (estado de servidor) ·
Zustand (estado de UI) · react-hook-form + zod · Tailwind + shadcn/ui (Radix) · i18n es-CO ·
tipos generados del OpenAPI (`openapi-typescript`) · MSW (tests + dev mock) · Vitest + Testing Library.

## Arquitectura (Feature-Sliced lite + Ports & Adapters)

```
src/
  app/        providers (Query/Router/Auth/Theme/I18n), layout, rutas
  features/   auth/ · tickets/ · admin/(areas,categories,users)   — no se importan entre sí
  shared/     api/ (puerto + adapter REST + tipos generados) · ui/ (design system) · lib · hooks · config · i18n
  mocks/      MSW: db en memoria + handlers
```

- **Puerto de API** (`shared/api/port.ts`): interfaz `TicketingApi`; la UI consume view models, nunca DTOs
  ni `fetch`. Adapter REST en `shared/api/rest.adapter.ts` (usa los tipos generados). El token Bearer se
  inyecta en `shared/api/http.ts`; 401 → limpia sesión (los guards redirigen).
- **Regla de dependencias** forzada por `eslint-plugin-boundaries`: `app → features → shared`;
  `features ↛ features` (comparten vía `shared/`).
- **Sesión**: token **en memoria** (sin persistencia; refrescar cierra sesión). RBAC por rol (admin|agent).

## Requisitos

Node ≥ 20.19 (se usa Node 22) y **pnpm 9** (vía corepack: `corepack enable`). El repo vive en WSL;
usa Node **nativo de WSL** (no el de Windows).

## Comandos

```bash
pnpm install
pnpm gen:api      # regenera tipos desde ../app_tickets/docs/openapi.json
pnpm dev          # dev contra el backend real (proxy /api → :8001)
pnpm dev:mock     # dev contra MSW (sin backend)
pnpm test         # Vitest (siempre MSW)
pnpm lint         # ESLint (0 warnings)
pnpm build        # tsc -b + vite build
```

## Docker

Imagen multi-stage: build con pnpm → **nginx** que sirve los estáticos (con SPA fallback) y **proxya
`/api`** al backend Ticketing. El destino se configura con `API_BACKEND` (origen, sin slash final).

```bash
docker build -t tickets-front .
docker run -p 8080:80 \
  --add-host host.docker.internal:host-gateway \
  -e API_BACKEND=http://host.docker.internal:8001 tickets-front
# o: API_BACKEND=http://ticketing:8000 docker compose up --build
```

`API_BACKEND` acepta:
- **Nombre interno** de Docker en la misma red, p.ej. `http://ticketing:8000` (recomendado: sin salto a
  internet, sin TLS). El puerto es el **interno** del contenedor Ticketing (8000, no el 8001 del host).
- **URL pública HTTPS**, p.ej. `https://api.tudominio.com` — nginx envía el **SNI** y el header `Host`
  del backend correctamente (necesario si está detrás de Cloudflare/Traefik).

nginx resuelve el backend **en tiempo de request** (resolver `127.0.0.11`), así que **arranca aunque el
backend esté caído** (no crashea; `/api` da 502 hasta que esté disponible). Nota: el DNS `127.0.0.11`
solo existe en redes **definidas por usuario** (las de Coolify/compose), no en la bridge por defecto.

## Levantar contra el backend real

1. En `../app_tickets`: `docker compose up -d` (API en `http://localhost:8001`).
2. Crear el primer admin (no hay usuarios):
   `curl -X POST localhost:8001/admin/users -H "X-Internal-Key: <KEY>" -H "Content-Type: application/json" -d '{"email":"admin@x.co","password":"...","role":"admin"}'`
3. `npm run dev` → login con ese admin.

## Modo mock (dev/tests)

Credenciales sembradas (`src/mocks/db.ts`): `admin@demo.co / admin1234` (admin),
`agente@demo.co / agente1234` (agente). Incluye áreas, categorías y 2 tickets de ejemplo.

## Alcance (Incremento 1)

✅ Fundación + Auth + Tickets (lista con filtros/paginación, detalle con historial/SLA/adjuntos,
mutaciones optimistas) + Admin (áreas/categorías con `code` auto-slug inmutable, usuarios/roles).
⏳ Diferido (sin relay en el Ticketing todavía): Inbox de WhatsApp, admin de Bot/IA, Reportes.
