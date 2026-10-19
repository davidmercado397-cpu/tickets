"""Carta de respuesta formal en PDF (fpdf2): membrete con logo, datos del caso, cuerpo y firma."""

from __future__ import annotations

import io
import logging
from datetime import datetime, timedelta, timezone

from fpdf import FPDF

logger = logging.getLogger(__name__)

MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre",
          "octubre", "noviembre", "diciembre"]

_REPLACEMENTS = {"“": '"', "”": '"', "‘": "'", "’": "'", "–": "-", "—": "-", "…": "...", "•": "-", " ": " "}


def latin1(text: str | None) -> str:
    """Las fuentes base de PDF son latin-1: normaliza comillas tipográficas y descarta lo demás."""
    text = text or ""
    for a, b in _REPLACEMENTS.items():
        text = text.replace(a, b)
    return text.encode("latin-1", "replace").decode("latin-1")


def date_es(dt: datetime, offset_hours: int = -5) -> str:
    local = dt.astimezone(timezone(timedelta(hours=offset_hours)))
    return f"{local.day} de {MONTHS[local.month - 1]} de {local.year}"


def _hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = (value or "#0B3D91").lstrip("#")
    try:
        return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)
    except (ValueError, IndexError):
        return 11, 61, 145


class LetterPDF(FPDF):
    def __init__(self, tenant: dict, draft: bool) -> None:
        super().__init__(format="Letter")
        self.tenant = tenant
        self.draft = draft
        self.color = _hex_to_rgb(tenant.get("primary_color", ""))
        self.logo: bytes | None = None
        self.set_margins(22, 20, 22)
        self.set_auto_page_break(True, margin=28)

    def header(self) -> None:
        y = 12
        if self.logo:
            try:
                self.image(io.BytesIO(self.logo), x=22, y=y, h=18)
            except Exception:  # noqa: BLE001 - formato de logo no soportado → sin logo
                logger.warning("No se pudo dibujar el logo en la carta")
        self.set_xy(90, y)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(*self.color)
        self.cell(0, 6, latin1(self.tenant.get("legal_name") or self.tenant.get("name")), align="R",
                  new_x="LMARGIN", new_y="NEXT")
        self.set_x(90)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(90, 90, 90)
        if self.tenant.get("nit"):
            self.cell(0, 4, latin1(f"NIT {self.tenant['nit']}"), align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*self.color)
        self.set_line_width(0.6)
        self.line(22, 34, self.w - 22, 34)
        self.set_y(40)
        if self.draft:
            self.set_font("Helvetica", "B", 50)
            self.set_text_color(230, 230, 230)
            with self.rotation(35, self.w / 2, self.h / 2):
                self.text(self.w / 2 - 50, self.h / 2, "BORRADOR")
            self.set_text_color(0, 0, 0)
            self.set_y(40)

    def footer(self) -> None:
        self.set_y(-22)
        self.set_draw_color(*self.color)
        self.set_line_width(0.3)
        self.line(22, self.get_y(), self.w - 22, self.get_y())
        self.ln(2)
        self.set_font("Helvetica", "", 7.5)
        self.set_text_color(110, 110, 110)
        parts = [self.tenant.get(k) for k in ("address", "city", "phone", "email", "website")]
        self.multi_cell(0, 3.6, latin1("  |  ".join(p for p in parts if p)), align="C", new_x="LMARGIN", new_y="NEXT")
        extra = (self.tenant.get("settings", {}).get("letter") or {}).get("footer")
        if extra:
            self.multi_cell(0, 3.6, latin1(extra), align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_y(-10)
        self.cell(0, 4, f"Página {self.page_no()}/{{nb}}", align="C")


def build_letter(
    *,
    tenant: dict,
    case: dict,
    body: str,
    signer: dict | None,
    logo: bytes | None,
    signature: bytes | None,
    now: datetime,
    draft: bool = False,
) -> bytes:
    letter_cfg = tenant.get("settings", {}).get("letter") or {}
    pdf = LetterPDF(tenant, draft)
    pdf.logo = logo
    pdf.alias_nb_pages()
    pdf.add_page()
    pdf.set_text_color(30, 30, 30)

    pdf.set_font("Helvetica", "", 10)
    city = letter_cfg.get("city") or tenant.get("city") or ""
    pdf.cell(0, 5, latin1(f"{city + ', ' if city else ''}{date_es(now)}"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 5, "Señor(a)", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 5, latin1(case.get("requester_name") or "Solicitante"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    for line in (case.get("requester_company"), case.get("requester_address"), case.get("requester_email")):
        if line:
            pdf.cell(0, 5, latin1(line), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    pdf.set_font("Helvetica", "B", 10)
    created = case.get("created_at")
    ref = f"Radicado {case['radicado']}" + (f" del {date_es(created)}" if created else "")
    pdf.multi_cell(0, 5, latin1(f"Asunto: Respuesta a {case.get('request_type', '').lower() or 'solicitud'} - {ref}"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 5, latin1(f"Referencia: {case.get('subject', '')}"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)

    pdf.set_font("Helvetica", "", 10.5)
    for paragraph in latin1(body).replace("\r\n", "\n").split("\n\n"):
        pdf.multi_cell(0, 5.4, paragraph.strip(), align="J", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)

    pdf.ln(4)
    pdf.cell(0, 5, latin1(letter_cfg.get("closing") or "Cordialmente,"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    if signature:
        try:
            pdf.image(io.BytesIO(signature), h=18)
        except Exception:  # noqa: BLE001
            pdf.ln(14)
    else:
        pdf.ln(14)
    pdf.set_draw_color(60, 60, 60)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + 70, pdf.get_y())
    pdf.ln(1)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 5, latin1((signer or {}).get("full_name") or ""), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9.5)
    if (signer or {}).get("position"):
        pdf.cell(0, 5, latin1(signer["position"]), new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 5, latin1(tenant.get("legal_name") or tenant.get("name")), new_x="LMARGIN", new_y="NEXT")
    return bytes(pdf.output())
