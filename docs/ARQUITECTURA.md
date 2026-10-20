# Arquitectura — NextByte Seguimientos

## Visión

SaaS **multiempresa** de NextByte para empresas de vigilancia y seguridad privada. Gestiona
PQRS (peticiones, quejas, reclamos, sugerencias, felicitaciones y denuncias) de **clientes externos**
(clientes corporativos y sus sedes/puestos de servicio) y **clientes internos** (empleados), además de
**visitas de supervisión a puesto** con formularios dinámicos, **tareas** de seguimiento e **indicadores**.

## Piezas

```
┌──────────────┐      ┌──────────────────────────── backend (FastAPI) ────────────────────────────┐
│  frontend    │ /api │ core/  config · db · seguridad · eventos · storage(S3) · mailer · errores  │
│  React SPA   ├─────►│ modules/                                                                  │
│  (nginx)     │      │   tenancy  identity  org  catalog  clients  employees  sla                │
└──────────────┘      │   pqrs  documents  notifications  channels  visits  tasks  reports        │
                      └───────┬──────────────┬───────────────┬──────────────┬──────────────────────┘
                              │              │               │              │
                         PostgreSQL       Redis          MinIO/S3        SMTP / IMAP
                                     (bus SSE + colas)   (adjuntos/PDF)
                      ┌──────────────┐
                      │ worker (arq) │  correo saliente · lectura IMAP · alertas SLA
                      └──────────────┘
```

- **Frontend y backend independientes** (despliegues, imágenes y repositorio de código separados por carpeta).
- **Backend = monolito modular**: un solo proceso y una sola base de datos, pero cada módulo es
  independiente. **No** son microservicios.
- **La misma infraestructura en local y en la nube**: el mismo `docker-compose.yml`; solo cambian las variables de
  entorno (`.env`). En la nube, MinIO puede sustituirse por R2 o S3 cambiando el endpoint.

## Reglas de los módulos (backend)

Cada módulo vive en `backend/app/modules/<nombre>/` y tiene, como máximo:

| Archivo | Rol |
|---|---|
| `models.py` | Tablas (SQLAlchemy). Solo las de este módulo. |
| `schemas.py` | Contratos de entrada/salida (Pydantic). |
| `service.py` | Lógica de negocio. |
| `router.py` | Endpoints HTTP. |
| `public.py` | **Fachada pública**: lo único que otros módulos pueden importar. |
| `permissions.py` | Permisos que el módulo declara (se registran solos). |
| `handlers.py` | Suscripciones a eventos de otros módulos. |

1. Un módulo **solo** importa de `app.core` y de los `public.py` de otros módulos. Lo verifica un test
   (`tests/test_architecture.py`).
2. Los efectos secundarios entre módulos se hacen con **eventos de dominio** (`app.core.events`): p. ej.
   `pqrs` publica `pqrs.assigned` y `notifications` lo escucha. Así, cuando un módulo emite algo, no
   necesita saber quién lo escucha.
3. Cada módulo se registra en `app/modules/__init__.py` (`MODULES`). Agregar un módulo nuevo (p. ej.
   **minutas**) = crear la carpeta y añadirlo a la lista.
4. **Multiempresa**: toda tabla de negocio lleva `tenant_id`. El servicio siempre filtra por la empresa
   del usuario autenticado (`Ctx.tenant_id`). El superadministrador no pertenece a ninguna empresa.
5. Los códigos y valores de enumeraciones van en inglés; los textos que ve el usuario, en español.

## Roles y permisos dinámicos

- Cada módulo declara sus **permisos** (código + etiqueta). El catálogo completo está en `GET /api/permissions`.
- Cada empresa crea sus **roles** combinando permisos. Al crear una empresa se siembran los roles
  del sistema: Administrador, Radicador, Gestor de área, Aprobador, Jefe de operación y Auditor.
- Un usuario puede tener varios roles y pertenecer a varias áreas.
- El alcance de la consulta de PQRS lo dan los permisos: `pqrs.view_all` (todas), `pqrs.view_area` (las de sus
  áreas) y, siempre, las que tiene asignadas.

## PQRS

