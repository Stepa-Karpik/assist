from threading import Lock

from app.models.conversation_memory import (
    ConversationMemoryEvent,
    ConversationMemoryEventAckResponse,
    ConversationMemoryEventCreateRequest,
)
from app.services.state_backend import StateBackend


class InMemoryConversationMemoryStore:
    def __init__(self, state_backend: StateBackend | None = None) -> None:
        self._state_backend = state_backend
        self._lock = Lock()
        self._events: dict[str, ConversationMemoryEvent] = {}
        self._restore_state()

    def reset(self) -> None:
        with self._lock:
            self._events = {}
            self._persist()

    def create(self, payload: ConversationMemoryEventCreateRequest) -> ConversationMemoryEvent:
        event = ConversationMemoryEvent(
            device_id=payload.device_id,
            origin=payload.origin,
            prompt=payload.prompt,
            answer=payload.answer,
            source_urls=list(payload.source_urls),
            memory_writes=list(payload.memory_writes),
        )

        with self._lock:
            self._events[event.event_id] = event
            self._persist()

        return event

    def list_pending(self, device_id: str) -> list[ConversationMemoryEvent]:
        with self._lock:
            return [
                event.model_copy(deep=True)
                for event in self._events.values()
                if event.device_id == device_id and event.status == "pending"
            ]

    def ack(self, event_id: str) -> ConversationMemoryEventAckResponse | None:
        with self._lock:
            event = self._events.get(event_id)

            if event is None:
                return None

            event.status = "delivered"
            self._persist()
            return ConversationMemoryEventAckResponse(
                event_id=event.event_id,
                status=event.status,
            )

    def _restore_state(self) -> None:
        if self._state_backend is None:
            return

        raw_events = self._state_backend.read_section("conversation_memory_events", [])
        self._events = {
            event.event_id: event
            for event in (ConversationMemoryEvent.model_validate(item) for item in raw_events)
        }

    def _persist(self) -> None:
        if self._state_backend is None:
            return

        self._state_backend.write_section(
            "conversation_memory_events",
            [event.model_dump(mode="json") for event in self._events.values()],
        )
