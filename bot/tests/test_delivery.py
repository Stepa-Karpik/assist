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

    text = render_delivery_text(event)

    assert "task-1" in text
    assert "status" in text
    assert "desktop-local is online" in text


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

    text = render_delivery_text(event)

    assert "task-2" in text
    assert "read docs/missing.txt" in text
    assert "File not found." in text


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
    assert sent_messages == [(5001, render_delivery_text(event))]
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


def test_delivery_cycle_sends_photo_for_image_artifacts() -> None:
    event = DeliveryEvent(
        event_id="evt-5",
        device_id="desktop-local",
        task_id="task-5",
        chat_id=5001,
        telegram_user_id=101,
        kind="task_done",
        intent="screenshot",
        result_text="Screenshot captured.",
        error_text=None,
        status="pending",
        created_at="2026-03-24T12:00:00Z",
        artifact_kind="image_base64",
        artifact_mime_type="image/png",
        artifact_file_name="screen.png",
        artifact_base64="c2NyZWVuc2hvdA==",
    )
    client = FakeDeliveryClient(events=[event])
    sent_photos: list[tuple[int, str, DeliveryEvent]] = []

    def send_message(_chat_id: int, _text: str) -> None:
        raise AssertionError("text sender should not be used for image artifacts")

    def send_photo(chat_id: int, caption: str, delivery_event: DeliveryEvent) -> None:
        sent_photos.append((chat_id, caption, delivery_event))

    deliver_outbox_cycle(client=client, send_message=send_message, send_photo=send_photo)

    assert sent_photos == [(5001, render_delivery_text(event), event)]
    assert client.ack_calls == ["evt-5"]
