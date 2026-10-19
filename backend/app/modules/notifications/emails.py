"""Plantillas HTML de correo (con la marca de cada empresa)."""

from __future__ import annotations

from html import escape

from app.core.config import get_settings


def layout(tenant: dict, title: str, content_html: str, cta: tuple[str, str] | None = None) -> str:
    base = get_settings().PUBLIC_BASE_URL.rstrip("/")
    color = tenant.get("primary_color") or "#0B3D91"
    logo = (
        f'<img src="{base}/api/public/tenants/{tenant["slug"]}/logo" alt="" style="max-height:48px">'
        if tenant.get("logo_key") else f'<strong style="font-size:18px;color:{color}">{escape(tenant["name"])}</strong>'
    )
    button = ""
    if cta:
        label, url = cta
        button = (
            f'<p style="margin:24px 0"><a href="{url}" style="background:{color};color:#fff;padding:12px 20px;'
            f'border-radius:6px;text-decoration:none;font-weight:600">{escape(label)}</a></p>'
        )
    return f"""<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:10px;overflow:hidden">
<tr><td style="padding:20px 28px;border-bottom:4px solid {color}">{logo}</td></tr>
<tr><td style="padding:28px">
<h2 style="margin:0 0 16px;font-size:20px;color:{color}">{escape(title)}</h2>
{content_html}{button}
</td></tr>
<tr><td style="padding:16px 28px;background:#f9fafb;font-size:12px;color:#6b7280">
{escape(tenant.get("legal_name") or tenant["name"])}{(" · NIT " + escape(tenant["nit"])) if tenant.get("nit") else ""}<br>
Este es un mensaje automático; por favor no respondas a este correo.
</td></tr></table></td></tr></table></body></html>"""


def portal_link(tenant: dict, radicado: str, code: str) -> str:
    base = get_settings().PUBLIC_BASE_URL.rstrip("/")
    return f"{base}/portal/{tenant['slug']}/consulta?radicado={radicado}&code={code}"


def staff_link(path: str) -> str:
    return get_settings().PUBLIC_BASE_URL.rstrip("/") + path


def p(text: str) -> str:
    return f'<p style="margin:0 0 12px;line-height:1.5">{escape(text)}</p>'


def kv(rows: list[tuple[str, str | None]]) -> str:
    cells = "".join(
        f'<tr><td style="padding:6px 0;color:#6b7280;width:40%">{escape(k)}</td>'
        f'<td style="padding:6px 0;font-weight:600">{escape(v or "—")}</td></tr>'
        for k, v in rows
    )
    return f'<table width="100%" style="border-collapse:collapse;margin:8px 0 16px;font-size:14px">{cells}</table>'
