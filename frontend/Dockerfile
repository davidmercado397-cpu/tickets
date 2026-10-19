# syntax=docker/dockerfile:1

# --- Etapa build: compila la SPA con pnpm (Node 22 + corepack) ---
FROM node:22-alpine AS build
WORKDIR /app

# corepack provee el pnpm fijado en package.json ("packageManager").
RUN corepack enable

# Instala dependencias con la lockfile (capa cacheable).
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# Compila (tsc -b + vite build). Usa los tipos ya generados en src/shared/api/generated.
COPY . .
RUN pnpm run build

# --- Etapa runtime: nginx sirve los estáticos y proxya /api al backend ---
FROM nginx:1.27-alpine AS runtime

# Origen del backend Ticketing (SIN slash final). Sobrescribible en despliegue.
ENV API_BACKEND=http://host.docker.internal:8001

# La plantilla se resuelve con envsubst (solo ${API_BACKEND}) al arrancar el contenedor.
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
