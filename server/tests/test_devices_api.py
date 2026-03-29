from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def setup_function() -> None:
    app.state.device_registry.reset()
    app.state.challenge_store.reset()
    app.state.owner_profile_store.reset()


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


def test_register_device_creates_or_updates_server_owned_device_record() -> None:
    response = client.post(
        "/api/devices/register",
        json={
            "device_id": "desktop-main",
            "device_label": "Stepa Desktop",
            "owner_label": "Степан Карпов",
        },
    )

    assert response.status_code == 200
    assert response.json()["device_id"] == "desktop-main"
    assert response.json()["device_label"] == "Stepa Desktop"
    assert response.json()["owner_label"] == "Степан Карпов"


def test_device_onboarding_status_combines_trust_profile_and_auth_state() -> None:
    app.state.device_registry.register_device(
        device_id="desktop-main",
        device_label="Stepa Desktop",
        owner_label="Степан Карпов",
    )
    app.state.device_registry.grant_trust(device_id="desktop-main", telegram_user_id=101)
    client.post(
        "/api/profile",
        json={
            "device_id": "desktop-main",
            "profile": {
                "full_name": "Степан Карпов",
                "gender": "мужской",
                "age": 26,
            },
        },
    )
    client.post(
        "/api/auth/config/status",
        json={
            "device_id": "desktop-main",
            "password_configured": True,
            "totp_configured": True,
        },
    )

    response = client.get("/api/devices/desktop-main/onboarding")

    assert response.status_code == 200
    assert response.json() == {
        "device_id": "desktop-main",
        "device_registered": True,
        "trusted_telegram_user_count": 1,
        "owner_profile_complete": True,
        "password_configured": True,
        "totp_configured": True,
        "completed": True,
    }


def test_onboarding_token_endpoint_returns_deep_link() -> None:
    app.state.device_registry.register_device(
        device_id="desktop-main",
        device_label="Stepa Desktop",
    )

    response = client.post("/api/devices/desktop-main/onboarding-token")

    assert response.status_code == 200
    assert response.json()["device_id"] == "desktop-main"
    assert response.json()["token"]
    assert response.json()["start_link"].startswith("https://t.me/Karpik?start=pair_")


def test_start_link_consumes_token_and_grants_trust_once() -> None:
    app.state.device_registry.register_device(
        device_id="desktop-main",
        device_label="Stepa Desktop",
    )
    token_response = client.post("/api/devices/desktop-main/onboarding-token")
    token = token_response.json()["token"]

    first_response = client.post(
        "/api/bot/start-link",
        json={
            "token": token,
            "telegram_user_id": 101,
        },
    )
    second_response = client.post(
        "/api/bot/start-link",
        json={
            "token": token,
            "telegram_user_id": 101,
        },
    )

    assert first_response.status_code == 200
    assert first_response.json() == {
        "device_id": "desktop-main",
        "device_label": "Stepa Desktop",
        "paired": True,
    }
    assert app.state.device_registry.get_trusted_users("desktop-main") == [101]
    assert second_response.status_code == 200
    assert second_response.json() == {
        "device_id": None,
        "device_label": None,
        "paired": False,
    }
