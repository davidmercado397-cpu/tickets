"""Regla del monolito modular: un módulo solo importa de app.core y de los `public.py` de otros módulos."""

from __future__ import annotations

import ast
import pathlib

MODULES_DIR = pathlib.Path(__file__).resolve().parents[1] / "app" / "modules"


def _imports(path: pathlib.Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    names: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            names.append(node.module)
            names += [f"{node.module}.{a.name}" for a in node.names]
        elif isinstance(node, ast.Import):
            names += [a.name for a in node.names]
    return names


def test_modules_only_use_public_facades_of_other_modules():
    violations = []
    for file in MODULES_DIR.rglob("*.py"):
        rel = file.relative_to(MODULES_DIR)
        if len(rel.parts) < 2:
            continue
        own = rel.parts[0]
        for name in _imports(file):
            if not name.startswith("app.modules."):
                continue
            parts = name.split(".")
            if len(parts) < 3 or parts[2] == own:
                continue
            # Permitido: app.modules.<otro>.public (o importar el submódulo `public` desde el paquete).
            if len(parts) >= 4 and parts[3] == "public":
                continue
            if len(parts) == 3:
                continue  # `from app.modules import x` → se valida en la línea con el atributo
            violations.append(f"{rel}: {name}")
    assert not violations, "Imports entre módulos fuera de su fachada pública:\n" + "\n".join(violations)
