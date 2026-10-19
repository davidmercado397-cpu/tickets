from app.core.config import get_settings
from app.core.module import Module
from app.modules.channels.email_inbound import poll_all
from app.modules.channels.router import router

# WhatsApp: el Gateway (meta-waba) radica por POST /api/integrations/pqrs con la API key de la empresa.
module = Module(
    name="channels",
    routers=[router],
    periodic=[("channels.email_poll", lambda: get_settings().WORKER_IMAP_POLL_SECONDS, poll_all)],
)
