from datetime import UTC, datetime
from threading import Lock

from app.models.conversation_event import (
    ConversationEvent,
    ConversationEventAckResponse,
    ConversationEventCreateRequest,
    ConversationEventUpdateRequest,
)
from app.services.state_backend import StateBackend


class InMemoryConversationEventStore:
    def __init__(self, state_backend: StateBackend | None = None) -> None:
        self._state_backend = state_backend
        self._lock = Lock()
        self._events: dict[str, ConversationEvent] = {}
        self._restore_state()

    def reset(self) -> None:
        with self._lock:
            self._events = {}
            self._persist()

    def create(self, payload: ConversationEventCreateRequest) -> ConversationEvent:
        event = ConversationEvent(
            device_id=payload.device_id,
            chat_id=payload.chat_id,
            telegram_user_id=payload.telegram_user_id,
            prompt=payload.prompt,
        )

        with self._lock:
            self._events[event.event_id] = event
            self._persist()

        return event.model_copy(deep=True)

    def list_pending_for_device(self, device_id: str) -> list[ConversationEvent]:
        with self._lock:
            return [
                event.model_copy(deep=True)
                for event in self._events.values()
                if event.device_id == device_id and event.status == "pending"
            ]

    def list_pending_for_bot(self) -> list[ConversationEvent]:
        with self._lock:
            return [
                event.model_copy(deep=True)
                for event in self._events.values()
                if event.status != "pending" and event.revision > event.delivered_revision
            ]

    def update(
        self, event_id: str, payload: ConversationEventUpdateRequest
    ) -> ConversationEvent | None:
        with self._lock:
            event = self._events.get(event_id)

            if event is None:
                return None

            event.status = payload.status
            event.response_text = payload.response_text
            event.error_text = payload.error_text
            event.revision += 1
            event.updated_at = datetime.now(UTC)
            self._persist()
            return event.model_copy(deep=True)

    def ack(
        self, event_id: str, revision: int
    ) -> ConversationEventAckResponse | None:
        with self._lock:
            event = self._events.get(event_id)

            if event is None:
                return None

            event.delivered_revision = max(event.delivered_revision, revision)
            self._persist()
            return ConversationEventAckResponse(
                event_id=event.event_id,
                revision=revision,
                status=event.status,
            )

    def _restore_state(self) -> None:
        if self._state_backend is None:
            return

        raw_events = self._state_backend.read_section("conversation_events", [])
        self._events = {
            event.event_id: event
            for event in (ConversationEvent.model_validate(item) for item in raw_events)
        }

    def _persist(self) -> None:
        if self._state_backend is None:
            return

        self._state_backend.write_section(
            "conversation_events",
            [event.model_dump(mode="json") for event in self._events.values()],
        )
