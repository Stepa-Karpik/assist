from pathlib import Path
from shutil import rmtree
from typing import Iterator
from uuid import uuid4

import pytest

from app.services.device_registry import DeviceRegistry
from app.services.state_backend import JsonStateBackend


@pytest.fixture
def state_file() -> Iterator[Path]:
    root = Path(__file__).resolve().parents[1] / ".tmp" / "test-device-registry" / str(uuid4())
    root.mkdir(parents=True, exist_ok=True)
    yield root / "runtime-state.json"
    rmtree(root, ignore_errors=True)


def test_register_device_persists_record(state_file: Path) -> None:
    registry = DeviceRegistry(state_backend=JsonStateBackend(state_file))

    registered = registry.register_device(
        device_id="desktop-main",
        device_label="Desktop Main",
        owner_label="Stepa",
    )

    assert registered.device_id == "desktop-main"
    assert registered.device_label == "Desktop Main"
    assert registered.owner_label == "Stepa"
    assert registered.status == "offline"

    reloaded = DeviceRegistry(state_backend=JsonStateBackend(state_file))
    persisted = reloaded.get_device("desktop-main")

    assert persisted is not None
    assert persisted.device_label == "Desktop Main"
    assert persisted.owner_label == "Stepa"


def test_register_device_updates_existing_metadata_without_replacing_identity(state_file: Path) -> None:
    registry = DeviceRegistry(state_backend=JsonStateBackend(state_file))

    first = registry.register_device(
        device_id="desktop-main",
        device_label="Desktop Main",
        owner_label="Stepa",
    )
    second = registry.register_device(
        device_id="desktop-main",
        device_label="Stepa Desktop",
        owner_label="Степан Карпов",
    )

    assert second.device_id == first.device_id
    assert second.device_label == "Stepa Desktop"
    assert second.owner_label == "Степан Карпов"
    assert second.created_at == first.created_at
    assert second.updated_at >= first.updated_at


def test_grant_trust_is_persisted_per_device(state_file: Path) -> None:
    registry = DeviceRegistry(state_backend=JsonStateBackend(state_file))
    registry.register_device(device_id="desktop-main", device_label="Desktop Main")
    registry.register_device(device_id="laptop-main", device_label="Laptop Main")

    registry.grant_trust(device_id="desktop-main", telegram_user_id=101)
    registry.grant_trust(device_id="laptop-main", telegram_user_id=101)
    registry.grant_trust(device_id="desktop-main", telegram_user_id=202)

    assert registry.get_trusted_users("desktop-main") == [101, 202]
    assert [device.device_id for device in registry.get_trusted_devices(101)] == [
        "desktop-main",
        "laptop-main",
    ]

    reloaded = DeviceRegistry(state_backend=JsonStateBackend(state_file))
    assert reloaded.get_trusted_users("desktop-main") == [101, 202]
    assert [device.device_id for device in reloaded.get_trusted_devices(101)] == [
        "desktop-main",
        "laptop-main",
    ]


def test_active_device_binding_round_trips(state_file: Path) -> None:
    registry = DeviceRegistry(state_backend=JsonStateBackend(state_file))
    registry.register_device(device_id="desktop-main", device_label="Desktop Main")
    registry.register_device(device_id="laptop-main", device_label="Laptop Main")
    registry.grant_trust(device_id="desktop-main", telegram_user_id=101)
    registry.grant_trust(device_id="laptop-main", telegram_user_id=101)

    registry.set_active_device(telegram_user_id=101, device_id="laptop-main")

    assert registry.get_active_device(101) == "laptop-main"

    reloaded = DeviceRegistry(state_backend=JsonStateBackend(state_file))
    assert reloaded.get_active_device(101) == "laptop-main"


def test_resolve_active_device_falls_back_to_single_trusted_device(state_file: Path) -> None:
    registry = DeviceRegistry(state_backend=JsonStateBackend(state_file))
    registry.register_device(device_id="desktop-main", device_label="Desktop Main")
    registry.grant_trust(device_id="desktop-main", telegram_user_id=101)

    assert registry.resolve_active_device(101) == "desktop-main"

    reloaded = DeviceRegistry(state_backend=JsonStateBackend(state_file))
    assert reloaded.get_active_device(101) == "desktop-main"
