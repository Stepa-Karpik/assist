from __future__ import annotations

from datetime import UTC, datetime, timedelta
from threading import Event, Lock

from app.models.challenge import (
    AuthConfigStatus,
    AuthConfigStatusRequest,
    AuthInputEvent,
    AuthEventResolutionRequest,
    ChallengeRecord,
    ChallengeStep,
    InputResolutionStatus,
)
from app.models.task import TaskRecord, TaskRisk
from app.services.task_store import InMemoryTaskStore

failure_limit = 3
challenge_ttl = timedelta(minutes=5)
lockout_ttl = timedelta(minutes=3)
trust_window_ttl = timedelta(minutes=5)


def risk_rank(risk: TaskRisk) -> int:
    return {"low": 0, "medium": 1, "high": 2}[risk]


class InMemoryChallengeStore:
    def __init__(self, now: callable | None = None) -> None:
        self._now = now or (lambda: datetime.now(UTC))
        self._lock = Lock()
        self.reset()

    def reset(self) -> None:
        with self._lock:
            self._auth_configs: dict[str, AuthConfigStatus] = {}
            self._challenges: dict[str, ChallengeRecord] = {}
            self._auth_events: dict[str, AuthInputEvent] = {}
            self._waiters: dict[str, Event] = {}
            self._trust_windows: dict[tuple[str, int, int], tuple[datetime, TaskRisk]] = {}
            self._lockouts: dict[tuple[str, int, int], datetime] = {}

    def set_auth_config(self, payload: AuthConfigStatusRequest) -> AuthConfigStatus:
        with self._lock:
            status = AuthConfigStatus(
                device_id=payload.device_id,
                password_configured=payload.password_configured,
                totp_configured=payload.totp_configured,
            )
            self._auth_configs[payload.device_id] = status
            return status

    def get_auth_config(self, device_id: str) -> AuthConfigStatus:
        with self._lock:
            return self._auth_configs.get(
                device_id,
                AuthConfigStatus(
                    device_id=device_id, password_configured=False, totp_configured=False
                ),
            )

    def get_lock_expires_at(
        self, device_id: str, telegram_user_id: int, chat_id: int
    ) -> datetime | None:
        with self._lock:
            lock_key = (device_id, telegram_user_id, chat_id)
            lock_expires_at = self._lockouts.get(lock_key)

            if lock_expires_at is None:
                return None

            if lock_expires_at <= self._now():
                self._lockouts.pop(lock_key, None)
                return None

            return lock_expires_at

    def has_trust_window(
        self, device_id: str, telegram_user_id: int, chat_id: int, risk: TaskRisk
    ) -> bool:
        with self._lock:
            trust_key = (device_id, telegram_user_id, chat_id)
            trust_window = self._trust_windows.get(trust_key)

            if trust_window is None:
                return False

            expires_at, granted_risk = trust_window

            if expires_at <= self._now():
                self._trust_windows.pop(trust_key, None)
                return False

            if risk == "high":
                return True

            return risk_rank(granted_risk) >= risk_rank(risk)

    def create_challenge(
        self,
        task: TaskRecord,
        *,
        step: ChallengeStep,
    ) -> ChallengeRecord:
        with self._lock:
            challenge = ChallengeRecord(
                task_id=task.task_id,
                device_id=task.device_id,
                telegram_user_id=task.telegram_user_id or 0,
                chat_id=task.chat_id or 0,
                risk=task.risk,
                step=step,
                expires_at=self._now() + challenge_ttl,
                summary=task.intent,
            )
            self._challenges[challenge.challenge_id] = challenge
            task.challenge_id = challenge.challenge_id
            return challenge

    def get_active_challenge(
        self, device_id: str, telegram_user_id: int, chat_id: int
    ) -> ChallengeRecord | None:
        with self._lock:
            return self._get_active_challenge_unlocked(device_id, telegram_user_id, chat_id)

    def list_pending_events(self, device_id: str) -> list[AuthInputEvent]:
        with self._lock:
            return [
                event.model_copy()
                for event in self._auth_events.values()
                if event.device_id == device_id and event.status == "pending"
            ]

    def create_auth_event(
        self, device_id: str, telegram_user_id: int, chat_id: int, value: str
    ) -> AuthInputEvent | None:
        with self._lock:
            challenge = self._get_active_challenge_unlocked(device_id, telegram_user_id, chat_id)

            if challenge is None or challenge.step not in {"password", "totp"}:
                return None

            event = AuthInputEvent(
                device_id=device_id,
                challenge_id=challenge.challenge_id,
                telegram_user_id=telegram_user_id,
                chat_id=chat_id,
                step=challenge.step,
                value=value,
            )
            self._auth_events[event.event_id] = event
            self._waiters[event.event_id] = Event()
            return event

    def resolve_auth_event(
        self,
        event_id: str,
        payload: AuthEventResolutionRequest,
        task_store: InMemoryTaskStore,
    ) -> AuthInputEvent | None:
        with self._lock:
            event = self._auth_events.get(event_id)

            if event is None:
                return None

            challenge = self._challenges.get(event.challenge_id)

            if challenge is None:
                event.status = "resolved"
                event.accepted = payload.accepted
                event.response_status = "ignored"
                return event.model_copy()

            event.status = "resolved"
            event.accepted = payload.accepted

            if payload.accepted:
                task = task_store.get_task(challenge.task_id)

                if event.step == "password" and challenge.risk == "medium":
                    challenge.status = "passed"
                    challenge.trust_window_expires_at = self._now() + trust_window_ttl
                    self._trust_windows[
                        (challenge.device_id, challenge.telegram_user_id, challenge.chat_id)
                    ] = (challenge.trust_window_expires_at, "medium")

                    if task is not None:
                        task.status = "queued"
                    event.task = task.model_copy() if task is not None else None
                    event.response_status = "task_queued"
                elif event.step == "password":
                    challenge.step = "totp"
                    event.next_step = "totp"
                    event.response_status = "totp_required"
                elif event.step == "totp":
                    challenge.step = "confirm"
                    challenge.trust_window_expires_at = self._now() + trust_window_ttl
                    self._trust_windows[
                        (challenge.device_id, challenge.telegram_user_id, challenge.chat_id)
                    ] = (challenge.trust_window_expires_at, "high")
                    event.next_step = "confirm"
                    event.response_status = "confirm_required"
                else:
                    event.response_status = "ignored"
            else:
                challenge.failure_count += 1

                if challenge.failure_count >= failure_limit:
                    challenge.status = "locked"
                    lock_expires_at = self._now() + lockout_ttl
                    self._lockouts[
                        (challenge.device_id, challenge.telegram_user_id, challenge.chat_id)
                    ] = lock_expires_at
                    event.lock_expires_at = lock_expires_at
                    event.response_status = "locked"
                elif event.step == "password":
                    event.response_status = "invalid_password"
                else:
                    event.response_status = "invalid_totp"

            waiter = self._waiters.get(event_id)
            if waiter is not None:
                waiter.set()

            return event.model_copy()

    def wait_for_event_resolution(
        self, event_id: str, wait_seconds: float
    ) -> AuthInputEvent | None:
        with self._lock:
            event = self._auth_events.get(event_id)
            waiter = self._waiters.get(event_id)

            if event is None:
                return None

            if event.status == "resolved" or wait_seconds <= 0 or waiter is None:
                return event.model_copy()

        waiter.wait(timeout=wait_seconds)

        with self._lock:
            event = self._auth_events.get(event_id)
            return event.model_copy() if event is not None else None

    def handle_decision(
        self,
        device_id: str,
        telegram_user_id: int,
        chat_id: int,
        decision: str,
        task_store: InMemoryTaskStore,
    ) -> tuple[str, TaskRecord | None]:
        with self._lock:
            challenge = self._get_active_challenge_unlocked(device_id, telegram_user_id, chat_id)

            if challenge is None or challenge.step != "confirm":
                return "ignored", None

            task = task_store.get_task(challenge.task_id)

            if decision == "decline":
                challenge.status = "cancelled"
                if task is not None:
                    task.status = "blocked"
                return "declined", task.model_copy() if task is not None else None

            challenge.status = "passed"
            if task is not None:
                task.status = "queued"
            return "task_queued", task.model_copy() if task is not None else None

    def _get_active_challenge_unlocked(
        self, device_id: str, telegram_user_id: int, chat_id: int
    ) -> ChallengeRecord | None:
        now = self._now()

        for challenge in self._challenges.values():
            if (
                challenge.device_id == device_id
                and challenge.telegram_user_id == telegram_user_id
                and challenge.chat_id == chat_id
                and challenge.status == "pending"
            ):
                if challenge.expires_at <= now:
                    challenge.status = "expired"
                    continue

                return challenge

        return None
