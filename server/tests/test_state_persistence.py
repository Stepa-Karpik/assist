from datetime import UTC, datetime, timedelta
from pathlib import Path
from shutil import rmtree
from typing import Iterator
from uuid import uuid4

import pytest

from app.models.challenge import AuthConfigStatusRequest
from app.models.pairing import PairingSession
from app.models.task import TaskCreateRequest
from app.services.challenge_store import InMemoryChallengeStore
from app.services.device_registry import DeviceRegistry
from app.services.delivery_store import InMemoryDeliveryStore
from app.services.pairing_store import InMemoryPairingStore
from app.services.task_store import InMemoryTaskStore
from app.services.state_backend import JsonStateBackend


@pytest.fixture
def state_file() -> Iterator[Path]:
    root = Path(__file__).resolve().parents[1] / ".tmp" / "test-state-persistence" / str(uuid4())
    root.mkdir(parents=True, exist_ok=True)
    yield root / "runtime-state.json"
    rmtree(root, ignore_errors=True)


def test_task_store_reloads_task_history(state_file: Path) -> None:
    backend = JsonStateBackend(state_file)
    first_store = InMemoryTaskStore(state_backend=backend)
    task = first_store.create_task(
        TaskCreateRequest(device_id="desktop-local", intent="status", source="telegram")
    )
    first_store.start_task(task.task_id)
    first_store.complete_task(task.task_id, "desktop-local is online")

    second_store = InMemoryTaskStore(state_backend=JsonStateBackend(state_file))
    reloaded = second_store.get_task(task.task_id)

    assert reloaded is not None
    assert reloaded.status == "done"
    assert reloaded.result_text == "desktop-local is online"


def test_pairing_store_reloads_trusted_users(state_file: Path) -> None:
    backend = JsonStateBackend(state_file)
    first_registry = DeviceRegistry(state_backend=backend)
    first_store = InMemoryPairingStore(state_backend=backend, device_registry=first_registry)
    first_store.open_session(
        PairingSession(
            device_id="desktop-local",
            code="ABC123",
            status="active",
            expires_at=datetime.now(UTC) + timedelta(minutes=5),
        )
    )
    assert first_store.submit_pair_attempt(code="ABC123", telegram_user_id=101) == "paired"

    second_registry = DeviceRegistry(state_backend=JsonStateBackend(state_file))
    second_store = InMemoryPairingStore(
        state_backend=JsonStateBackend(state_file),
        device_registry=second_registry,
    )

    assert second_store.get_trusted_users("desktop-local") == [101]


def test_pairing_store_reloads_active_session(state_file: Path) -> None:
    backend = JsonStateBackend(state_file)
    first_registry = DeviceRegistry(state_backend=backend)
    first_store = InMemoryPairingStore(state_backend=backend, device_registry=first_registry)
    first_store.open_session(
        PairingSession(
            device_id="desktop-local",
            code="ABC123",
            status="active",
            expires_at=datetime.now(UTC) + timedelta(minutes=5),
        )
    )

    second_registry = DeviceRegistry(state_backend=JsonStateBackend(state_file))
    second_store = InMemoryPairingStore(
        state_backend=JsonStateBackend(state_file),
        device_registry=second_registry,
    )
    state = second_store.get_state("desktop-local")

    assert state.status == "active"
    assert state.code == "ABC123"


def test_challenge_store_reloads_auth_config(state_file: Path) -> None:
    backend = JsonStateBackend(state_file)
    first_store = InMemoryChallengeStore(state_backend=backend)
    first_store.set_auth_config(
        AuthConfigStatusRequest(
            device_id="desktop-local",
            password_configured=True,
            totp_configured=False,
        )
    )

    second_store = InMemoryChallengeStore(state_backend=JsonStateBackend(state_file))
    reloaded = second_store.get_auth_config("desktop-local")

    assert reloaded.password_configured is True
    assert reloaded.totp_configured is False


def test_challenge_store_reloads_active_challenges_and_pending_events(
    state_file: Path,
) -> None:
    backend = JsonStateBackend(state_file)
    task_store = InMemoryTaskStore(state_backend=backend)
    first_store = InMemoryChallengeStore(state_backend=backend)
    task = task_store.create_task(
        TaskCreateRequest(
            device_id="desktop-local",
            intent="codex summarize repo",
            source="telegram",
            risk="high",
            telegram_user_id=101,
            chat_id=5001,
        )
    )

    challenge = first_store.create_challenge(task, step="password")
    event = first_store.create_auth_event("desktop-local", 101, 5001, "secret-password")

    assert event is not None

    second_store = InMemoryChallengeStore(state_backend=JsonStateBackend(state_file))
    reloaded_challenge = second_store.get_active_challenge("desktop-local", 101, 5001)
    pending_events = second_store.list_pending_events("desktop-local")

    assert reloaded_challenge is not None
    assert reloaded_challenge.challenge_id == challenge.challenge_id
    assert len(pending_events) == 1
    assert pending_events[0].event_id == event.event_id


def test_delivery_store_reloads_pending_events(state_file: Path) -> None:
    backend = JsonStateBackend(state_file)
    task_store = InMemoryTaskStore(state_backend=backend)
    delivery_store = InMemoryDeliveryStore(state_backend=backend)
    task = task_store.create_task(
        TaskCreateRequest(
            device_id="desktop-local",
            intent="status",
            source="telegram",
            telegram_user_id=101,
            chat_id=5001,
        )
    )
    task_store.start_task(task.task_id)
    completed = task_store.complete_task(task.task_id, "desktop-local is online")
    assert completed is not None
    delivery_store.create_for_task(completed)

    second_store = InMemoryDeliveryStore(state_backend=JsonStateBackend(state_file))
    events = second_store.list_pending("desktop-local")

    assert len(events) == 1
    assert events[0].task_id == task.task_id
    assert events[0].kind == "task_done"


def test_state_backend_retries_atomic_replace_after_transient_permission_error(
    state_file: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    backend = JsonStateBackend(state_file)
    original_replace = Path.replace
    call_count = {"value": 0}

    def flaky_replace(self: Path, target: Path) -> Path:
        call_count["value"] += 1

        if call_count["value"] == 1:
            raise PermissionError("busy")

        return original_replace(self, target)

    monkeypatch.setattr(Path, "replace", flaky_replace)

    backend.write_section("tasks", [{"task_id": "task-1"}])

    assert call_count["value"] == 2
    assert backend.read_section("tasks", []) == [{"task_id": "task-1"}]
