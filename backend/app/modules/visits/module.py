from app.core.module import Module
from app.core.permissions import register
from app.modules.visits.router import router
from app.modules.visits.service import seed

register(
    "Visitas a puesto",
    ("visits.manage", "Configurar formularios y metas de visitas; ver todas"),
    ("visits.perform", "Realizar visitas a puesto"),
    ("visits.view_all", "Consultar todas las visitas"),
)

module = Module(name="visits", routers=[router], seed_tenant=seed)
