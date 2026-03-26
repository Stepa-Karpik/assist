from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def setup_function() -> None:
    app.state.pairing_store.reset()
    app.state.task_store.reset()
    app.state.challenge_store.reset()
    app.state.device_presence_store.reset()


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


def test_low_risk_trusted_telegram_task_queues_immediately() -> None:
    trust_telegram_user()

    response = client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-local",
            "intent": "Send a short status reply",
            "source": "telegram",
            "risk": "low",
            "telegram_user_id": 101,
            "chat_id": 5001,
        },
    )

    assert response.status_code == 201
    assert response.json()["status"] == "queued"
    assert response.json()["device_online"] is False
    assert response.json()["task"]["status"] == "queued"
    assert response.json()["task"]["required_auth"] == "none"


def test_low_risk_trusted_telegram_task_reports_online_device_presence() -> None:
    trust_telegram_user()
    client.post(
        "/api/devices/online",
        json={"device_id": "desktop-local", "status": "online"},
    )

    response = client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-local",
            "intent": "Send a short status reply",
            "source": "telegram",
            "risk": "low",
            "telegram_user_id": 101,
            "chat_id": 5001,
        },
    )

    assert response.status_code == 201
    assert response.json()["status"] == "queued"
    assert response.json()["device_online"] is True


def test_medium_risk_trusted_telegram_task_requires_password_when_no_trust_window() -> None:
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
            "intent": "Export the latest log bundle",
            "source": "telegram",
            "risk": "medium",
            "telegram_user_id": 101,
            "chat_id": 5001,
        },
    )

    assert response.status_code == 201
    assert response.json()["status"] == "awaiting_auth"
    assert response.json()["challenge_step"] == "password"
    assert response.json()["task"]["status"] == "awaiting_auth"
    assert response.json()["task"]["required_auth"] == "password"


def test_successful_password_resolution_queues_task_and_opens_trust_window() -> None:
    trust_telegram_user()
    client.post(
        "/api/auth/config/status",
        json={
            "device_id": "desktop-local",
            "password_configured": True,
            "totp_configured": False,
        },
    )

    create_response = client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-local",
            "intent": "Export the latest log bundle",
            "source": "telegram",
            "risk": "medium",
            "telegram_user_id": 101,
            "chat_id": 5001,
        },
    )

    input_response = client.post(
        "/api/challenges/input",
        json={
            "device_id": "desktop-local",
            "telegram_user_id": 101,
            "chat_id": 5001,
            "value": "secret-password",
            "wait_seconds": 0,
        },
    )
    event_id = input_response.json()["event_id"]

    resolve_response = client.post(
        f"/api/auth/events/{event_id}/resolve",
        json={"accepted": True},
    )

    followup_response = client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-local",
            "intent": "Read the newest service note",
            "source": "telegram",
            "risk": "medium",
            "telegram_user_id": 101,
            "chat_id": 5001,
        },
    )

    assert create_response.json()["status"] == "awaiting_auth"
    assert input_response.status_code == 202
    assert resolve_response.status_code == 200
    assert resolve_response.json()["status"] == "task_queued"
    assert resolve_response.json()["task"]["status"] == "queued"
    assert followup_response.json()["status"] == "queued"


def test_high_risk_with_active_trust_window_still_requires_confirm() -> None:
    trust_telegram_user()
    client.post(
        "/api/auth/config/status",
        json={
            "device_id": "desktop-local",
            "password_configured": True,
            "totp_configured": True,
        },
    )

    create_medium_response = client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-local",
            "intent": "Export the latest log bundle",
            "source": "telegram",
            "risk": "medium",
            "telegram_user_id": 101,
            "chat_id": 5001,
        },
    )
    input_response = client.post(
        "/api/challenges/input",
        json={
            "device_id": "desktop-local",
            "telegram_user_id": 101,
            "chat_id": 5001,
            "value": "secret-password",
            "wait_seconds": 0,
        },
    )
    client.post(
        f"/api/auth/events/{input_response.json()['event_id']}/resolve",
        json={"accepted": True},
    )

    response = client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-local",
            "intent": "Run a protected system action",
            "source": "telegram",
            "risk": "high",
            "telegram_user_id": 101,
            "chat_id": 5001,
        },
    )

    assert create_medium_response.json()["status"] == "awaiting_auth"
    assert response.status_code == 201
    assert response.json()["status"] == "awaiting_auth"
    assert response.json()["challenge_step"] == "confirm"
    assert response.json()["task"]["required_auth"] == "password_and_totp"


