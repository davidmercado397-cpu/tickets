from app.core.module import Module
from app.core.permissions import register
from app.modules.sla.router import router
from app.modules.sla.service import seed

register("SLA", ("sla.manage", "Configurar tiempos de respuesta (SLA) y calendario hábil"))

module = Module(name="sla", routers=[router], seed_tenant=seed)
