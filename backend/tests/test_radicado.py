"""Radicado: año en zona local (boundary de fin de año) y formato (prefijo opcional)."""

from __future__ import annotations

from datetime import datetime, timezone

from app.services.radicado import format_radicado, local_year


def test_local_year_uses_offset_at_year_boundary():
    # 1-ene 02:00 UTC con offset -5 = 31-dic 21:00 hora Colombia → vigencia 2025.
    utc = datetime(2026, 1, 1, 2, 0, tzinfo=timezone.utc)
    assert local_year(-5, utc) == 2025
    # 1-ene 06:00 UTC con offset -5 = 1-ene 01:00 hora Colombia → vigencia 2026.
    utc2 = datetime(2026, 1, 1, 6, 0, tzinfo=timezone.utc)
    assert local_year(-5, utc2) == 2026


def test_format_radicado_with_prefix():
    assert format_radicado("SRV", 2026, 123) == "SRV-2026-000123"


def test_format_radicado_without_prefix_is_clean():
    assert format_radicado("", 2026, 123) == "2026-000123"