def test_challenge_input_can_target_a_specific_challenge_in_the_same_chat() -> None:
    trust_telegram_user()
    client.post(
        "/api/auth/config/status",
        json={
            "device_id": "desktop-local",
            "password_configured": True,
            "totp_configured": False,
        },
    )

    first_create = client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-local",
            "intent": "Export the latest log bundle",
            "source": "telegram",
            "risk": "medium",
            "telegram_user_id": 101,
            "chat_id": 5001,
        },
    )
    second_create = client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-local",
            "intent": "Send file from desktop",
            "source": "telegram",
            "risk": "medium",
            "telegram_user_id": 101,
            "chat_id": 5001,
        },
    )

    second_challenge_id = second_create.json()["challenge_id"]
    second_task_id = second_create.json()["task"]["task_id"]
    first_task_id = first_create.json()["task"]["task_id"]

    input_response = client.post(
        "/api/challenges/input",
        json={
            "device_id": "desktop-local",
            "telegram_user_id": 101,
            "chat_id": 5001,
            "challenge_id": second_challenge_id,
            "value": "secret-password",
            "wait_seconds": 0,
        },
    )
    event_id = input_response.json()["event_id"]

    resolve_response = client.post(
        f"/api/auth/events/{event_id}/resolve",
        json={"accepted": True},
    )
    first_task = client.get(f"/api/tasks/{first_task_id}")

    assert input_response.status_code == 202
    assert input_response.json()["challenge_id"] == second_challenge_id
    assert resolve_response.status_code == 200
    assert resolve_response.json()["status"] == "task_queued"
    assert resolve_response.json()["task"]["task_id"] == second_task_id
    assert first_task.json()["status"] == "awaiting_auth"


def test_challenge_decision_can_target_a_specific_confirm_challenge() -> None:
    trust_telegram_user()
    client.post(
        "/api/auth/config/status",
        json={
            "device_id": "desktop-local",
            "password_configured": True,
            "totp_configured": True,
        },
    )

    medium_create = client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-local",
            "intent": "Export the latest log bundle",
            "source": "telegram",
            "risk": "medium",
            "telegram_user_id": 101,
            "chat_id": 5001,
        },
    )
    password_input = client.post(
        "/api/challenges/input",
        json={
            "device_id": "desktop-local",
            "telegram_user_id": 101,
            "chat_id": 5001,
            "value": "secret-password",
            "wait_seconds": 0,
        },
    )
    client.post(
        f"/api/auth/events/{password_input.json()['event_id']}/resolve",
        json={"accepted": True},
    )

    first_high = client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-local",
            "intent": "Run protected action one",
            "source": "telegram",
            "risk": "high",
            "telegram_user_id": 101,
            "chat_id": 5001,
        },
    )
    second_high = client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-local",
            "intent": "Run protected action two",
            "source": "telegram",
            "risk": "high",
            "telegram_user_id": 101,
            "chat_id": 5001,
        },
    )

    second_challenge_id = second_high.json()["challenge_id"]
    second_task_id = second_high.json()["task"]["task_id"]
    first_task_id = first_high.json()["task"]["task_id"]

    decision_response = client.post(
        "/api/challenges/decision",
        json={
            "device_id": "desktop-local",
            "telegram_user_id": 101,
            "chat_id": 5001,
            "challenge_id": second_challenge_id,
            "decision": "decline",
        },
    )
    first_task = client.get(f"/api/tasks/{first_task_id}")

    assert medium_create.json()["status"] == "awaiting_auth"
    assert decision_response.status_code == 200
    assert decision_response.json()["status"] == "declined"
    assert decision_response.json()["task"]["task_id"] == second_task_id
    assert first_task.json()["status"] == "awaiting_auth"


def test_repeated_failed_auth_attempts_lock_the_chat_for_three_minutes() -> None:
    trust_telegram_user()
    client.post(
        "/api/auth/config/status",
        json={
            "device_id": "desktop-local",
            "password_configured": True,
            "totp_configured": False,
        },
    )
    client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-local",
            "intent": "Open protected logs",
            "source": "telegram",
            "risk": "medium",
            "telegram_user_id": 101,
            "chat_id": 5001,
        },
    )

    last_resolve_response = None

    for index in range(3):
        input_response = client.post(
            "/api/challenges/input",
            json={
                "device_id": "desktop-local",
                "telegram_user_id": 101,
                "chat_id": 5001,
                "value": f"wrong-{index}",
                "wait_seconds": 0,
            },
        )
        last_resolve_response = client.post(
            f"/api/auth/events/{input_response.json()['event_id']}/resolve",
            json={"accepted": False},
        )

    followup_response = client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-local",
            "intent": "Open protected logs again",
            "source": "telegram",
            "risk": "medium",
            "telegram_user_id": 101,
            "chat_id": 5001,
        },
    )

    assert last_resolve_response is not None
    assert last_resolve_response.status_code == 200
    assert last_resolve_response.json()["status"] == "locked"
    assert last_resolve_response.json()["lock_expires_at"] is not None
    assert followup_response.json()["status"] == "locked"


def test_missing_desktop_auth_setup_returns_setup_required() -> None:
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
            "intent": "Export the latest log bundle",
            "source": "telegram",
            "risk": "medium",
            "telegram_user_id": 101,
            "chat_id": 5001,
        },
    )

    assert response.status_code == 201
    assert response.json()["status"] == "setup_required"
    assert response.json()["device_online"] is False
    assert response.json()["task"] is None
