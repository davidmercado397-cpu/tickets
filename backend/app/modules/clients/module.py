from app.core.module import Module
from app.core.permissions import register
from app.modules.clients.router import public_router, router

register(
    "Clientes",
    ("clients.view", "Consultar clientes y sedes"),
    ("clients.manage", "Gestionar clientes corporativos y sedes/puestos"),
)

module = Module(name="clients", routers=[router, public_router])
