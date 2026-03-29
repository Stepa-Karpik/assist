from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def setup_function() -> None:
    app.state.device_registry.reset()


def test_trusted_devices_list_returns_active_device() -> None:
    registry = app.state.device_registry
    registry.register_device(device_id="desktop-main", device_label="Desktop Main")
    registry.register_device(device_id="laptop-main", device_label="Laptop Main")
    registry.grant_trust(device_id="desktop-main", telegram_user_id=101)
    registry.grant_trust(device_id="laptop-main", telegram_user_id=101)
    registry.set_active_device(telegram_user_id=101, device_id="laptop-main")

    response = client.get("/api/devices", params={"telegram_user_id": 101})

    assert response.status_code == 200
    assert response.json()["telegram_user_id"] == 101
    assert response.json()["active_device_id"] == "laptop-main"
    assert [item["device_id"] for item in response.json()["items"]] == [
        "desktop-main",
        "laptop-main",
    ]
    assert [item["is_active"] for item in response.json()["items"]] == [False, True]


def test_use_device_switches_active_binding_for_trusted_device() -> None:
    registry = app.state.device_registry
    registry.register_device(device_id="desktop-main", device_label="Desktop Main")
    registry.register_device(device_id="laptop-main", device_label="Laptop Main")
    registry.grant_trust(device_id="desktop-main", telegram_user_id=101)
    registry.grant_trust(device_id="laptop-main", telegram_user_id=101)

    response = client.post(
        "/api/devices/use",
        json={
            "telegram_user_id": 101,
            "device_id": "laptop-main",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "telegram_user_id": 101,
        "active_device_id": "laptop-main",
    }
    assert app.state.device_registry.get_active_device(101) == "laptop-main"
