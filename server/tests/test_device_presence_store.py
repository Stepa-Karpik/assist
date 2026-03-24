from datetime import UTC, datetime, timedelta

from app.services.device_presence_store import InMemoryDevicePresenceStore


def test_device_presence_store_marks_device_online() -> None:
    now = datetime(2026, 3, 24, 14, 0, tzinfo=UTC)
    store = InMemoryDevicePresenceStore(now=lambda: now)

    presence = store.mark_online("desktop-local")

    assert presence.device_id == "desktop-local"
    assert presence.last_seen_at == now
    assert presence.is_online is True


def test_device_presence_store_reports_device_offline_after_timeout() -> None:
    current_time = datetime(2026, 3, 24, 14, 0, tzinfo=UTC)
    store = InMemoryDevicePresenceStore(
        now=lambda: current_time,
        offline_timeout=timedelta(seconds=30),
    )

    store.mark_online("desktop-local")
    current_time = current_time + timedelta(seconds=31)
    presence = store.get_presence("desktop-local")

    assert presence is not None
    assert presence.is_online is False
