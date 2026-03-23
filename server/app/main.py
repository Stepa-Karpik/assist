from fastapi import FastAPI

from app.api.device import router as device_router
from app.api.health import router as health_router
from app.api.tasks import router as tasks_router
from app.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
    )
    application.include_router(health_router)
    application.include_router(device_router, prefix=settings.api_prefix)
    application.include_router(tasks_router, prefix=settings.api_prefix)
    return application


app = create_app()
