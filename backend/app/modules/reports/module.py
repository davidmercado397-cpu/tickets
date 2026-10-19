from app.core.module import Module
from app.core.permissions import register
from app.modules.reports.router import router

register(
    "Reportes",
    ("reports.view", "Ver tablero e indicadores"),
    ("reports.export", "Exportar reportes (Excel/PDF)"),
)

module = Module(name="reports", routers=[router])
