import json

import app.delivery_client as delivery_client_module
from app.delivery import deliver_outbox_cycle, render_delivery_text
from app.delivery_client import DeliveryEvent, DeliveryServerClient


class FakeResponse:
    def __init__(self, payload: object) -> None:
        self._payload = payload

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None

    def read(self) -> bytes:
        return json.dumps(self._payload).encode("utf-8")


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

    assert text.startswith("Готово: task-1")
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

    assert text.startswith("Ошибка: task-2")
    assert "read docs/missing.txt" in text
    assert "File not found." in text


def test_delivery_cycle_sends_plain_messages_and_acks_them() -> None:
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
    assert client.ack_calls == ["evt-3"]
    assert sent_messages == [(5001, render_delivery_text(event))]


def test_delivery_cycle_prefers_photo_sender_for_image_artifacts() -> None:
    event = DeliveryEvent(
        event_id="evt-4",
        device_id="desktop-local",
        task_id="task-4",
        chat_id=5001,
        telegram_user_id=101,
        kind="task_done",
        intent="screenshot screen-1",
        result_text="Screenshot captured.",
        error_text=None,
        status="pending",
        created_at="2026-03-24T12:00:00Z",
        artifact_kind="image_base64",
        artifact_mime_type="image/png",
        artifact_file_name="screen-1.png",
        artifact_base64="ZmFrZQ==",
    )
    client = FakeDeliveryClient(events=[event])
    sent_messages: list[tuple[int, str]] = []
    sent_photos: list[tuple[int, str, DeliveryEvent]] = []

    def send_message(chat_id: int, text: str) -> None:
        sent_messages.append((chat_id, text))

    def send_photo(chat_id: int, text: str, delivery_event: DeliveryEvent) -> None:
        sent_photos.append((chat_id, text, delivery_event))

    deliver_outbox_cycle(client=client, send_message=send_message, send_photo=send_photo)

    assert sent_messages == []
    assert sent_photos == [(5001, render_delivery_text(event), event)]
    assert client.ack_calls == ["evt-4"]


def test_delivery_cycle_prefers_document_sender_for_file_artifacts() -> None:
    event = DeliveryEvent(
        event_id="evt-5",
        device_id="desktop-local",
        task_id="task-5",
        chat_id=5001,
        telegram_user_id=101,
        kind="task_done",
        intent="send-file desktop::hack.pptx",
        result_text="Файл найден.",
        error_text=None,
        status="pending",
        created_at="2026-03-24T12:00:00Z",
        artifact_kind="file_base64",
        artifact_mime_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        artifact_file_name="hack.pptx",
        artifact_base64="ZmFrZQ==",
    )
    client = FakeDeliveryClient(events=[event])
    sent_documents: list[tuple[int, str, DeliveryEvent]] = []

    def send_message(_chat_id: int, _text: str) -> None:
        raise AssertionError("plain sender should not be used for file artifacts")

    def send_document(chat_id: int, text: str, delivery_event: DeliveryEvent) -> None:
        sent_documents.append((chat_id, text, delivery_event))

    deliver_outbox_cycle(client=client, send_message=send_message, send_document=send_document)

    assert sent_documents == [(5001, render_delivery_text(event), event)]
    assert client.ack_calls == ["evt-5"]


def test_delivery_client_fetches_shared_outbox_without_device_query(monkeypatch) -> None:
    captured_urls: list[str] = []

    def fake_urlopen(request, timeout):
        del timeout
        captured_urls.append(request.full_url)
        return FakeResponse({"items": []})

    monkeypatch.setattr(delivery_client_module, "urlopen", fake_urlopen)
    client = DeliveryServerClient(server_url="http://127.0.0.1:8000")

    assert client.fetch_pending_events() == []
    assert captured_urls == ["http://127.0.0.1:8000/api/bot/outbox"]
