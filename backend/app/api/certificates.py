"""Generación de certificado laboral (bot).

`POST /api/employees/{document}/certificate`: el bot lo invoca; validamos el empleado, generamos el PDF
fresco (datos actuales + fecha de hoy), lo subimos a R2, registramos la emisión como ticket y devolvemos
la URL firmada (que el bot envía por WhatsApp). Si R2 no está configurado → 503."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.api.schemas import CertificateOut, CertificateRequestIn
from app.dependencies import CertificateServiceDep, require_service_token
from app.domain.models import Contact

router = APIRouter(prefix="/employees", tags=["certificates"])


@router.post(
    "/{document}/certificate",
    status_code=status.HTTP_201_CREATED,
    summary="Emitir certificado laboral (bot)",
    dependencies=[Depends(require_service_token)],
)
async def generate_certificate(
    document: str, body: CertificateRequestIn, service: CertificateServiceDep
) -> CertificateOut:
    result = await service.generate(
        document=document,
        contact=Contact(
            wa_id=body.contact.wa_id, name=body.contact.name, document=body.contact.document
        ),
        conversation_id=body.conversation_id,
    )
    return CertificateOut(
        url=result.url,
        expires_at=result.expires_at,
        ticket_id=str(result.ticket.id),
        radicado=result.ticket.radicado,
        status=result.ticket.status,
    )
