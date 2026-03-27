from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def setup_function() -> None:
    app.state.app_catalog_store.reset()


def test_desktop_can_publish_and_bot_can_read_app_catalog() -> None:
    publish_response = client.post(
        "/api/apps/catalog",
        json={
            "device_id": "desktop-local",
            "items": [
                {
                    "app_id": "app-osu",
                    "display_name": "osu! lazer",
                    "aliases": ["osu", "осу", "osu lazer", "осу лазер"],
                    "linked": True,
                    "source": "manual",
                },
                {
                    "app_id": "app-discord",
                    "display_name": "Discord",
                    "aliases": ["discord", "дискорд"],
                    "linked": False,
                    "source": "start_menu",
                },
            ],
        },
    )

    list_response = client.get("/api/apps", params={"device_id": "desktop-local"})

    assert publish_response.status_code == 200
    assert publish_response.json()["device_id"] == "desktop-local"
    assert [item["app_id"] for item in publish_response.json()["items"]] == [
        "app-osu",
        "app-discord",
    ]

    assert list_response.status_code == 200
    assert list_response.json()["device_id"] == "desktop-local"
    assert [item["display_name"] for item in list_response.json()["items"]] == [
        "osu! lazer",
        "Discord",
    ]


def test_missing_catalog_returns_empty_list() -> None:
    response = client.get("/api/apps", params={"device_id": "missing-device"})

    assert response.status_code == 200
    assert response.json() == {"device_id": "missing-device", "items": []}
