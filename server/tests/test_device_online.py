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
