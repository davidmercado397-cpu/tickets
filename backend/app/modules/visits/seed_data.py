"""Formulario de ejemplo que se siembra en cada empresa (editable o reemplazable)."""

DEFAULT_FORM = {
    "name": "Visita de supervisión a puesto",
    "description": "Revisión del personal, el puesto y la satisfacción del cliente.",
    "fields": [
        {"id": "s_personal", "type": "section", "label": "Presentación del personal"},
        {"id": "uniforme", "type": "yesno", "label": "¿El vigilante porta el uniforme completo y en buen estado?",
         "required": True, "finding": {"op": "equals", "value": "no", "task_title": "Reponer o ajustar el uniforme del vigilante"}},
        {"id": "credencial", "type": "yesno", "label": "¿Porta carné y credencial vigente?", "required": True,
         "finding": {"op": "equals", "value": "no", "task_title": "Gestionar credencial vigente del vigilante", "priority": "high"}},
        {"id": "s_puesto", "type": "section", "label": "Puesto de servicio"},
        {"id": "minuta", "type": "yesno", "label": "¿El libro de minuta está al día?", "required": True,
         "finding": {"op": "equals", "value": "no", "task_title": "Actualizar la minuta del puesto"}},
        {"id": "consignas", "type": "yesno", "label": "¿El vigilante conoce las consignas del puesto?", "required": True,
         "finding": {"op": "equals", "value": "no", "task_title": "Reforzar consignas con el personal del puesto"}},
        {"id": "comunicaciones", "type": "yesno", "label": "¿Los equipos de comunicación funcionan correctamente?",
         "required": True, "finding": {"op": "equals", "value": "no", "task_title": "Revisar equipos de comunicación", "priority": "high"}},
        {"id": "dotacion", "type": "select", "label": "Estado de la dotación y elementos del puesto",
         "options": ["Bueno", "Regular", "Malo"], "required": True,
         "finding": {"op": "in", "value": ["Regular", "Malo"], "task_title": "Reponer dotación del puesto"}},
        {"id": "s_cliente", "type": "section", "label": "Cliente"},
        {"id": "satisfaccion", "type": "rating", "label": "Satisfacción del cliente con el servicio", "min": 1, "max": 5,
         "required": True, "finding": {"op": "lte", "value": 2, "task_title": "Plan de mejora con el cliente", "priority": "high"}},
        {"id": "obs_cliente", "type": "textarea", "label": "Observaciones o solicitudes del cliente"},
        {"id": "foto_puesto", "type": "photo", "label": "Foto del puesto"},
        {"id": "firma", "type": "signature", "label": "Firma de quien atiende la visita"},
    ],
}
