from threading import Lock

from app.models.delivery import DeliveryAckResponse, DeliveryEvent
from app.models.task import TaskRecord
from app.services.state_backend import JsonStateBackend


class InMemoryDeliveryStore:
    def __init__(self, state_backend: JsonStateBackend | None = None) -> None:
        self._state_backend = state_backend
        self._lock = Lock()
        self._events: dict[str, DeliveryEvent] = {}
        self._restore_state()

    def reset(self) -> None:
        with self._lock:
            self._events = {}
            self._persist()

    def create_for_task(self, task: TaskRecord) -> DeliveryEvent | None:
        if (
            task.source != "telegram"
            or task.chat_id is None
            or task.telegram_user_id is None
            or task.status not in {"done", "failed"}
        ):
            return None

        event = DeliveryEvent(
            device_id=task.device_id,
            task_id=task.task_id,
            chat_id=task.chat_id,
            telegram_user_id=task.telegram_user_id,
            kind="task_done" if task.status == "done" else "task_failed",
            intent=task.intent,
            result_text=task.result_text,
            error_text=task.error_text,
        )

        with self._lock:
            self._events[event.event_id] = event
            self._persist()

        return event

    def list_pending(self, device_id: str) -> list[DeliveryEvent]:
        with self._lock:
            return [
                event.model_copy()
                for event in self._events.values()
                if event.device_id == device_id and event.status == "pending"
            ]

    def ack(self, event_id: str) -> DeliveryAckResponse | None:
        with self._lock:
            event = self._events.get(event_id)

            if event is None:
                return None

            event.status = "delivered"
            self._persist()
            return DeliveryAckResponse(event_id=event.event_id, status=event.status)

    def _restore_state(self) -> None:
        if self._state_backend is None:
            return

        raw_events = self._state_backend.read_section("delivery_outbox", [])
        self._events = {
            event.event_id: event
            for event in (DeliveryEvent.model_validate(item) for item in raw_events)
        }

    def _persist(self) -> None:
        if self._state_backend is None:
            return

        self._state_backend.write_section(
            "delivery_outbox",
            [event.model_dump(mode="json") for event in self._events.values()],
        )
