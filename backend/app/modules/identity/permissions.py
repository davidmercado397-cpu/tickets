from app.core.permissions import register

register(
    "Administración",
    ("tenant.settings", "Configurar la empresa (datos, marca, correo, portal)"),
    ("users.manage", "Gestionar usuarios"),
    ("roles.manage", "Gestionar roles y permisos"),
    ("areas.manage", "Gestionar áreas"),
    ("integrations.manage", "Gestionar API keys de integraciones"),
)

# Roles que se siembran en cada empresa nueva (editables salvo el admin).
SYSTEM_ROLES: list[dict] = [
    {
        "code": "admin",
        "name": "Administrador",
        "description": "Acceso total. Aprueba respuestas.",
        "all_permissions": True,
        "permissions": [],
    },
    {
        "code": "radicador",
        "name": "Radicador / ventanilla",
        "description": "Registra PQRS manuales, clasifica y asigna.",
        "permissions": [
            "pqrs.view_all", "pqrs.create", "pqrs.classify", "pqrs.assign",
            "clients.view", "employees.view",
        ],
    },
    {
        "code": "gestor",
        "name": "Gestor de área",
        "description": "Atiende las PQRS de sus áreas y proyecta respuestas.",
        "permissions": [
            "pqrs.view_area", "pqrs.manage", "pqrs.respond", "pqrs.create", "pqrs.rca_contribute",
            "clients.view", "employees.view", "tasks.manage",
        ],
    },
    {
        "code": "calidad",
        "name": "Calidad",
        "description": "Recibe las quejas de clientes externos y lidera el análisis de causa raíz y el plan de acción.",
        "permissions": [
            "pqrs.view_all", "pqrs.classify", "pqrs.assign", "pqrs.manage", "pqrs.respond", "pqrs.rca_manage",
            "pqrs.rca_contribute", "clients.view", "employees.view", "tasks.manage", "tasks.view_all",
            "reports.view", "reports.export",
        ],
    },
    {
        "code": "aprobador",
        "name": "Aprobador de respuestas",
        "description": "Revisa y aprueba respuestas antes del envío.",
        "permissions": ["pqrs.view_all", "pqrs.approve", "clients.view", "employees.view"],
    },
    {
        "code": "jefe_operacion",
        "name": "Jefe de operación",
        "description": "Realiza visitas a puesto y hace seguimiento de tareas.",
        "permissions": [
            "visits.perform", "tasks.manage", "clients.view", "pqrs.view_area", "pqrs.create",
        ],
    },
    {
        "code": "auditor",
        "name": "Auditor / consulta",
        "description": "Solo lectura y reportes.",
        "permissions": [
            "pqrs.view_all", "clients.view", "employees.view", "visits.view_all",
            "tasks.view_all", "reports.view", "reports.export",
        ],
    },
]
