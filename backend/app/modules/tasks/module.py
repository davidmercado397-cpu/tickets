from app.core.module import Module
from app.core.permissions import register
from app.modules.tasks.router import integration_router, router

register(
    "Tareas",
    ("tasks.manage", "Crear, asignar y editar tareas"),
    ("tasks.view_all", "Ver todas las tareas"),
)

module = Module(name="tasks", routers=[router, integration_router])
