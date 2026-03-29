from datetime import UTC, datetime, timedelta
from pathlib import Path
from shutil import rmtree
from typing import Iterator
from uuid import uuid4

import pytest

from app.services.onboarding_token_store import OnboardingTokenStore
from app.services.state_backend import JsonStateBackend


@pytest.fixture
def state_file() -> Iterator[Path]:
    root = Path(__file__).resolve().parents[1] / ".tmp" / "test-onboarding-token-store" / str(uuid4())
    root.mkdir(parents=True, exist_ok=True)
    yield root / "runtime-state.json"
    rmtree(root, ignore_errors=True)


def test_issue_token_persists_and_consumes_once(state_file: Path) -> None:
    store = OnboardingTokenStore(state_backend=JsonStateBackend(state_file))

    issued = store.issue_token(device_id="desktop-main")
    consumed = store.consume_token(issued.token)

    assert issued.device_id == "desktop-main"
    assert issued.consumed_at is None
    assert consumed is not None
    assert consumed.device_id == "desktop-main"
    assert consumed.consumed_at is not None
    assert store.consume_token(issued.token) is None


def test_expired_token_cannot_be_consumed(state_file: Path) -> None:
    store = OnboardingTokenStore(state_backend=JsonStateBackend(state_file))
    issued = store.issue_token(
        device_id="desktop-main",
        expires_at=datetime.now(UTC) - timedelta(minutes=1),
    )

    assert store.consume_token(issued.token) is None
