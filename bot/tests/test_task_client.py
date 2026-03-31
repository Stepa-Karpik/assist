import json

import app.task_client as task_client_module
from app.task_client import TaskServerClient


class FakeResponse:
    def __init__(self, payload: object) -> None:
        self._payload = payload

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None

    def read(self) -> bytes:
        return json.dumps(self._payload).encode("utf-8")


def test_fetch_app_catalog_returns_server_items(monkeypatch) -> None:
    def fake_urlopen(request, timeout):
        del timeout
        assert request.full_url.endswith("/api/apps?device_id=desktop-local")
        return FakeResponse(
            {
                "device_id": "desktop-local",
                "items": [
                    {
                        "app_id": "app-osu",
                        "display_name": "osu! lazer",
                        "aliases": ["osu", "осу", "osu lazer"],
                        "linked": True,
                        "source": "manual",
                    }
                ],
            }
        )

    monkeypatch.setattr(task_client_module, "urlopen", fake_urlopen)
    client = TaskServerClient(
        server_url="http://127.0.0.1:8000",
        device_id="desktop-local",
    )

    result = client.fetch_app_catalog()

    assert len(result) == 1
    assert result[0].app_id == "app-osu"
    assert result[0].display_name == "osu! lazer"
    assert result[0].aliases == ("osu", "осу", "osu lazer")
    assert result[0].linked is True


def test_create_conversation_event_posts_prompt(monkeypatch) -> None:
    def fake_urlopen(request, timeout):
        del timeout
        assert request.full_url.endswith("/api/conversation-events")
        payload = json.loads(request.data.decode("utf-8"))
        assert payload == {
            "device_id": "desktop-local",
            "chat_id": 5001,
            "telegram_user_id": 101,
            "prompt": "Сколько стран в мире?",
        }
        return FakeResponse(
            {
                "event_id": "conv-1",
                "device_id": "desktop-local",
                "chat_id": 5001,
                "telegram_user_id": 101,
                "prompt": "Сколько стран в мире?",
                "status": "pending",
                "revision": 0,
                "response_text": None,
                "error_text": None,
            }
        )

    monkeypatch.setattr(task_client_module, "urlopen", fake_urlopen)
    client = TaskServerClient(
        server_url="http://127.0.0.1:8000",
        device_id="desktop-local",
    )

    result = client.create_conversation_event(
        telegram_user_id=101,
        chat_id=5001,
        prompt="Сколько стран в мире?",
    )

    assert result is not None
    assert result.event_id == "conv-1"
    assert result.status == "pending"


def test_fetch_pending_conversation_events_returns_items(monkeypatch) -> None:
    def fake_urlopen(request, timeout):
        del timeout
        assert request.full_url.endswith("/api/conversation-events/outbox")
        return FakeResponse(
            {
                "items": [
                    {
                        "event_id": "conv-2",
                        "device_id": "desktop-local",
                        "chat_id": 5001,
                        "telegram_user_id": 101,
                        "prompt": "Привет",
                        "status": "running",
                        "revision": 2,
                        "response_text": "Ассистент отвечает...",
                        "error_text": None,
                    }
                ]
            }
        )

    monkeypatch.setattr(task_client_module, "urlopen", fake_urlopen)
    client = TaskServerClient(
        server_url="http://127.0.0.1:8000",
        device_id="desktop-local",
    )

    result = client.fetch_pending_conversation_events()

    assert len(result) == 1
    assert result[0].event_id == "conv-2"
    assert result[0].status == "running"
    assert result[0].response_text == "Ассистент отвечает..."


def test_ack_conversation_event_posts_revision(monkeypatch) -> None:
    calls: list[dict[str, object]] = []

    def fake_urlopen(request, timeout):
        del timeout
        calls.append(
            {
                "url": request.full_url,
                "payload": json.loads(request.data.decode("utf-8")),
            }
        )
        return FakeResponse(
            {"event_id": "conv-3", "revision": 3, "status": "completed"}
        )

    monkeypatch.setattr(task_client_module, "urlopen", fake_urlopen)
    client = TaskServerClient(
        server_url="http://127.0.0.1:8000",
        device_id="desktop-local",
    )

    client.ack_conversation_event("conv-3", 3)

    assert calls == [
        {
            "url": "http://127.0.0.1:8000/api/conversation-events/conv-3/ack",
            "payload": {"revision": 3},
        }
    ]
