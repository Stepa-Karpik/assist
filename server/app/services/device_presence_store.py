from __future__ import annotations

from datetime import UTC, datetime, timedelta
from threading import Lock
from typing import Callable

from app.models.device import DevicePresenceRecord
from app.services.state_backend import StateBackend


class InMemoryDevicePresenceStore:
    def __init__(
        self,
        *,
        state_backend: StateBackend | None = None,
        now: Callable[[], datetime] | None = None,
        offline_timeout: timedelta = timedelta(seconds=30),
    ) -> None:
        self._state_backend = state_backend
        self._now = now or (lambda: datetime.now(UTC))
        self._offline_timeout = offline_timeout
        self._lock = Lock()
        self._last_seen: dict[str, datetime] = {}
        self._restore_state()

    def mark_online(self, device_id: str) -> DevicePresenceRecord:
        with self._lock:
            self._last_seen[device_id] = self._now()
            self._persist()
            return self._build_record(device_id)

    def reset(self) -> None:
        with self._lock:
            self._last_seen = {}
            self._persist()

    def get_presence(self, device_id: str) -> DevicePresenceRecord | None:
        with self._lock:
            if device_id not in self._last_seen:
                return None

            return self._build_record(device_id)

    def _build_record(self, device_id: str) -> DevicePresenceRecord:
        last_seen_at = self._last_seen[device_id]
        is_online = self._now() - last_seen_at <= self._offline_timeout
        return DevicePresenceRecord(
            device_id=device_id,
            last_seen_at=last_seen_at,
            is_online=is_online,
        )

    def _restore_state(self) -> None:
        if self._state_backend is None:
            return

        raw_last_seen = self._state_backend.read_section("device_presence", {})
        self._last_seen = {
            device_id: datetime.fromisoformat(last_seen_at)
            for device_id, last_seen_at in raw_last_seen.items()
            if isinstance(last_seen_at, str)
        }

    def _persist(self) -> None:
        if self._state_backend is None:
            return

        self._state_backend.write_section(
            "device_presence",
            {
                device_id: last_seen_at.isoformat()
                for device_id, last_seen_at in self._last_seen.items()
            },
        )
