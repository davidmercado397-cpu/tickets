"""Orquesta la emisión del certificado: valida empleado → genera PDF (fresco) → sube a R2 → registra
como ticket → devuelve la URL firmada.

Regenera SIEMPRE (datos actuales + fecha de hoy). El registro como ticket (categoría configurable) sirve
para medir el volumen/tiempos del bot; el bot lo cierra tras enviar el PDF."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from app.domain.errors import ValidationError
from app.domain.models import CertificateResult, Contact
from app.domain.ports import ObjectStorage
from app.services.certificate import CertificateRenderer
from app.services.employee_service import EmployeeService
from app.services.ticket_service import TicketService


class CertificateService:
    def __init__(
        self,
        employees: EmployeeService,
        renderer: CertificateRenderer,
        storage: ObjectStorage,
        tickets: TicketService,
        *,
        category_code: str,
        tz_offset_hours: int,
        signed_url_ttl: int,
    ) -> None:
        self._employees = employees
        self._renderer = renderer
        self._storage = storage
        self._tickets = tickets
        self._category_code = category_code
        self._tz_offset_hours = tz_offset_hours
        self._ttl = signed_url_ttl

    async def generate(
        self, *, document: str, contact: Contact, conversation_id: str | None
    ) -> CertificateResult:
        employee = await self._employees.get(document)  # 404 si no existe
        if employee.status and employee.status.strip().lower().startswith("retir"):
            raise ValidationError("El empleado está retirado; no se emite el certificado.")

        today = (datetime.now(timezone.utc) + timedelta(hours=self._tz_offset_hours)).date()
        pdf = self._renderer.render(employee, today)

        key = f"certificates/{document}/{uuid.uuid4().hex}.pdf"
        await self._storage.put(key, pdf, "application/pdf")
        url = await self._storage.signed_url(key, self._ttl)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=self._ttl)

        # Registro como ticket (categoría certificado_laboral). Valida la categoría (422 si no existe) y
        # deriva el área. NO notifica al grupo (lo sirve el bot, no es un caso para agentes).
        ticket = await self._tickets.create(
            category_code=self._category_code,
            contact=contact,
            conversation_id=conversation_id,
            channel="whatsapp",
            subject="Certificado laboral",
            fields={"kind": "certificate", "document": document},
        )
        return CertificateResult(url=url, expires_at=expires_at, ticket=ticket)
