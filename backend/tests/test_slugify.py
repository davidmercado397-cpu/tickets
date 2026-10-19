"""Tests unitarios del slugify y la validación de code (sin BD)."""

from __future__ import annotations

from app.services.slugify import is_valid_code, slugify


def test_slugify_normalizes_accents_and_spaces():
    assert slugify("Recursos Humanos") == "recursos_humanos"
    assert slugify("Formación") == "formacion"
    assert slugify("Cuentas por Pagar") == "cuentas_por_pagar"
    assert slugify("  Seguridad y Salud  ") == "seguridad_y_salud"


def test_is_valid_code_accepts_valid_format():
    assert is_valid_code("rrhh")
    assert is_valid_code("nomina_rrhh")
    assert is_valid_code("area-1")


def test_is_valid_code_rejects_invalid_format():
    assert not is_valid_code("a")  # muy corto
    assert not is_valid_code("Mayus")  # mayúsculas
    assert not is_valid_code("con espacio")
    assert not is_valid_code("acento_ñ")
