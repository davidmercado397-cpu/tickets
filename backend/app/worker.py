"""Worker en segundo plano: consume la cola de trabajos (correo) y ejecuta tareas periódicas de los
módulos (lectura IMAP, alertas de SLA). Mismo código e imagen que la API: `python -m app.worker`."""

from __future__ import annotations

import asyncio
import logging
import signal
import time

from app.core import db, jobs
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.storage import init_storage
from app.modules import load_modules

logger = logging.getLogger("worker")


async def consume(stop: asyncio.Event) -> None:
    redis = jobs.get_redis()
    while not stop.is_set():
        try:
            item = await redis.blpop(jobs.QUEUE, timeout=5)
        except Exception:  # noqa: BLE001 - Redis caído: reintentar
            logger.exception("Error leyendo la cola")
            await asyncio.sleep(3)
            continue
        if item is None:
            continue
        try:
            await jobs.run_job(item[1])
        except Exception:  # noqa: BLE001
            logger.exception("Falló un trabajo")


async def periodic(stop: asyncio.Event, name: str, every, fn) -> None:
    last = 0.0
    while not stop.is_set():
        if time.monotonic() - last >= every():
            last = time.monotonic()
            try:
                await fn()
            except Exception:  # noqa: BLE001
                logger.exception("Falló la tarea periódica %s", name)
        await asyncio.sleep(5)


async def main() -> None:
    settings = get_settings()
    configure_logging(settings.LOG_LEVEL, settings.LOG_FORMAT, settings.LOG_TZ_OFFSET_HOURS)
    modules = load_modules()
    db.init_db(settings.DATABASE_URL)
    jobs.init_redis(settings.REDIS_URL)
    init_storage(settings)
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except NotImplementedError:  # Windows
            pass
    tasks = [asyncio.create_task(consume(stop))]
    for m in modules:
        for name, every, fn in m.periodic:
            tasks.append(asyncio.create_task(periodic(stop, name, every, fn)))
    logger.info("Worker arrancado", extra={"periodic": [p[0] for m in modules for p in m.periodic]})
    await stop.wait()
    for t in tasks:
        t.cancel()
    await jobs.close_redis()
    await db.close_db()


if __name__ == "__main__":
    asyncio.run(main())
