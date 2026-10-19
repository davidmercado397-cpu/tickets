"""Unit del renderizador y los formatos en español (sin app ni R2)."""

from __future__ import annotations

from datetime import date

from app.domain.models import Employee
from app.services.certificate import CertificateRenderer
from app.services.dates_es import format_document, long_date_es, short_date


def _renderer() -> CertificateRenderer:
    return CertificateRenderer(
        org_header="LA SUSCRITA DIRECCIÓN DE GESTION HUMANA\nY LA EMPRESA SERVIGPODER LTDA",
        signatory_name="ANGELICA PATRICIA GOMEZ ALZATE",
        signatory_title="Auxiliar de servicio de cliente interno",
        footer_whatsapp="3135877576",
        city="Santiago de Cali",
    )


def test_render_produces_pdf_bytes():
    emp = Employee(
        document="94313648",
        full_name="Varela Rodriguez Daimer",
        position="Escolta",
        hire_date=date(2023, 8, 15),
        contract_type="Fijo inferior a un año",
        status="activo",
    )
    pdf = _renderer().render(emp, date(2026, 6, 23))
    assert pdf[:4] == b"%PDF"
    assert len(pdf) > 800  # una página con contenido


def test_render_tolerates_missing_optional_fields():
    emp = Employee(document="1", full_name="Solo Nombre")
    pdf = _renderer().render(emp, date(2026, 1, 1))
    assert pdf[:4] == b"%PDF"


def test_dates_es_helpers():
    assert long_date_es(date(2026, 6, 23)) == "23 de junio del 2026"
    assert short_date(date(2023, 8, 15)) == "15/08/2023"
    assert format_document("94313648") == "94.313.648"
    assert format_document("AB-12") == "AB-12"  # no numérico puro → tal cual
