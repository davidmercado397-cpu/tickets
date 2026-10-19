from app.core.module import Module
from app.modules.tenancy.router import platform_router, public_router, router

module = Module(name="tenancy", routers=[platform_router, router, public_router])
