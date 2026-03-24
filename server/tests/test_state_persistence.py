from datetime import UTC, datetime, timedelta
from pathlib import Path
from shutil import rmtree
from typing import Iterator
from uuid import uuid4

import pytest

from app.models.challenge import AuthConfigStatusRequest
from app.models.pairing import PairAttemptEvent, PairAttemptResolutionRequest, PairingSession
from app.models.task import TaskCreateRequest
from app.services.challenge_store import InMemoryChallengeStore
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
    first_store = InMemoryPairingStore(state_backend=backend)
    first_store.open_session(
        PairingSession(
            device_id="desktop-local",
            status="active",
            expires_at=datetime.now(UTC) + timedelta(minutes=5),
        )
    )
    event = PairAttemptEvent(
        device_id="desktop-local",
        telegram_user_id=101,
        chat_id=5001,
        code="ABC123",
    )
    created = first_store.create_pair_attempt(event)
    assert created is not None
    first_store.resolve_event(
        event.event_id,
        PairAttemptResolutionRequest(result="paired", trusted_telegram_user_id=101),
    )

    second_store = InMemoryPairingStore(state_backend=JsonStateBackend(state_file))

    assert second_store.get_trusted_users("desktop-local") == [101]


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
