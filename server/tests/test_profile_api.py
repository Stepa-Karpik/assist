from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def setup_function() -> None:
    app.state.owner_profile_store.reset()


def test_desktop_can_sync_and_fetch_owner_profile() -> None:
    publish_response = client.post(
        "/api/profile",
        json={
            "device_id": "desktop-local",
            "profile": {
                "full_name": "Степан Карпов",
                "gender": "мужской",
                "age": 26,
                "city": "Москва",
                "timezone": "Europe/Moscow",
                "language": "ru",
                "contacts": "@stepa",
                "occupation": "software engineer",
                "bio": "Любит автоматизацию",
                "notes": "Предпочитает краткие ответы",
            },
        },
    )

    fetch_response = client.get("/api/profile", params={"device_id": "desktop-local"})

    assert publish_response.status_code == 200
    assert fetch_response.status_code == 200
    assert fetch_response.json()["device_id"] == "desktop-local"
    assert fetch_response.json()["profile"]["full_name"] == "Степан Карпов"
    assert fetch_response.json()["profile"]["city"] == "Москва"


def test_missing_owner_profile_returns_empty_shape() -> None:
    response = client.get("/api/profile", params={"device_id": "missing-device"})

    assert response.status_code == 200
    assert response.json() == {
        "device_id": "missing-device",
        "profile": {
            "full_name": None,
            "gender": None,
            "age": None,
            "city": None,
            "timezone": None,
            "language": None,
            "contacts": None,
            "occupation": None,
            "bio": None,
            "notes": None,
        },
    }
