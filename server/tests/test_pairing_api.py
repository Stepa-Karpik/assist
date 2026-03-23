from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def setup_function() -> None:
    app.state.pairing_store.reset()


def test_open_pairing_session_marks_device_active() -> None:
    response = client.post(
        "/api/pairing/open",
        json={
            "device_id": "desktop-local",
            "expires_at": "2030-03-24T01:45:00Z",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "active"
    assert response.json()["device_id"] == "desktop-local"


def test_pair_attempt_creates_pending_event_for_active_device() -> None:
    client.post(
        "/api/pairing/open",
        json={
            "device_id": "desktop-local",
            "expires_at": "2030-03-24T01:45:00Z",
        },
    )

    response = client.post(
        "/api/bot/pair-attempt",
        json={
            "device_id": "desktop-local",
            "telegram_user_id": 101,
            "chat_id": 5001,
            "code": "ABC123",
            "wait_seconds": 0,
        },
    )

    assert response.status_code == 202
    assert response.json()["status"] == "pending"


def test_list_pending_events_returns_pair_attempt_for_device() -> None:
    client.post(
        "/api/pairing/open",
        json={
            "device_id": "desktop-local",
            "expires_at": "2030-03-24T01:45:00Z",
        },
    )
    client.post(
        "/api/bot/pair-attempt",
        json={
            "device_id": "desktop-local",
            "telegram_user_id": 101,
            "chat_id": 5001,
            "code": "ABC123",
            "wait_seconds": 0,
        },
    )

    response = client.get("/api/events", params={"device_id": "desktop-local"})

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["type"] == "pair_attempt"
    assert response.json()["items"][0]["code"] == "ABC123"


def test_resolve_event_stores_trusted_telegram_user() -> None:
    client.post(
        "/api/pairing/open",
        json={
            "device_id": "desktop-local",
            "expires_at": "2030-03-24T01:45:00Z",
        },
    )
    event_response = client.post(
        "/api/bot/pair-attempt",
        json={
            "device_id": "desktop-local",
            "telegram_user_id": 101,
            "chat_id": 5001,
            "code": "ABC123",
            "wait_seconds": 0,
        },
    )
    event_id = event_response.json()["event_id"]

    resolve_response = client.post(
        f"/api/events/{event_id}/resolve",
        json={
            "result": "paired",
            "trusted_telegram_user_id": 101,
        },
    )

    assert resolve_response.status_code == 200
    assert resolve_response.json()["result"] == "paired"
    assert resolve_response.json()["trusted_users"] == [101]
