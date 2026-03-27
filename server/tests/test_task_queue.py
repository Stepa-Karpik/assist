from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_create_task_returns_queued_status():
    response = client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-local",
            "intent": "Send the latest screenshot to Telegram",
            "source": "telegram",
        },
    )

    assert response.status_code == 201
    assert response.json()["status"] == "queued"
    assert response.json()["task"]["status"] == "queued"


def test_list_tasks_returns_queued_tasks_for_device():
    client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-queue-test",
            "intent": "Capture all displays",
            "source": "telegram",
        },
    )
    client.post(
        "/api/tasks",
        json={
            "device_id": "desktop-other",
            "intent": "Open the latest desktop chat",
            "source": "telegram",
        },
    )

    response = client.get("/api/tasks", params={"device_id": "desktop-queue-test"})

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["device_id"] == "desktop-queue-test"
    assert response.json()["items"][0]["status"] == "queued"
