# CLAUDE.md — Plataforma PQRS (empresas de seguridad)

Guía para retomar el trabajo. La arquitectura y las reglas están en `docs/ARQUITECTURA.md`: léela antes de tocar código.

## Decisiones del cliente (respétalas)

- Frontend y backend independientes. El backend es un **monolito modular**, no microservicios.
- **Multiempresa (SaaS)**: toda tabla de negocio lleva `tenant_id` y los servicios filtran por `ctx.tid`.
- Cliente **externo** (corporativo + sedes/puestos) y cliente **interno** (empleados), con categorías y
  subcategorías por tipo de solicitud y por segmento.
- El **SLA** se configura por prioridad (urgente/alta/media/baja), con 15 días hábiles por defecto.
  **Nunca bloquea** el caso: solo mide la oportunidad para los indicadores.
- **Roles dinámicos** por permisos. El admin aprueba respuestas, pero el permiso `pqrs.approve` es asignable a otros roles.
- Respuesta formal = carta PDF con membrete y firma en imagen, con aprobación antes del envío.
- Canales: portal web, ventanilla, correo IMAP y WhatsApp (el repo `meta-waba` aún no está conectado; entra por API key).
- Visitas a puesto: formularios dinámicos, metas mensuales por cliente o sede, hallazgos que generan tareas.
- Integración futura con el módulo de **minutas** (vía `/api/integrations/*` o como módulo nuevo).
- La infraestructura local es la misma que la de la nube (un solo compose; solo cambia el `.env`).
- Marca: colores y logo de Servigpoder, configurables por empresa.

## Convenciones

- Backend: códigos y valores de enumeraciones en inglés; textos en español; comentarios en español.
  Un módulo solo importa `app.core` y los `public.py` de otros módulos (lo verifica `tests/test_architecture.py`).
- Frontend: `app → features → shared`, sin imports entre features (lo verifica `eslint-plugin-boundaries`).
  Lo que se comparte va en `shared/` (API, sesión, componentes como `TaskFormDialog`).
- Sin Python ni Node globales obligatorios: las pruebas del backend corren en Docker (`backend/run-tests.sh`).
  El frontend usa `corepack pnpm`.

## Comandos

```bash
docker compose up -d --build                    # todo el stack
./backend/run-tests.sh                          # pytest (imagen pqrs-api:test)
cd frontend && corepack pnpm lint && corepack pnpm exec tsc -b && corepack pnpm test
```

## Pendiente

- Conectar el bot de WhatsApp (`meta-waba`) a `/api/integrations/pqrs`.
- Logo y colores oficiales de Servigpoder (hoy, azul #0B3D91 y dorado #F2A900 provisionales).
- Certificado laboral PDF del sistema anterior (no se migró).
- Módulo de minutas.
