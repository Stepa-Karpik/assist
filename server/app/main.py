from fastapi import FastAPI

from app.api.device import router as device_router
from app.api.events import router as events_router
from app.api.health import router as health_router
from app.api.pairing import router as pairing_router
from app.api.tasks import router as tasks_router
from app.config import get_settings
from app.services.pairing_store import InMemoryPairingStore


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
    )
    application.state.pairing_store = InMemoryPairingStore()
    application.include_router(health_router)
    application.include_router(device_router, prefix=settings.api_prefix)
    application.include_router(tasks_router, prefix=settings.api_prefix)
    application.include_router(pairing_router, prefix=settings.api_prefix)
    application.include_router(events_router, prefix=settings.api_prefix)
    return application


app = create_app()
