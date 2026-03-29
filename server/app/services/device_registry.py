from __future__ import annotations

from datetime import UTC, datetime
from threading import Lock

from pydantic import BaseModel

from app.services.state_backend import StateBackend


class DeviceRecord(BaseModel):
    device_id: str
    device_label: str
    owner_label: str | None = None
    status: str = "offline"
    last_seen_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class DeviceRegistry:
    def __init__(self, state_backend: StateBackend | None = None) -> None:
        self._state_backend = state_backend
        self._lock = Lock()
        self._devices: dict[str, DeviceRecord] = {}
        self._device_trust: dict[str, set[int]] = {}
        self._telegram_device_bindings: dict[int, str] = {}
        self._restore_state()

    def reset(self) -> None:
        with self._lock:
            self._devices = {}
            self._device_trust = {}
            self._telegram_device_bindings = {}
            self._persist()

    def register_device(
        self,
        *,
        device_id: str,
        device_label: str,
        owner_label: str | None = None,
        status: str = "offline",
        last_seen_at: datetime | None = None,
    ) -> DeviceRecord:
        now = datetime.now(UTC)

        with self._lock:
            existing = self._devices.get(device_id)
            created_at = existing.created_at if existing is not None else now
            record = DeviceRecord(
                device_id=device_id,
                device_label=device_label,
                owner_label=owner_label,
                status=status,
                last_seen_at=last_seen_at,
                created_at=created_at,
                updated_at=now,
            )
            self._devices[device_id] = record
            self._persist()
            return record.model_copy()

    def get_device(self, device_id: str) -> DeviceRecord | None:
        with self._lock:
            record = self._devices.get(device_id)
            return record.model_copy() if record is not None else None

    def grant_trust(
        self,
        *,
        device_id: str,
        telegram_user_id: int,
        set_active: bool = False,
    ) -> list[int]:
        with self._lock:
            trusted_users = self._device_trust.setdefault(device_id, set())
            trusted_users.add(telegram_user_id)

            if set_active or telegram_user_id not in self._telegram_device_bindings:
                self._telegram_device_bindings[telegram_user_id] = device_id

            self._persist()
            return sorted(trusted_users)

    def get_trusted_users(self, device_id: str) -> list[int]:
        with self._lock:
            return sorted(self._device_trust.get(device_id, set()))

    def get_trusted_devices(self, telegram_user_id: int) -> list[DeviceRecord]:
        with self._lock:
            trusted_device_ids = [
                device_id
                for device_id, user_ids in self._device_trust.items()
                if telegram_user_id in user_ids and device_id in self._devices
            ]
            return [
                self._devices[device_id].model_copy()
                for device_id in sorted(
                    trusted_device_ids,
                    key=lambda candidate: self._devices[candidate].device_label.lower(),
                )
            ]

    def set_active_device(self, *, telegram_user_id: int, device_id: str) -> str:
        with self._lock:
            self._telegram_device_bindings[telegram_user_id] = device_id
            self._persist()
            return device_id

    def get_active_device(self, telegram_user_id: int) -> str | None:
        with self._lock:
            return self._telegram_device_bindings.get(telegram_user_id)

    def _restore_state(self) -> None:
        if self._state_backend is None:
            return

        raw_devices = self._state_backend.read_section("devices", [])
        raw_trust = self._state_backend.read_section("device_trust", {})
        raw_bindings = self._state_backend.read_section("telegram_device_bindings", {})

        self._devices = {
            record.device_id: record
            for record in (DeviceRecord.model_validate(item) for item in raw_devices)
        }
        self._device_trust = {
            device_id: {int(user_id) for user_id in user_ids}
            for device_id, user_ids in raw_trust.items()
        }
        self._telegram_device_bindings = {
            int(telegram_user_id): device_id
            for telegram_user_id, device_id in raw_bindings.items()
            if isinstance(device_id, str) and device_id
        }

    def _persist(self) -> None:
        if self._state_backend is None:
            return

        self._state_backend.write_section(
            "devices",
            [record.model_dump(mode="json") for record in self._devices.values()],
        )
        self._state_backend.write_section(
            "device_trust",
            {
                device_id: sorted(user_ids)
                for device_id, user_ids in self._device_trust.items()
            },
        )
        self._state_backend.write_section(
            "telegram_device_bindings",
            {str(user_id): device_id for user_id, device_id in self._telegram_device_bindings.items()},
        )

