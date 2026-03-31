from fastapi import FastAPI

from app.api.apps import router as apps_router
from app.api.chat import router as chat_router
from app.api.device import router as device_router
from app.api.challenges import router as challenges_router
from app.api.conversation_events import router as conversation_events_router
from app.api.conversation_memory import router as conversation_memory_router
from app.api.delivery import router as delivery_router
from app.api.events import router as events_router
from app.api.health import router as health_router
from app.api.pairing import router as pairing_router
from app.api.profile import router as profile_router
from app.api.tasks import router as tasks_router
from app.config import get_settings
from app.services.app_catalog_store import InMemoryAppCatalogStore
from app.services.challenge_store import InMemoryChallengeStore
from app.services.chat_responder import create_chat_responder
from app.services.conversation_event_store import InMemoryConversationEventStore
from app.services.device_presence_store import InMemoryDevicePresenceStore
from app.services.conversation_memory_store import InMemoryConversationMemoryStore
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
    application.state.device_presence_store = InMemoryDevicePresenceStore(
        state_backend=state_backend
    )
    application.state.app_catalog_store = InMemoryAppCatalogStore(
        state_backend=state_backend
    )
    application.state.owner_profile_store = InMemoryOwnerProfileStore(
        state_backend=state_backend
    )
    application.state.pairing_store = InMemoryPairingStore(state_backend=state_backend)
    application.state.task_store = InMemoryTaskStore(state_backend=state_backend)
    application.state.challenge_store = InMemoryChallengeStore(state_backend=state_backend)
    application.state.delivery_store = InMemoryDeliveryStore(state_backend=state_backend)
    application.state.conversation_event_store = InMemoryConversationEventStore(
        state_backend=state_backend
    )
    application.state.conversation_memory_store = InMemoryConversationMemoryStore(
        state_backend=state_backend
    )
    application.state.chat_responder = create_chat_responder(
        api_key=settings.deepseek_api_key,
        model=settings.deepseek_model,
    )
    application.include_router(health_router)
    application.include_router(apps_router, prefix=settings.api_prefix)
    application.include_router(chat_router, prefix=settings.api_prefix)
    application.include_router(device_router, prefix=settings.api_prefix)
    application.include_router(profile_router, prefix=settings.api_prefix)
    application.include_router(tasks_router, prefix=settings.api_prefix)
    application.include_router(pairing_router, prefix=settings.api_prefix)
    application.include_router(events_router, prefix=settings.api_prefix)
    application.include_router(challenges_router, prefix=settings.api_prefix)
    application.include_router(delivery_router, prefix=settings.api_prefix)
    application.include_router(conversation_events_router, prefix=settings.api_prefix)
    application.include_router(conversation_memory_router, prefix=settings.api_prefix)
    return application


app = create_app()
