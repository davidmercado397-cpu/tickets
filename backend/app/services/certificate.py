"""Renderizado del certificado laboral en PDF (fpdf2), calcando el formato del ejemplo de Servigpoder.

Fuentes core (Helvetica) con codificación latin-1: cubren los acentos/ñ del español sin empaquetar TTF.
El logo es opcional (imagen); sin él, sale el membrete de texto. La fecha de emisión = hoy (la pasa el
servicio)."""

from __future__ import annotations

import os
from datetime import date

from fpdf import FPDF
from fpdf.enums import XPos, YPos

from app.domain.models import Employee
from app.services.dates_es import format_document, long_date_es, short_date

# fpdf2 deja el cursor en el margen DERECHO tras multi_cell (ancho 0 en la siguiente); volvemos al
# margen izquierdo y bajamos una línea en cada bloque.
_NL = {"new_x": XPos.LMARGIN, "new_y": YPos.NEXT}


class CertificateRenderer:
    def __init__(
        self,
        *,
        org_header: str,
        signatory_name: str,
        signatory_title: str,
        footer_whatsapp: str,
        city: str,
        logo_path: str = "",
    ) -> None:
        self._org_header = org_header
        self._signatory_name = signatory_name
        self._signatory_title = signatory_title
        self._footer_whatsapp = footer_whatsapp
        self._city = city
        self._logo_path = logo_path

    def render(self, employee: Employee, emission_date: date) -> bytes:
        full_name = (employee.full_name or "").upper()
        document = format_document(employee.document)
        hire = short_date(employee.hire_date) if employee.hire_date else "____"
        position = (employee.position or "").upper()
        contract = (employee.contract_type or "").upper()

        pdf = FPDF(format="letter")
        pdf.set_auto_page_break(auto=True, margin=20)
        pdf.add_page()
        pdf.set_margins(25, 20, 25)

        if self._logo_path and os.path.exists(self._logo_path):
            pdf.image(self._logo_path, x=25, y=12, w=35)
            pdf.ln(20)

        # Membrete (centrado, negrita).
        pdf.set_font("Helvetica", "B", 12)
        for line in self._org_header.split("\n"):
            pdf.multi_cell(0, 7, line, align="C", **_NL)
        pdf.ln(6)

        pdf.set_font("Helvetica", "B", 12)
        pdf.multi_cell(0, 8, "CERTIFICA:", align="C", **_NL)
        pdf.ln(6)

        # Cuerpo.
        pdf.set_font("Helvetica", "", 12)
        body = (
            f"Que el (a) Señor(a) {full_name} identificado (a) con cedula de ciudadanía "
            f"N° {document}, labora en la compañía desde el {hire}, desempeñando el cargo de "
            f"{position}, mediante un contrato {contract}."
        )
        pdf.multi_cell(0, 7, body, align="J", **_NL)
        pdf.ln(4)

        constancia = (
            f"En constancia se expide a solicitud del interesado en {self._city}, "
            f"el {long_date_es(emission_date)}."
        )
        pdf.multi_cell(0, 7, constancia, align="J", **_NL)
        pdf.ln(2)
        pdf.multi_cell(0, 7, "Atentamente.", **_NL)
        pdf.ln(18)

        # Firma.
        pdf.set_font("Helvetica", "B", 12)
        pdf.multi_cell(0, 7, self._signatory_name, **_NL)
        pdf.set_font("Helvetica", "", 11)
        pdf.multi_cell(0, 7, self._signatory_title, **_NL)
        pdf.ln(8)

        pdf.set_font("Helvetica", "", 10)
        pdf.multi_cell(
            0,
            6,
            f"Las cartas laborales se confirman a través de WhatsApp al número {self._footer_whatsapp}",
            **_NL,
        )

        return bytes(pdf.output())
