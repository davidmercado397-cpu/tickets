from app.core.module import Module
from app.modules.notifications import handlers  # noqa: F401 - registra oyentes de eventos
from app.modules.notifications import jobs  # noqa: F401 - registra trabajos del worker
from app.modules.notifications.router import router

module = Module(name="notifications", routers=[router])
