from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def setup_function() -> None:
    app.state.pairing_store.reset()
    app.state.task_store.reset()
    app.state.challenge_store.reset()
    app.state.delivery_store.reset()


def trust_telegram_user(
    *, device_id: str = "desktop-local", telegram_user_id: int = 101, chat_id: int = 5001
) -> None:
    client.post(
        "/api/pairing/open",
        json={
            "device_id": device_id,
            "expires_at": "2030-03-24T01:45:00Z",
        },
    )
    event_response = client.post(
        "/api/bot/pair-attempt",
        json={
            "device_id": device_id,
            "telegram_user_id": telegram_user_id,
            "chat_id": chat_id,
            "code": "ABC123",
            "wait_seconds": 0,
        },
    )
    event_id = event_response.json()["event_id"]
    client.post(
        f"/api/events/{event_id}/resolve",
        json={
            "result": "paired",
            "trusted_telegram_user_id": telegram_user_id,
        },
    )


def test_status_and_read_keep_low_risk() -> None:
    trust_telegram_user()

    status_response = client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-local",
            "intent": "status",
            "source": "telegram",
            "risk": "low",
            "telegram_user_id": 101,
            "chat_id": 5001,
        },
    )
    read_response = client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-local",
            "intent": "read docs/note.txt",
            "source": "telegram",
            "risk": "low",
            "telegram_user_id": 101,
            "chat_id": 5001,
        },
    )

    assert status_response.status_code == 201
    assert status_response.json()["status"] == "queued"
    assert status_response.json()["task"]["risk"] == "low"

    assert read_response.status_code == 201
    assert read_response.json()["status"] == "queued"
    assert read_response.json()["task"]["risk"] == "low"


def test_write_note_escalates_low_to_medium_and_requires_password() -> None:
    trust_telegram_user()
    client.post(
        "/api/auth/config/status",
        json={
            "device_id": "desktop-local",
            "password_configured": True,
            "totp_configured": False,
        },
    )

    response = client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-local",
            "intent": "write-note daily.txt :: hello",
            "source": "telegram",
            "risk": "low",
            "telegram_user_id": 101,
            "chat_id": 5001,
        },
    )

    assert response.status_code == 201
    assert response.json()["status"] == "awaiting_auth"
    assert response.json()["task"]["risk"] == "medium"
    assert response.json()["task"]["required_auth"] == "password"
    assert response.json()["challenge_step"] == "password"


def test_unknown_intent_escalates_low_to_high_and_requires_confirm_flow() -> None:
    trust_telegram_user()
    client.post(
        "/api/auth/config/status",
        json={
            "device_id": "desktop-local",
            "password_configured": True,
            "totp_configured": True,
        },
    )

    response = client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-local",
            "intent": "run powershell Get-ChildItem",
            "source": "telegram",
            "risk": "low",
            "telegram_user_id": 101,
            "chat_id": 5001,
        },
    )

    assert response.status_code == 201
    assert response.json()["status"] == "awaiting_auth"
    assert response.json()["task"]["risk"] == "high"
    assert response.json()["task"]["required_auth"] == "password_and_totp"
    assert response.json()["challenge_step"] == "password"


def test_escalated_risk_still_requires_auth_setup() -> None:
    trust_telegram_user()
    client.post(
        "/api/auth/config/status",
        json={
            "device_id": "desktop-local",
            "password_configured": False,
            "totp_configured": False,
        },
    )

    response = client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-local",
            "intent": "write-note daily.txt :: hello",
            "source": "telegram",
            "risk": "low",
            "telegram_user_id": 101,
            "chat_id": 5001,
        },
    )

    assert response.status_code == 201
    assert response.json()["status"] == "setup_required"
