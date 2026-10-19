"""API FastAPI del monolito modular PQRS."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core import db, jobs
from app.core.config import get_settings
from app.core.db import Base
from app.core.errors import DomainError
from app.core.logging import configure_logging
from app.core.storage import init_storage
from app.modules import load_modules

logger = logging.getLogger(__name__)
MODULES = load_modules()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.LOG_LEVEL, settings.LOG_FORMAT, settings.LOG_TZ_OFFSET_HOURS)
    if not settings.DATABASE_URL:
        raise RuntimeError("DATABASE_URL es obligatoria.")
    if len(settings.AUTH_JWT_SIGNING_KEY) < 32:
        raise RuntimeError("AUTH_JWT_SIGNING_KEY es obligatoria (>= 32 caracteres).")

    engine = db.init_db(settings.DATABASE_URL)
    if engine.dialect.name == "sqlite":  # tests: esquema al vuelo; en Postgres lo aplica Alembic
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    jobs.init_redis(settings.REDIS_URL)
    storage = init_storage(settings)
    try:
        await storage.ensure_bucket()
    except Exception:  # noqa: BLE001 - el almacenamiento puede tardar en arrancar; no tumba la API
        logger.exception("No se pudo verificar el bucket de almacenamiento")

    from app.bootstrap import seed

    await seed(settings)
    logger.info("API arrancada", extra={"modules": [m.name for m in MODULES]})
    try:
        yield
    finally:
        await jobs.close_redis()
        await db.close_db()


settings = get_settings()
app = FastAPI(
    title=f"{settings.APP_NAME} API",
    version="1.0.0",
    description="PQRS multiempresa para empresas de seguridad privada: PQRS, clientes y sedes, empleados, SLA "
    "hábil, visitas a puesto con formularios dinámicos, tareas e indicadores.",
    lifespan=lifespan,
)


@app.exception_handler(DomainError)
async def _domain_error(_: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})


@app.exception_handler(RequestValidationError)
async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    """422 con mensaje legible en español además del detalle por campo."""
    errors = exc.errors()
    first = errors[0] if errors else {}
    loc = ".".join(str(x) for x in first.get("loc", [])[1:])
    msg = str(first.get("msg", "Datos inválidos")).removeprefix("Value error, ")
    return JSONResponse(status_code=422, content={"detail": f"{loc}: {msg}" if loc else msg,
                                                  "errors": jsonable(errors)})


def jsonable(errors: list) -> list:
    return [{"loc": list(e.get("loc", [])), "msg": str(e.get("msg", "")), "type": e.get("type")} for e in errors]


if settings.cors_origins_list:
    from fastapi.middleware.cors import CORSMiddleware

    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins_list, allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])


@app.get("/health", tags=["salud"])
async def health() -> dict:
    return {"status": "ok"}


for module in MODULES:
    for r in module.routers:
        app.include_router(r, prefix=settings.API_PREFIX)
