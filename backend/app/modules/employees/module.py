from app.core.module import Module
from app.core.permissions import register
from app.modules.employees.router import router

register(
    "Empleados",
    ("employees.view", "Consultar empleados"),
    ("employees.manage", "Gestionar empleados (cliente interno)"),
)

module = Module(name="employees", routers=[router])
