from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def setup_function() -> None:
    app.state.pairing_store.reset()
    app.state.device_registry.reset()


def test_open_pairing_session_persists_code_on_server() -> None:
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


def test_pair_attempt_with_valid_code_pairs_user_without_desktop_resolution() -> None:
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
    assert app.state.device_registry.get_trusted_users("desktop-local") == [101]
    assert app.state.device_registry.get_active_device(101) == "desktop-local"


def test_pair_attempt_with_invalid_code_returns_invalid_code() -> None:
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
    assert app.state.device_registry.get_trusted_users("desktop-local") == []


def test_pairing_state_returns_server_trust_for_device() -> None:
    client.post(
        "/api/pairing/open",
        json={
            "device_id": "desktop-local",
            "code": "ABC123",
            "expires_at": "2030-03-24T01:45:00Z",
        },
    )
    client.post(
        "/api/bot/pair-attempt",
        json={
            "telegram_user_id": 101,
            "chat_id": 5001,
            "code": "ABC123",
            "wait_seconds": 0,
        },
    )

    response = client.get("/api/pairing/state", params={"device_id": "desktop-local"})

    assert response.status_code == 200
    assert response.json()["device_id"] == "desktop-local"
    assert response.json()["trusted_telegram_user_ids"] == [101]
    assert response.json()["status"] == "consumed"
