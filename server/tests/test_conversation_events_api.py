from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def setup_function() -> None:
    app.state.conversation_event_store.reset()


def test_device_can_fetch_pending_conversation_events() -> None:
    create_response = client.post(
        "/api/conversation-events",
        json={
            "device_id": "stepa-desktop",
            "chat_id": 5001,
            "telegram_user_id": 9001,
            "prompt": "Сколько стран в мире?"
        },
    )

    list_response = client.get(
        "/api/conversation-events", params={"device_id": "stepa-desktop"}
    )

    assert create_response.status_code == 200
    assert list_response.status_code == 200
    assert len(list_response.json()["items"]) == 1
    assert list_response.json()["items"][0]["prompt"] == "Сколько стран в мире?"
    assert list_response.json()["items"][0]["status"] == "pending"
    assert list_response.json()["items"][0]["revision"] == 0


def test_bot_can_fetch_updated_conversation_event_and_ack_revision() -> None:
    create_response = client.post(
        "/api/conversation-events",
        json={
            "device_id": "stepa-desktop",
            "chat_id": 5002,
            "telegram_user_id": 9002,
            "prompt": "Объясни FastAPI"
        },
    )
    event_id = create_response.json()["event_id"]

    update_response = client.post(
        f"/api/conversation-events/{event_id}/update",
        json={
            "status": "completed",
            "response_text": "FastAPI — это ASGI-фреймворк.",
        },
    )

    outbox_response = client.get("/api/conversation-events/outbox")
    ack_response = client.post(
        f"/api/conversation-events/{event_id}/ack",
        json={"revision": 1},
    )
    outbox_after_ack = client.get("/api/conversation-events/outbox")

    assert update_response.status_code == 200
    assert update_response.json()["status"] == "completed"
    assert update_response.json()["revision"] == 1

    assert outbox_response.status_code == 200
    assert len(outbox_response.json()["items"]) == 1
    assert outbox_response.json()["items"][0]["event_id"] == event_id
    assert outbox_response.json()["items"][0]["response_text"] == "FastAPI — это ASGI-фреймворк."
    assert outbox_response.json()["items"][0]["revision"] == 1

    assert ack_response.status_code == 200
    assert ack_response.json() == {"event_id": event_id, "revision": 1, "status": "completed"}
    assert outbox_after_ack.status_code == 200
    assert outbox_after_ack.json()["items"] == []