- **Segmento**: `external` (cliente corporativo + sede) o `internal` (empleado).
- **Clasificación**: tipo (P/Q/R/S/F/D) → categoría → subcategoría. Las categorías dependen del segmento y,
  opcionalmente, del tipo. La categoría o subcategoría sugiere el área responsable y la prioridad.
- **Canales**: `web` (portal público), `manual` (ventanilla), `email` (IMAP) y `whatsapp` (integración por API key).
- **Radicado**: `{PREFIJO}-{AAAA}-{NNNNNN}` con una secuencia anual atómica por empresa, más un **código de consulta**
  para el portal.
- **Estados**: `received` (radicada) → `assigned` → `in_progress` ⇄ `on_hold` (en espera) →
  `pending_approval` (respuesta en aprobación) → `responded`; también `cancelled` (anulada).
- **Respuesta formal**: el gestor proyecta la respuesta → el aprobador (permiso `pqrs.approve`) la aprueba o la devuelve →
  se genera la carta en PDF con membrete y firma en imagen → se envía por correo y queda disponible en el portal.

## Análisis de causa raíz (quejas de clientes externos)

- Cada **tipo de solicitud** define en qué segmentos exige análisis de causa raíz (`rca_segments`). Por defecto
  se siembra **Queja → cliente externo**. Si se reclasifica un caso a ese tipo, el análisis se activa.
- El caso llega primero al **área de Calidad**: la configurada en la empresa (`settings.quality.area_id`) o, si no
  hay, la de código `calidad`. Se notifica a quien tiene `pqrs.rca_manage`.
- Etapas (`pqrs/rca.py`):
  1. `setup`: Calidad redacta el problema, elige el método (5 porqués, Ishikawa o libre) y marca las áreas que intervienen.
  2. `analysis`: cada área aporta. Puede hacerlo quien tiene `pqrs.rca_contribute` y es miembro del área; los
     miembros de las áreas participantes ven el caso.
  3. `validation`: Calidad consolida la causa raíz (categoría 6M) y decide si requiere plan de acción.
  4. `plan`: cada acción es una **tarea** (`source_type="action_plan"`, `source_id`=PQRS), con seguimiento y evidencias.
  5. `closed`: el análisis queda documentado y se descarga como informe PDF (`/pqrs/{id}/rca/report.pdf`).
- **Bloqueo:** la respuesta formal no se envía ni se aprueba hasta que el análisis esté `closed` (sí se puede guardar
  el borrador). Calidad puede reabrir el análisis mientras el caso no esté cerrado.

## SLA (no bloqueante)

- Política por **prioridad** (urgente, alta, media, baja) configurable por empresa: valor y unidad
  (días o horas hábiles, o días u horas calendario), pausa en "en espera" y porcentaje de alerta.
- Por defecto se siembra **15 días hábiles** para todas las prioridades.
- **Calendario hábil** por empresa: días laborales, horario, festivos de Colombia (librería `holidays`) y
  festivos propios.
- Nunca bloquea el caso; solo calcula el vencimiento y la semaforización (`on_time`, `at_risk`, `overdue`, `met`,
  `missed`) para los indicadores.

## Visitas a puesto

- **Formularios dinámicos** (constructor): secciones, texto, número, selección, sí/no, calificación,
  fecha, foto y firma. Cada campo puede definir una **regla de hallazgo** (p. ej. "si responde No" o
  "calificación ≤ 2") que sugiere crear una tarea.
- **Meta de visitas** mensual por cliente o por sede (la de la sede tiene prioridad sobre la del cliente).
- **Visita**: el jefe de operación la diligencia desde el celular (con geolocalización opcional). El formulario se
  guarda como una copia del momento (versionado implícito).
- **Indicador**: visitas realizadas frente a la meta, por mes y por cliente o sede.

## Tareas

Módulo genérico: una tarea puede venir de una visita, de una PQRS o crearse manualmente. Tiene responsable,
fecha límite, prioridad, estado y bitácora de seguimiento.

## Integraciones

- `POST /api/integrations/...` con la **API key de la empresa** (en la base de datos se guarda solo su hash). Sirve para el bot de
  WhatsApp (repo `meta-waba`, por conectar) y para el módulo de **minutas** existente.
