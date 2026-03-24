from app.delivery import deliver_outbox_cycle, render_delivery_text
from app.delivery_client import DeliveryEvent


class FakeDeliveryClient:
    def __init__(self, *, events: list[DeliveryEvent] | None = None) -> None:
        self.events = events or []
        self.fetch_calls = 0
        self.ack_calls: list[str] = []

    def fetch_pending_events(self) -> list[DeliveryEvent]:
        self.fetch_calls += 1
        return list(self.events)

    def ack_event(self, event_id: str) -> None:
        self.ack_calls.append(event_id)


def test_render_delivery_text_for_done_task() -> None:
    event = DeliveryEvent(
        event_id="evt-1",
        device_id="desktop-local",
        task_id="task-1",
        chat_id=5001,
        telegram_user_id=101,
        kind="task_done",
        intent="status",
        result_text="desktop-local is online",
        error_text=None,
        status="pending",
        created_at="2026-03-24T12:00:00Z",
    )

    assert render_delivery_text(event) == "Готово: task-1\nstatus\n\ndesktop-local is online"


def test_render_delivery_text_for_failed_task() -> None:
    event = DeliveryEvent(
        event_id="evt-2",
        device_id="desktop-local",
        task_id="task-2",
        chat_id=5001,
        telegram_user_id=101,
        kind="task_failed",
        intent="read docs/missing.txt",
        result_text=None,
        error_text="File not found.",
        status="pending",
        created_at="2026-03-24T12:00:00Z",
    )

    assert (
        render_delivery_text(event)
        == "Ошибка: task-2\nread docs/missing.txt\n\nFile not found."
    )


def test_delivery_cycle_sends_and_acks_pending_events() -> None:
    event = DeliveryEvent(
        event_id="evt-3",
        device_id="desktop-local",
        task_id="task-3",
        chat_id=5001,
        telegram_user_id=101,
        kind="task_done",
        intent="status",
        result_text="desktop-local is online",
        error_text=None,
        status="pending",
        created_at="2026-03-24T12:00:00Z",
    )
    client = FakeDeliveryClient(events=[event])
    sent_messages: list[tuple[int, str]] = []

    def sender(chat_id: int, text: str) -> None:
        sent_messages.append((chat_id, text))

    deliver_outbox_cycle(client=client, send_message=sender)

    assert client.fetch_calls == 1
    assert sent_messages == [
        (5001, "Готово: task-3\nstatus\n\ndesktop-local is online")
    ]
    assert client.ack_calls == ["evt-3"]


def test_delivery_cycle_skips_ack_when_send_fails() -> None:
    event = DeliveryEvent(
        event_id="evt-4",
        device_id="desktop-local",
        task_id="task-4",
        chat_id=5001,
        telegram_user_id=101,
        kind="task_failed",
        intent="read docs/missing.txt",
        result_text=None,
        error_text="File not found.",
        status="pending",
        created_at="2026-03-24T12:00:00Z",
    )
    client = FakeDeliveryClient(events=[event])

    def sender(_chat_id: int, _text: str) -> None:
        raise RuntimeError("Telegram unavailable")

    deliver_outbox_cycle(client=client, send_message=sender)

    assert client.fetch_calls == 1
    assert client.ack_calls == []
