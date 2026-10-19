"""Registro global de permisos. Cada módulo declara los suyos en su `permissions.py`.

Los roles de cada empresa son datos (tabla `roles`) que combinan estos códigos; el código solo
conoce los permisos, no los roles."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Permission:
    code: str
    label: str
    group: str


_REGISTRY: dict[str, Permission] = {}


def register(group: str, *items: tuple[str, str]) -> None:
    for code, label in items:
        _REGISTRY[code] = Permission(code=code, label=label, group=group)


def all_permissions() -> list[Permission]:
    return sorted(_REGISTRY.values(), key=lambda p: (p.group, p.code))


def all_codes() -> set[str]:
    return set(_REGISTRY)
