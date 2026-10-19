"""Endpoint de salud (operacional, sin contrato). No requiere auth."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health", summary="Healthcheck")
async def health() -> dict[str, str]:
    return {"status": "ok"}
