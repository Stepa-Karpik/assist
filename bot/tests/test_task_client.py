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

        if request.full_url.endswith("/api/devices?telegram_user_id=42"):
            return FakeResponse(
                {
                    "telegram_user_id": 42,
                    "active_device_id": "desktop-local",
                    "items": [
                        {
                            "device_id": "desktop-local",
                            "device_label": "Desktop Local",
                            "status": "online",
                            "is_active": True,
                        }
                    ],
                }
            )

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

    result = client.fetch_app_catalog(telegram_user_id=42)

    assert len(result) == 1
    assert result[0].app_id == "app-osu"
    assert result[0].display_name == "osu! lazer"
    assert result[0].aliases == ("osu", "осу", "osu lazer")
    assert result[0].linked is True


def test_consume_start_link_returns_server_payload(monkeypatch) -> None:
    def fake_urlopen(request, timeout):
        del timeout

        assert request.full_url.endswith("/api/bot/start-link")
        return FakeResponse(
            {
                "paired": True,
                "device_id": "desktop-main",
                "device_label": "Stepa Desktop",
            }
        )

    monkeypatch.setattr(task_client_module, "urlopen", fake_urlopen)
    client = TaskServerClient(
        server_url="http://127.0.0.1:8000",
        device_id="desktop-local",
    )

    result = client.consume_start_link("token-123", telegram_user_id=42)

    assert result.paired is True
    assert result.device_id == "desktop-main"
    assert result.device_label == "Stepa Desktop"
