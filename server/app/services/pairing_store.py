from datetime import UTC, datetime
from threading import Event, Lock

from app.models.pairing import (
    PairAttemptEvent,
    PairAttemptResolutionRequest,
    PairingSession,
)
from app.services.state_backend import StateBackend


class InMemoryPairingStore:
    def __init__(self, state_backend: StateBackend | None = None) -> None:
        self._state_backend = state_backend
        self._lock = Lock()
        self._sessions: dict[str, PairingSession] = {}
        self._events: dict[str, PairAttemptEvent] = {}
        self._trusted_users: dict[str, set[int]] = {}
        self._waiters: dict[str, Event] = {}
        self._restore_state()

    def reset(self) -> None:
        with self._lock:
            self._sessions = {}
            self._events = {}
            self._trusted_users = {}
            self._waiters = {}
            self._persist()

    def open_session(self, session: PairingSession) -> PairingSession:
        with self._lock:
            self._sessions[session.device_id] = session
            self._persist()
            return session

    def get_active_session(self, device_id: str) -> PairingSession | None:
        with self._lock:
            session = self._sessions.get(device_id)

            if session is None:
                return None

            if session.status != "active" or session.expires_at <= datetime.now(UTC):
                if session.status == "active":
                    session.status = "expired"
                    self._persist()
                return None

            return session.model_copy()

    def close_session(self, device_id: str) -> PairingSession | None:
        with self._lock:
            session = self._sessions.get(device_id)

            if session is None:
                return None

            session.status = "cancelled"
            self._persist()
            return session

    def create_pair_attempt(self, event: PairAttemptEvent) -> PairAttemptEvent | None:
        with self._lock:
            session = self._resolve_session_for_attempt_unlocked(event.device_id, event.code)

            if session is None:
                if self._has_active_session_for_code_space_unlocked():
                    event.status = "resolved"
                    event.result = "invalid_code"
                    self._events[event.event_id] = event
                    self._persist()
                    return event.model_copy()
                return None

            session.attempt_count += 1
            trusted_users = self._trusted_users.setdefault(session.device_id, set())
            trusted_users.add(event.telegram_user_id)
            event.device_id = session.device_id
            event.status = "resolved"
            event.result = "paired"
            session.status = "consumed"
            self._events[event.event_id] = event
            self._persist()
            return event.model_copy()

    def list_pending_events(self, device_id: str) -> list[PairAttemptEvent]:
        with self._lock:
            return [
                event.model_copy()
                for event in self._events.values()
                if event.device_id == device_id and event.status == "pending"
            ]

    def resolve_event(
        self, event_id: str, payload: PairAttemptResolutionRequest
    ) -> PairAttemptEvent | None:
        with self._lock:
            event = self._events.get(event_id)

            if event is None:
                return None

            event.status = "resolved"
            event.result = payload.result

            if payload.result == "paired" and payload.trusted_telegram_user_id is not None:
                trusted_users = self._trusted_users.setdefault(event.device_id, set())
                trusted_users.add(payload.trusted_telegram_user_id)

                session = self._sessions.get(event.device_id)
                if session is not None:
                    session.status = "consumed"

            self._persist()

            waiter = self._waiters.get(event_id)
            if waiter is not None:
                waiter.set()

            return event.model_copy()

    def wait_for_resolution(self, event_id: str, wait_seconds: float) -> PairAttemptEvent | None:
        with self._lock:
            event = self._events.get(event_id)
            waiter = self._waiters.get(event_id)

            if event is None:
                return None

            if event.status == "resolved" or wait_seconds <= 0 or waiter is None:
                return event.model_copy()

        waiter.wait(timeout=wait_seconds)

        with self._lock:
            event = self._events.get(event_id)
            return event.model_copy() if event is not None else None

    def get_trusted_users(self, device_id: str) -> list[int]:
        with self._lock:
            return sorted(self._trusted_users.get(device_id, set()))

    def _resolve_session_for_attempt_unlocked(
        self, requested_device_id: str, code: str
    ) -> PairingSession | None:
        now = datetime.now(UTC)

        for session in self._sessions.values():
            if session.status == "active" and session.expires_at <= now:
                session.status = "expired"

        if requested_device_id:
            session = self._sessions.get(requested_device_id)

            if (
                session is not None
                and session.status == "active"
                and session.expires_at > now
                and session.code == code
            ):
                return session

        for session in self._sessions.values():
            if session.status == "active" and session.expires_at > now and session.code == code:
                return session

        return None

    def _has_active_session_for_code_space_unlocked(self) -> bool:
        now = datetime.now(UTC)
        return any(
            session.status == "active" and session.expires_at > now
            for session in self._sessions.values()
        )

    def _restore_state(self) -> None:
        if self._state_backend is None:
            return

        raw_users = self._state_backend.read_section("trusted_users", {})
        raw_sessions = self._state_backend.read_section("pairing_sessions", [])
        raw_events = self._state_backend.read_section("pairing_events", [])
        self._sessions = {
            session.device_id: session
            for session in (PairingSession.model_validate(item) for item in raw_sessions)
        }
        self._events = {
            event.event_id: event
            for event in (PairAttemptEvent.model_validate(item) for item in raw_events)
        }
        self._trusted_users = {
            device_id: {int(user_id) for user_id in user_ids}
            for device_id, user_ids in raw_users.items()
        }

    def _persist(self) -> None:
        if self._state_backend is None:
            return

        self._state_backend.write_section(
            "trusted_users",
            {
                device_id: sorted(user_ids)
                for device_id, user_ids in self._trusted_users.items()
            },
        )
        self._state_backend.write_section(
            "pairing_sessions",
            [session.model_dump(mode="json") for session in self._sessions.values()],
        )
        self._state_backend.write_section(
            "pairing_events",
            [event.model_dump(mode="json") for event in self._events.values()],
        )
