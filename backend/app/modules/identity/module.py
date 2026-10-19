from app.core.module import Module
from app.modules.identity import permissions  # noqa: F401 - registra permisos
from app.modules.identity.router import auth_router, router
from app.modules.identity.service import seed_tenant

module = Module(name="identity", routers=[auth_router, router], seed_tenant=seed_tenant)
