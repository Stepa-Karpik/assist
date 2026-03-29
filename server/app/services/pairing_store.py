from __future__ import annotations

from datetime import UTC, datetime
from threading import Lock

from pydantic import ValidationError

from app.models.pairing import PairAttemptResult, PairingSession, PairingStateResponse
from app.services.device_registry import DeviceRegistry
from app.services.state_backend import StateBackend


class InMemoryPairingStore:
    def __init__(
        self,
        state_backend: StateBackend | None = None,
        *,
        device_registry: DeviceRegistry | None = None,
    ) -> None:
        self._state_backend = state_backend
        self._device_registry = device_registry
        self._lock = Lock()
        self._sessions: dict[str, PairingSession] = {}
        self._restore_state()

    def reset(self) -> None:
        with self._lock:
            self._sessions = {}
            self._persist()

    def open_session(self, session: PairingSession) -> PairingSession:
        with self._lock:
            self._sessions[session.device_id] = session

            if self._device_registry is not None and self._device_registry.get_device(session.device_id) is None:
                self._device_registry.register_device(
                    device_id=session.device_id,
                    device_label=session.device_id,
                )

            self._persist()
            return session.model_copy()

    def close_session(self, device_id: str) -> PairingStateResponse:
        with self._lock:
            session = self._sessions.get(device_id)

            if session is not None:
                session.status = "cancelled"
                self._persist()

            return self._build_state(device_id)

    def submit_pair_attempt(
        self,
        *,
        code: str,
        telegram_user_id: int,
        device_id: str | None = None,
    ) -> PairAttemptResult:
        with self._lock:
            session = self._find_session_for_code(code, device_id)

            if session is None:
                return "invalid_code"

            session.attempt_count += 1
            session.status = "consumed"
            self._persist()

        if self._device_registry is not None:
            self._device_registry.grant_trust(
                device_id=session.device_id,
                telegram_user_id=telegram_user_id,
                set_active=True,
            )

        return "paired"

    def get_trusted_users(self, device_id: str) -> list[int]:
        if self._device_registry is None:
            return []

        return self._device_registry.get_trusted_users(device_id)

    def get_state(self, device_id: str) -> PairingStateResponse:
        with self._lock:
            return self._build_state(device_id)

    def _find_session_for_code(self, code: str, device_id: str | None) -> PairingSession | None:
        sessions = [self._sessions[device_id]] if device_id is not None and device_id in self._sessions else list(
            self._sessions.values()
        )

        for session in sessions:
            valid_session = self._get_valid_session(session.device_id)
            if valid_session is None:
                continue

            if valid_session.code == code:
                return valid_session

        return None

    def _get_valid_session(self, device_id: str) -> PairingSession | None:
        session = self._sessions.get(device_id)

        if session is None:
            return None

        if session.status != "active":
            return session

        if session.expires_at <= datetime.now(UTC):
            session.status = "expired"
            self._persist()

        return session

    def _build_state(self, device_id: str) -> PairingStateResponse:
        session = self._get_valid_session(device_id)

        if session is None:
            return PairingStateResponse(
                device_id=device_id,
                code=None,
                status="inactive",
                expires_at=None,
                trusted_telegram_user_ids=self.get_trusted_users(device_id),
            )

        return PairingStateResponse(
            device_id=device_id,
            code=session.code if session.status == "active" else None,
            status=session.status,
            expires_at=session.expires_at if session.status == "active" else None,
            trusted_telegram_user_ids=self.get_trusted_users(device_id),
        )

    def _restore_state(self) -> None:
        if self._state_backend is None:
            return

        raw_sessions = self._state_backend.read_section("pairing_sessions", [])
        sessions: dict[str, PairingSession] = {}

        for item in raw_sessions:
            try:
                session = PairingSession.model_validate(item)
            except ValidationError:
                # Legacy pairing state did not persist a pairing code. Those
                # sessions cannot participate in the server-owned pairing flow,
                # so they are safely discarded during migration.
                continue

            sessions[session.device_id] = session

        self._sessions = sessions

    def _persist(self) -> None:
        if self._state_backend is None:
            return

        self._state_backend.write_section(
            "pairing_sessions",
            [session.model_dump(mode="json") for session in self._sessions.values()],
        )
