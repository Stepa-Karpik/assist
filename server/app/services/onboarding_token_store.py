from __future__ import annotations

from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe
from threading import Lock

from pydantic import BaseModel

from app.services.state_backend import StateBackend


class OnboardingTokenRecord(BaseModel):
    token: str
    device_id: str
    expires_at: datetime
    created_at: datetime
    consumed_at: datetime | None = None


class OnboardingTokenStore:
    def __init__(self, state_backend: StateBackend | None = None) -> None:
        self._state_backend = state_backend
        self._lock = Lock()
        self._tokens: dict[str, OnboardingTokenRecord] = {}
        self._restore_state()

    def reset(self) -> None:
        with self._lock:
            self._tokens = {}
            self._persist()

    def issue_token(
        self,
        *,
        device_id: str,
        expires_at: datetime | None = None,
    ) -> OnboardingTokenRecord:
        now = datetime.now(UTC)
        record = OnboardingTokenRecord(
            token=token_urlsafe(18),
            device_id=device_id,
            expires_at=expires_at or now + timedelta(minutes=5),
            created_at=now,
        )

        with self._lock:
            self._tokens[record.token] = record
            self._persist()
            return record.model_copy()

    def consume_token(self, token: str) -> OnboardingTokenRecord | None:
        with self._lock:
            record = self._tokens.get(token)

            if record is None:
                return None

            if record.consumed_at is not None:
                return None

            if record.expires_at <= datetime.now(UTC):
                return None

            record.consumed_at = datetime.now(UTC)
            self._persist()
            return record.model_copy()

    def _restore_state(self) -> None:
        if self._state_backend is None:
            return

        raw_tokens = self._state_backend.read_section("onboarding_tokens", [])
        self._tokens = {
            record.token: record
            for record in (OnboardingTokenRecord.model_validate(item) for item in raw_tokens)
        }

    def _persist(self) -> None:
        if self._state_backend is None:
            return

        self._state_backend.write_section(
            "onboarding_tokens",
            [record.model_dump(mode="json") for record in self._tokens.values()],
        )
