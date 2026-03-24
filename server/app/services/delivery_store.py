from threading import Lock

from app.models.delivery import DeliveryAckResponse, DeliveryEvent
from app.models.task import TaskRecord


class InMemoryDeliveryStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self.reset()

    def reset(self) -> None:
        with self._lock:
            self._events: dict[str, DeliveryEvent] = {}

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
            return DeliveryAckResponse(event_id=event.event_id, status=event.status)
