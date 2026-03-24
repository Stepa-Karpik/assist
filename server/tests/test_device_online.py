from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_device_online_acknowledges_device():
    response = client.post(
        "/api/devices/online",
        json={"device_id": "desktop-local", "status": "online"},
    )

    assert response.status_code == 200
    assert response.json()["device_id"] == "desktop-local"
    assert response.json()["status"] == "online"
    assert response.json()["acknowledged"] is True
    assert response.json()["is_online"] is True
    assert response.json()["last_seen_at"] is not None


def test_get_device_presence_returns_cached_status() -> None:
    client.post(
        "/api/devices/online",
        json={"device_id": "desktop-local", "status": "online"},
    )

    response = client.get("/api/devices/desktop-local")

    assert response.status_code == 200
    assert response.json()["device_id"] == "desktop-local"
    assert response.json()["is_online"] is True
    assert response.json()["last_seen_at"] is not None
