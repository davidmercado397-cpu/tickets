"""Cola de trabajos en segundo plano sobre Redis (sin dependencias extra; KISS).

`enqueue("send_email", {...})` deja el trabajo en una lista de Redis; el worker (`app.worker`) lo
consume con BLPOP y lo despacha al manejador registrado con `@job("send_email")`."""

from __future__ import annotations

import json
import logging
from typing import Any, Awaitable, Callable

import redis.asyncio as redis

logger = logging.getLogger(__name__)

QUEUE = "jobs:default"
JobFn = Callable[[dict[str, Any]], Awaitable[None]]
_jobs: dict[str, JobFn] = {}
_redis: redis.Redis | None = None


def init_redis(url: str) -> redis.Redis:
    global _redis
    _redis = redis.from_url(url, encoding="utf-8", decode_responses=True)
    return _redis


def get_redis() -> redis.Redis:
    if _redis is None:
        raise RuntimeError("Redis no inicializado.")
    return _redis


async def close_redis() -> None:
    if _redis is not None:
        await _redis.aclose()


def job(name: str) -> Callable[[JobFn], JobFn]:
    def deco(fn: JobFn) -> JobFn:
        _jobs[name] = fn
        return fn

    return deco


async def enqueue(name: str, payload: dict[str, Any]) -> None:
    try:
        await get_redis().rpush(QUEUE, json.dumps({"name": name, "payload": payload}, default=str))
    except Exception:  # noqa: BLE001 - encolar es best-effort; no rompe la operación de negocio
        logger.exception("No se pudo encolar el trabajo %s", name)


async def run_job(raw: str) -> None:
    item = json.loads(raw)
    fn = _jobs.get(item["name"])
    if fn is None:
        logger.error("Trabajo desconocido: %s", item["name"])
        return
    await fn(item["payload"])
