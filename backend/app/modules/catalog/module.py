from app.core.module import Module
from app.core.permissions import register
from app.modules.catalog.router import public_router, router
from app.modules.catalog.service import seed

register("Catálogo", ("catalog.manage", "Gestionar tipos, categorías y subcategorías de PQRS"))

module = Module(name="catalog", routers=[router, public_router], seed_tenant=seed)
