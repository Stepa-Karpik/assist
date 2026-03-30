from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def setup_function() -> None:
    app.state.conversation_memory_store.reset()


def test_desktop_can_fetch_pending_conversation_memory_events() -> None:
    create_response = client.post(
        "/api/chat-memory/events",
        json={
            "device_id": "desktop-local",
            "origin": "telegram-chat",
            "prompt": "Что нового в FastAPI?",
            "answer": "FastAPI недавно обновил release notes.",
            "source_urls": ["https://fastapi.tiangolo.com/release-notes/"],
            "memory_writes": [
                {
                    "target": "assist/preferences",
                    "key": "preferred_stack",
                    "value": "Python, FastAPI",
                }
            ],
        },
    )

    list_response = client.get(
        "/api/chat-memory/events", params={"device_id": "desktop-local"}
    )

    assert create_response.status_code == 200
    assert list_response.status_code == 200
    assert len(list_response.json()["items"]) == 1
    assert list_response.json()["items"][0]["prompt"] == "Что нового в FastAPI?"
    assert list_response.json()["items"][0]["source_urls"] == [
        "https://fastapi.tiangolo.com/release-notes/"
    ]
    assert list_response.json()["items"][0]["memory_writes"][0]["value"] == "Python, FastAPI"


def test_acknowledged_conversation_memory_events_leave_pending_queue() -> None:
    create_response = client.post(
        "/api/chat-memory/events",
        json={
            "device_id": "desktop-local",
            "origin": "telegram-chat",
            "prompt": "Меня зовут Степан Карпов",
            "answer": "Принял.",
            "memory_writes": [
                {
                    "target": "assist/profile",
                    "key": "full_name",
                    "value": "Карпов Степан Викторович",
                }
            ],
        },
    )
    event_id = create_response.json()["event_id"]

    ack_response = client.post(f"/api/chat-memory/events/{event_id}/ack")
    after_response = client.get(
        "/api/chat-memory/events", params={"device_id": "desktop-local"}
    )

    assert ack_response.status_code == 200
    assert ack_response.json() == {"event_id": event_id, "status": "delivered"}
    assert after_response.status_code == 200
    assert after_response.json()["items"] == []
