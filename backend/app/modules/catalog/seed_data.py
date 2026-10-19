"""Catálogo inicial típico de una empresa de seguridad privada (la empresa lo edita libremente)."""

REQUEST_TYPES = [
    ("peticion", "Petición", "Solicitud de información, documentos o de una actuación."),
    ("queja", "Queja", "Inconformidad con la conducta o atención de una persona."),
    ("reclamo", "Reclamo", "Inconformidad con la prestación del servicio."),
    ("sugerencia", "Sugerencia", "Propuesta para mejorar el servicio."),
    ("felicitacion", "Felicitación", "Reconocimiento al servicio o a una persona."),
    ("denuncia", "Denuncia", "Puesta en conocimiento de una conducta irregular."),
]

# (segmento, código, nombre, área por defecto, prioridad por defecto, tipo (None = todos), subcategorías)
CATEGORIES = [
    ("external", "novedad_puesto", "Novedad en el puesto de servicio", "operaciones", "high", None,
     ["Ausencia del vigilante", "Llegada tarde o relevo", "Vigilante dormido", "Abandono del puesto"]),
    ("external", "conducta_vigilante", "Conducta del vigilante", "operaciones", "high", None,
     ["Trato inadecuado", "Incumplimiento de consignas", "Presentación personal"]),
    ("external", "incumplimiento_servicio", "Incumplimiento del servicio", "operaciones", "high", None,
     ["Rondas no realizadas", "Falla en medios tecnológicos (CCTV, alarmas)", "Falta de dotación o equipos"]),
    ("external", "hurto_dano", "Hurto o daño", "operaciones", "urgent", None,
     ["Hurto en el puesto", "Daño a bienes del cliente", "Siniestro"]),
    ("external", "facturacion", "Facturación", "facturacion", "medium", None,
     ["Error en factura", "Solicitud de soportes", "Ajuste de tarifa"]),
    ("external", "solicitud_servicio", "Solicitud de servicio", "servicio_cliente", "medium", None,
     ["Servicio adicional", "Cambio de horario", "Retiro o traslado de puesto"]),
    ("external", "felicitacion_personal", "Felicitación al personal", "servicio_cliente", "low", "felicitacion",
     ["Vigilante", "Supervisor", "Personal administrativo"]),
    ("internal", "nomina_pagos", "Nómina y pagos", "gestion_humana", "high", None,
     ["Error en el pago", "Horas extras y recargos", "Descuentos"]),
    ("internal", "certificados", "Certificados", "gestion_humana", "medium", None,
     ["Certificado laboral", "Certificado de ingresos y retenciones"]),
    ("internal", "dotacion", "Dotación", "logistica", "medium", None,
     ["Entrega de dotación", "Cambio de talla"]),
    ("internal", "programacion_turnos", "Programación de turnos", "operaciones", "medium", None,
     ["Cambio de turno", "Descansos compensatorios"]),
    ("internal", "sst", "Seguridad y salud en el trabajo", "sst", "high", None,
     ["Accidente laboral", "Condición insegura"]),
    ("internal", "incapacidades_permisos", "Incapacidades, permisos y vacaciones", "gestion_humana", "medium", None,
     ["Radicación de incapacidad", "Solicitud de permiso", "Vacaciones"]),
    ("internal", "convivencia", "Convivencia laboral", "gestion_humana", "high", None,
     ["Acoso laboral", "Conflicto con compañeros o jefes"]),
]
