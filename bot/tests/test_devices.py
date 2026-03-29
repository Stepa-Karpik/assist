from app.handlers.devices import (
    format_devices_text,
    parse_use_command,
    resolve_devices_command,
    resolve_use_command,
)
from app.task_client import TrustedDeviceEntry, TrustedDeviceListResult


class FakeDeviceSelectionClient:
    def __init__(self, devices: TrustedDeviceListResult) -> None:
        self.devices = devices
        self.use_calls: list[dict[str, object]] = []

    def fetch_trusted_devices(self, telegram_user_id: int) -> TrustedDeviceListResult:
        assert telegram_user_id == self.devices.telegram_user_id
        return self.devices

    def use_device(
        self, telegram_user_id: int, device_id: str
    ) -> TrustedDeviceListResult | None:
        self.use_calls.append(
            {
                "telegram_user_id": telegram_user_id,
                "device_id": device_id,
            }
        )
        self.devices = TrustedDeviceListResult(
            telegram_user_id=telegram_user_id,
            active_device_id=device_id,
            items=tuple(
                TrustedDeviceEntry(
                    device_id=item.device_id,
                    device_label=item.device_label,
                    owner_label=item.owner_label,
                    status=item.status,
                    last_seen_at=item.last_seen_at,
                    is_active=item.device_id == device_id,
                )
                for item in self.devices.items
            ),
        )
        return self.devices


def build_devices_result() -> TrustedDeviceListResult:
    return TrustedDeviceListResult(
        telegram_user_id=42,
        active_device_id="desktop-main",
        items=(
            TrustedDeviceEntry(
                device_id="desktop-main",
                device_label="Домашний ПК",
                owner_label="Степан Карпов",
                status="online",
                last_seen_at="2026-03-29T12:00:00Z",
                is_active=True,
            ),
            TrustedDeviceEntry(
                device_id="laptop-main",
                device_label="Ноутбук",
                owner_label="Степан Карпов",
                status="offline",
                last_seen_at="2026-03-29T08:00:00Z",
                is_active=False,
            ),
        ),
    )


def test_parse_use_command_extracts_device_query() -> None:
    assert parse_use_command("/use laptop-main") == "laptop-main"


def test_format_devices_text_lists_active_and_available_devices() -> None:
    text = format_devices_text(build_devices_result())

    assert "Ваши устройства:" in text
    assert "Домашний ПК (desktop-main) · активно" in text
    assert "Ноутбук (laptop-main) · доступно" in text
    assert "Активное устройство: desktop-main" in text


def test_resolve_devices_command_returns_trusted_device_summary() -> None:
    client = FakeDeviceSelectionClient(build_devices_result())

    response = resolve_devices_command(telegram_user_id=42, task_client=client)

    assert "Ваши устройства:" in response
    assert "Домашний ПК" in response
    assert "Ноутбук" in response


def test_resolve_use_command_switches_active_device_by_device_id() -> None:
    client = FakeDeviceSelectionClient(build_devices_result())

    response = resolve_use_command(
        "/use laptop-main",
        telegram_user_id=42,
        task_client=client,
    )

    assert response == "Активное устройство переключено на Ноутбук."
    assert client.use_calls == [
        {
            "telegram_user_id": 42,
            "device_id": "laptop-main",
        }
    ]


def test_resolve_use_command_matches_by_human_label() -> None:
    client = FakeDeviceSelectionClient(build_devices_result())

    response = resolve_use_command(
        "/use ноутбук",
        telegram_user_id=42,
        task_client=client,
    )

    assert response == "Активное устройство переключено на Ноутбук."
