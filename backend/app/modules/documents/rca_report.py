"""Informe PDF del análisis de causa raíz y su plan de acción (documentación de cierre de la queja)."""

from __future__ import annotations

from datetime import datetime

from app.modules.documents.letters import LetterPDF, date_es, latin1

METHODS = {"five_whys": "5 porqués", "ishikawa": "Espina de pescado (Ishikawa)", "free": "Análisis libre"}
CATEGORIES = {
    "people": "Mano de obra (personas)",
    "method": "Método (procedimientos)",
    "materials": "Materiales y dotación",
    "machine": "Maquinaria y equipos",
    "measurement": "Medición y control",
    "environment": "Medio ambiente / entorno",
}
TASK_STATUS = {"open": "Pendiente", "in_progress": "En curso", "done": "Cumplida", "cancelled": "Cancelada"}


def _dt(value: str | None) -> str:
    if not value:
        return "-"
    return date_es(datetime.fromisoformat(value))


class _Report(LetterPDF):
    def section(self, title: str) -> None:
        self.ln(3)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(*self.color)
        self.cell(0, 7, latin1(title), new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(30, 30, 30)
        self.set_font("Helvetica", "", 10)

    def para(self, text: str | None, size: float = 10) -> None:
        self.set_font("Helvetica", "", size)
        self.multi_cell(0, 5, latin1(text or "-"), new_x="LMARGIN", new_y="NEXT")

    def kv(self, label: str, value: str | None) -> None:
        self.set_font("Helvetica", "B", 9.5)
        self.cell(48, 5.5, latin1(label))
        self.set_font("Helvetica", "", 9.5)
        self.multi_cell(0, 5.5, latin1(value or "-"), new_x="LMARGIN", new_y="NEXT")


def build_rca_report(*, tenant: dict, case: dict, rca: dict, logo: bytes | None, now: datetime) -> bytes:
    pdf = _Report(tenant, draft=False)
    pdf.logo = logo
    pdf.alias_nb_pages()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 8, latin1("Análisis de causa raíz"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 5, latin1(f"Generado el {date_es(now)}"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(30, 30, 30)

    pdf.section("1. Datos de la queja")
    pdf.kv("Radicado", case["radicado"])
    pdf.kv("Fecha de radicación", date_es(case["created_at"]))
    pdf.kv("Tipo / categoría", " / ".join(x for x in (case.get("request_type"), case.get("category")) if x))
    pdf.kv("Cliente / sede", " / ".join(x for x in (case.get("client"), case.get("site")) if x))
    pdf.kv("Solicitante", case.get("requester"))
    pdf.kv("Asunto", case["subject"])

    pdf.section("2. Planteamiento del problema")
    pdf.kv("Método", METHODS.get(rca["method"], rca["method"]))
    pdf.para(rca.get("problem_statement"))

    pdf.section("3. Análisis por área")
    for pt in rca["participants"]:
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 6, latin1(pt["area"]["name"]), new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "I", 8.5)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(0, 4.5, latin1(f"Aportó: {pt.get('contributed_by') or '-'} · {_dt(pt.get('contributed_at'))}"),
                 new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(30, 30, 30)
        for i, why in enumerate(pt.get("whys") or [], start=1):
            pdf.para(f"¿Por qué? {i}: {why}", 9.5)
        pdf.para(pt.get("analysis"), 9.5)
        pdf.ln(1)

    pdf.section("4. Causa raíz")
    pdf.kv("Categoría (6M)", CATEGORIES.get(rca.get("cause_category") or "", rca.get("cause_category")))
    pdf.para(rca.get("root_cause"))
    pdf.kv("Consolidó", f"{rca.get('consolidated_by') or '-'} · {_dt(rca.get('consolidated_at'))}")

    pdf.section("5. Validación de Calidad")
    required = rca.get("plan_required")
    pdf.kv("¿Requiere plan de acción?", "Sí" if required else ("No" if required is False else "Pendiente"))
    pdf.para(rca.get("validation_note"))
    pdf.kv("Validó", f"{rca.get('validated_by') or '-'} · {_dt(rca.get('validated_at'))}")

    if required:
        pdf.section("6. Plan de acción")
        pdf.set_font("Helvetica", "B", 8.5)
        widths = (78, 40, 26, 26)
        for label, w in zip(("Acción", "Responsable", "Fecha límite", "Estado"), widths):
            pdf.cell(w, 6, latin1(label), border=1)
        pdf.ln()
        pdf.set_font("Helvetica", "", 8.5)
        for a in rca.get("actions") or []:
            due = datetime.fromisoformat(a["due_date"]).strftime("%d/%m/%Y") if a.get("due_date") else "-"
            values = (a["title"], a.get("assignee") or "-", due, TASK_STATUS.get(a["status"], a["status"]))
            for v, w in zip(values, widths):
                pdf.cell(w, 6, latin1(str(v))[: int(w / 1.7)], border=1)
            pdf.ln()
        if rca.get("plan_summary"):
            pdf.ln(2)
            pdf.para(rca["plan_summary"])

    pdf.section("Cierre del análisis")
    pdf.kv("Estado", "Cerrado" if rca["status"] == "closed" else "En curso")
    pdf.kv("Cerró", f"{rca.get('closed_by') or '-'} · {_dt(rca.get('closed_at'))}")
    return bytes(pdf.output())
