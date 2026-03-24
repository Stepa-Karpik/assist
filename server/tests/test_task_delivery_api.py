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


def create_telegram_task() -> str:
    trust_telegram_user()
    response = client.post(
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
    return response.json()["task"]["task_id"]


def create_desktop_task() -> str:
    response = client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-local",
            "intent": "status",
            "source": "desktop",
            "risk": "low",
        },
    )
    return response.json()["task"]["task_id"]


def test_completing_telegram_task_creates_done_delivery_event() -> None:
    task_id = create_telegram_task()

    client.post(f"/api/tasks/{task_id}/start")
    client.post(
        f"/api/tasks/{task_id}/complete",
        json={"result_text": "desktop-local is online"},
    )

    response = client.get("/api/bot/outbox", params={"device_id": "desktop-local"})

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["task_id"] == task_id
    assert response.json()["items"][0]["kind"] == "task_done"
    assert response.json()["items"][0]["result_text"] == "desktop-local is online"


def test_failing_telegram_task_creates_failed_delivery_event() -> None:
    task_id = create_telegram_task()

    client.post(f"/api/tasks/{task_id}/start")
    client.post(
        f"/api/tasks/{task_id}/fail",
        json={"error_text": "Unsupported task intent."},
    )

    response = client.get("/api/bot/outbox", params={"device_id": "desktop-local"})

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["task_id"] == task_id
    assert response.json()["items"][0]["kind"] == "task_failed"
    assert response.json()["items"][0]["error_text"] == "Unsupported task intent."


def test_blocked_telegram_task_creates_failed_delivery_event() -> None:
    task_id = create_telegram_task()

    client.post(f"/api/tasks/{task_id}/start")
    client.post(
        f"/api/tasks/{task_id}/awaiting-local-approval",
        json={"result_text": "Waiting for local review. Files: README.md"},
    )
    client.post(
        f"/api/tasks/{task_id}/block",
        json={"error_text": "Rejected locally."},
    )

    response = client.get("/api/bot/outbox", params={"device_id": "desktop-local"})

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["task_id"] == task_id
    assert response.json()["items"][0]["kind"] == "task_failed"
    assert response.json()["items"][0]["error_text"] == "Rejected locally."


def test_desktop_origin_task_does_not_create_delivery_event() -> None:
    task_id = create_desktop_task()

    client.post(f"/api/tasks/{task_id}/start")
    client.post(
        f"/api/tasks/{task_id}/complete",
        json={"result_text": "desktop-local is online"},
    )

    response = client.get("/api/bot/outbox", params={"device_id": "desktop-local"})

    assert response.status_code == 200
    assert response.json()["items"] == []


def test_acknowledging_delivery_event_removes_it_from_pending_list() -> None:
    task_id = create_telegram_task()

    client.post(f"/api/tasks/{task_id}/start")
    client.post(
        f"/api/tasks/{task_id}/complete",
        json={"result_text": "desktop-local is online"},
    )
    outbox_response = client.get("/api/bot/outbox", params={"device_id": "desktop-local"})
    event_id = outbox_response.json()["items"][0]["event_id"]

    ack_response = client.post(f"/api/bot/outbox/{event_id}/ack")
    after_response = client.get("/api/bot/outbox", params={"device_id": "desktop-local"})

    assert ack_response.status_code == 200
    assert ack_response.json()["status"] == "delivered"
    assert ack_response.json()["event_id"] == event_id
    assert after_response.json()["items"] == []


def test_completing_task_with_image_artifact_keeps_delivery_payload() -> None:
    task_id = create_telegram_task()

    client.post(f"/api/tasks/{task_id}/start")
    client.post(
        f"/api/tasks/{task_id}/complete",
        json={
            "result_text": "Screenshot captured.",
            "artifact": {
                "kind": "image_base64",
                "mime_type": "image/png",
                "file_name": "screen.png",
                "content_base64": "c2NyZWVuc2hvdA==",
            },
        },
    )

    response = client.get("/api/bot/outbox", params={"device_id": "desktop-local"})

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["artifact_kind"] == "image_base64"
    assert response.json()["items"][0]["artifact_mime_type"] == "image/png"
    assert response.json()["items"][0]["artifact_file_name"] == "screen.png"
    assert response.json()["items"][0]["artifact_base64"] == "c2NyZWVuc2hvdA=="
