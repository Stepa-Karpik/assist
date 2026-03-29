from fastapi import FastAPI

from app.api.apps import router as apps_router
from app.api.device import router as device_router
from app.api.challenges import router as challenges_router
from app.api.delivery import router as delivery_router
from app.api.events import router as events_router
from app.api.health import router as health_router
from app.api.pairing import router as pairing_router
from app.api.profile import router as profile_router
from app.api.tasks import router as tasks_router
from app.config import get_settings
from app.services.app_catalog_store import InMemoryAppCatalogStore
from app.services.challenge_store import InMemoryChallengeStore
from app.services.device_registry import DeviceRegistry
from app.services.device_presence_store import InMemoryDevicePresenceStore
from app.services.delivery_store import InMemoryDeliveryStore
from app.services.pairing_store import InMemoryPairingStore
from app.services.owner_profile_store import InMemoryOwnerProfileStore
from app.services.state_backend import create_state_backend
from app.services.task_store import InMemoryTaskStore


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
    )
    state_backend = create_state_backend(settings)
    application.state.device_registry = DeviceRegistry(state_backend=state_backend)
    application.state.device_presence_store = InMemoryDevicePresenceStore(
        state_backend=state_backend
    )
    application.state.app_catalog_store = InMemoryAppCatalogStore(
        state_backend=state_backend
    )
    application.state.owner_profile_store = InMemoryOwnerProfileStore(
        state_backend=state_backend
    )
    application.state.pairing_store = InMemoryPairingStore(
        state_backend=state_backend,
        device_registry=application.state.device_registry,
    )
    application.state.task_store = InMemoryTaskStore(state_backend=state_backend)
    application.state.challenge_store = InMemoryChallengeStore(state_backend=state_backend)
    application.state.delivery_store = InMemoryDeliveryStore(state_backend=state_backend)
    application.include_router(health_router)
    application.include_router(apps_router, prefix=settings.api_prefix)
    application.include_router(device_router, prefix=settings.api_prefix)
    application.include_router(profile_router, prefix=settings.api_prefix)
    application.include_router(tasks_router, prefix=settings.api_prefix)
    application.include_router(pairing_router, prefix=settings.api_prefix)
    application.include_router(events_router, prefix=settings.api_prefix)
    application.include_router(challenges_router, prefix=settings.api_prefix)
    application.include_router(delivery_router, prefix=settings.api_prefix)
    return application


app = create_app()
