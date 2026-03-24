from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def setup_function() -> None:
    app.state.pairing_store.reset()
    app.state.task_store.reset()
    app.state.challenge_store.reset()


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


def create_low_risk_telegram_task(
    *, device_id: str = "desktop-local", telegram_user_id: int = 101, chat_id: int = 5001
) -> str:
    trust_telegram_user(
        device_id=device_id,
        telegram_user_id=telegram_user_id,
        chat_id=chat_id,
    )
    response = client.post(
        "/api/tasks",
        json={
            "device_id": device_id,
            "intent": "status",
            "source": "telegram",
            "risk": "low",
            "telegram_user_id": telegram_user_id,
            "chat_id": chat_id,
        },
    )
    return response.json()["task"]["task_id"]


def test_task_detail_exposes_execution_fields() -> None:
    task_id = create_low_risk_telegram_task()

    response = client.get(f"/api/tasks/{task_id}")

    assert response.status_code == 200
    assert response.json()["task_id"] == task_id
    assert response.json()["telegram_user_id"] == 101
    assert response.json()["chat_id"] == 5001
    assert response.json()["status"] == "queued"
    assert response.json()["result_text"] is None
    assert response.json()["error_text"] is None
    assert response.json()["started_at"] is None
    assert response.json()["finished_at"] is None
    assert response.json()["attempt_count"] == 0


def test_desktop_can_start_and_complete_task() -> None:
    task_id = create_low_risk_telegram_task()

    start_response = client.post(f"/api/tasks/{task_id}/start")
    complete_response = client.post(
        f"/api/tasks/{task_id}/complete",
        json={"result_text": "desktop-local is online"},
    )

    assert start_response.status_code == 200
    assert start_response.json()["status"] == "running"
    assert start_response.json()["started_at"] is not None
    assert start_response.json()["attempt_count"] == 1

    assert complete_response.status_code == 200
    assert complete_response.json()["status"] == "done"
    assert complete_response.json()["result_text"] == "desktop-local is online"
    assert complete_response.json()["error_text"] is None
    assert complete_response.json()["finished_at"] is not None


def test_desktop_can_fail_task_with_error_text() -> None:
    task_id = create_low_risk_telegram_task()

    client.post(f"/api/tasks/{task_id}/start")
    fail_response = client.post(
        f"/api/tasks/{task_id}/fail",
        json={"error_text": "unsupported task intent"},
    )

    assert fail_response.status_code == 200
    assert fail_response.json()["status"] == "failed"
    assert fail_response.json()["result_text"] is None
    assert fail_response.json()["error_text"] == "unsupported task intent"
    assert fail_response.json()["finished_at"] is not None


def test_task_history_returns_recent_items_and_chat_filtered_view() -> None:
    first_task_id = create_low_risk_telegram_task(chat_id=5001)
    second_task_id = create_low_risk_telegram_task(chat_id=6001)

    client.post(f"/api/tasks/{first_task_id}/start")
    client.post(
        f"/api/tasks/{first_task_id}/complete",
        json={"result_text": "desktop-local is online"},
    )

    history_response = client.get(
        "/api/tasks",
        params={"device_id": "desktop-local", "include_history": "true"},
    )
    chat_response = client.get(
        "/api/tasks",
        params={
            "device_id": "desktop-local",
            "include_history": "true",
            "chat_id": 5001,
        },
    )

    assert history_response.status_code == 200
    assert [item["task_id"] for item in history_response.json()["items"]] == [
        second_task_id,
        first_task_id,
    ]
    assert history_response.json()["items"][0]["status"] == "queued"
    assert history_response.json()["items"][1]["status"] == "done"

    assert chat_response.status_code == 200
    assert [item["task_id"] for item in chat_response.json()["items"]] == [first_task_id]
    assert chat_response.json()["items"][0]["result_text"] == "desktop-local is online"
