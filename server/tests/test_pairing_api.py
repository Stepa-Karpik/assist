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
            "code": "ABC123",
            "expires_at": "2030-03-24T01:45:00Z",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "active"
    assert response.json()["device_id"] == "desktop-local"
    assert response.json()["code"] == "ABC123"


def test_get_pairing_state_returns_server_owned_session_and_trusted_users() -> None:
    client.post(
        "/api/pairing/open",
        json={
            "device_id": "desktop-local",
            "code": "ABC123",
            "expires_at": "2030-03-24T01:45:00Z",
        },
    )

    response = client.get("/api/pairing/state", params={"device_id": "desktop-local"})

    assert response.status_code == 200
    assert response.json() == {
        "device_id": "desktop-local",
        "trusted_telegram_user_ids": [],
        "session": {
            "device_id": "desktop-local",
            "code": "ABC123",
            "status": "active",
            "expires_at": "2030-03-24T01:45:00Z",
            "attempt_count": 0,
        },
    }


def test_pair_attempt_pairs_immediately_when_code_matches_active_session() -> None:
    client.post(
        "/api/pairing/open",
        json={
            "device_id": "desktop-local",
            "code": "ABC123",
            "expires_at": "2030-03-24T01:45:00Z",
        },
    )

    response = client.post(
        "/api/bot/pair-attempt",
        json={
            "telegram_user_id": 101,
            "chat_id": 5001,
            "code": "ABC123",
            "wait_seconds": 0,
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "paired"


def test_pair_attempt_returns_invalid_code_for_wrong_active_code() -> None:
    client.post(
        "/api/pairing/open",
        json={
            "device_id": "desktop-local",
            "code": "ABC123",
            "expires_at": "2030-03-24T01:45:00Z",
        },
    )

    response = client.post(
        "/api/bot/pair-attempt",
        json={
            "telegram_user_id": 101,
            "chat_id": 5001,
            "code": "WRONG",
            "wait_seconds": 0,
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "invalid_code"


def test_resolve_event_stores_trusted_telegram_user() -> None:
    client.post(
        "/api/pairing/open",
        json={
            "device_id": "desktop-local",
            "code": "ABC123",
            "expires_at": "2030-03-24T01:45:00Z",
        },
    )
    event_response = client.post(
        "/api/bot/pair-attempt",
        json={
            "telegram_user_id": 101,
            "chat_id": 5001,
            "code": "ABC123",
            "wait_seconds": 0,
        },
    )
    assert event_response.status_code == 200
    assert event_response.json()["status"] == "paired"

    state_response = client.get("/api/pairing/state", params={"device_id": "desktop-local"})

    assert state_response.status_code == 200
    assert state_response.json()["trusted_telegram_user_ids"] == [101]
