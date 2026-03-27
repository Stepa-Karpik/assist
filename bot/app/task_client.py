from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

TaskWorkflowStatus = Literal[
    "queued",
    "awaiting_auth",
    "setup_required",
    "locked",
    "ignored",
    "pending",
    "task_queued",
    "totp_required",
    "confirm_required",
    "invalid_password",
    "invalid_totp",
    "declined",
]
TaskLifecycleStatus = Literal[
    "queued",
    "awaiting_auth",
    "awaiting_local_approval",
    "cancel_requested",
    "cancelled",
    "blocked",
    "running",
    "done",
    "failed",
    "stalled",
]

ACTIVE_TASK_STATUSES: tuple[TaskLifecycleStatus, ...] = (
    "queued",
    "awaiting_auth",
    "awaiting_local_approval",
    "cancel_requested",
    "running",
    "stalled",
)
ATTENTION_TASK_STATUSES: tuple[TaskLifecycleStatus, ...] = (
    "awaiting_auth",
    "awaiting_local_approval",
    "cancel_requested",
    "stalled",
)


@dataclass(frozen=True, slots=True)
class AppCatalogEntry:
    app_id: str
    display_name: str
    aliases: tuple[str, ...]
    linked: bool
    source: str


@dataclass(frozen=True, slots=True)
class TaskWorkflowResult:
    status: TaskWorkflowStatus
    challenge_id: str | None = None
    challenge_step: str | None = None
    message: str | None = None
    task_id: str | None = None
    device_online: bool | None = None


@dataclass(frozen=True, slots=True)
class TaskStatusResult:
    found: bool
    task_id: str | None = None
    status: TaskLifecycleStatus | None = None
    result_text: str | None = None
    error_text: str | None = None


@dataclass(frozen=True, slots=True)
class TaskSummaryResult:
    task_id: str
    status: TaskLifecycleStatus
    intent: str
    result_text: str | None = None
    error_text: str | None = None


@dataclass(frozen=True, slots=True)
class DeviceStatusResult:
    found: bool
    device_id: str | None = None
    is_online: bool | None = None
    last_seen_at: str | None = None
    pending_count: int = 0
    attention_count: int = 0


def build_owner_profile_context(parsed: object) -> str | None:
    if not isinstance(parsed, dict):
        return None

    profile = parsed.get("profile")
    if not isinstance(profile, dict):
        return None

    entries: list[tuple[str, object]] = [
        ("Владелец", profile.get("full_name")),
        ("Пол", profile.get("gender")),
        ("Возраст", profile.get("age")),
        ("Город", profile.get("city")),
        ("Часовой пояс", profile.get("timezone")),
        ("Язык", profile.get("language")),
        ("Контакты", profile.get("contacts")),
        ("Род деятельности", profile.get("occupation")),
        ("Биография", profile.get("bio")),
        ("Заметки", profile.get("notes")),
    ]

    lines: list[str] = []
    for label, value in entries:
        if isinstance(value, str):
            normalized = value.strip()
            if normalized:
                lines.append(f"{label}: {normalized}")
            continue

        if isinstance(value, int):
            lines.append(f"{label}: {value}")

    return "\n".join(lines) if lines else None


def normalize_workflow_result(value: object) -> TaskWorkflowStatus:
    if value in {
        "queued",
        "awaiting_auth",
        "setup_required",
        "locked",
        "ignored",
        "pending",
        "task_queued",
        "totp_required",
        "confirm_required",
        "invalid_password",
        "invalid_totp",
        "declined",
    }:
        return value

    return "ignored"


def normalize_task_status(value: object) -> TaskLifecycleStatus | None:
    if value in {
        "queued",
        "awaiting_auth",
        "awaiting_local_approval",
        "cancel_requested",
        "cancelled",
        "blocked",
        "running",
        "done",
        "failed",
        "stalled",
    }:
        return value

    return None


def extract_task_id(parsed: dict[str, object]) -> str | None:
    task = parsed.get("task")

    if isinstance(task, dict):
        task_id = task.get("task_id")
        if isinstance(task_id, str):
            return task_id

    task_id = parsed.get("task_id")
    return task_id if isinstance(task_id, str) else None


def parse_workflow_result(parsed: object) -> TaskWorkflowResult:
    if not isinstance(parsed, dict):
        return TaskWorkflowResult(status="ignored")

    return TaskWorkflowResult(
        status=normalize_workflow_result(parsed.get("status")),
        challenge_id=parsed.get("challenge_id")
        if isinstance(parsed.get("challenge_id"), str)
        else None,
        challenge_step=parsed.get("challenge_step")
        if isinstance(parsed.get("challenge_step"), str)
        else None,
        message=parsed.get("message") if isinstance(parsed.get("message"), str) else None,
        task_id=extract_task_id(parsed),
        device_online=parsed.get("device_online")
        if isinstance(parsed.get("device_online"), bool)
        else None,
    )


def parse_task_status_item(value: object) -> TaskStatusResult:
    if not isinstance(value, dict):
        return TaskStatusResult(found=False)

    task_id = value.get("task_id")
    status = normalize_task_status(value.get("status"))

    if not isinstance(task_id, str) or status is None:
        return TaskStatusResult(found=False)

    result_text = value.get("result_text")
    error_text = value.get("error_text")

    return TaskStatusResult(
        found=True,
        task_id=task_id,
        status=status,
        result_text=result_text if isinstance(result_text, str) else None,
        error_text=error_text if isinstance(error_text, str) else None,
    )


def parse_task_summary_item(value: object) -> TaskSummaryResult | None:
    if not isinstance(value, dict):
        return None

    task_id = value.get("task_id")
    status = normalize_task_status(value.get("status"))
    intent = value.get("intent")

    if not isinstance(task_id, str) or status is None or not isinstance(intent, str):
        return None

    return TaskSummaryResult(
        task_id=task_id,
        status=status,
        intent=intent,
        result_text=value.get("result_text") if isinstance(value.get("result_text"), str) else None,
        error_text=value.get("error_text") if isinstance(value.get("error_text"), str) else None,
    )


def parse_app_catalog_item(value: object) -> AppCatalogEntry | None:
    if not isinstance(value, dict):
        return None

    app_id = value.get("app_id")
    display_name = value.get("display_name")
    aliases = value.get("aliases")
    linked = value.get("linked")
    source = value.get("source")

    if (
        not isinstance(app_id, str)
        or not isinstance(display_name, str)
        or not isinstance(aliases, list)
        or not isinstance(linked, bool)
        or not isinstance(source, str)
    ):
        return None

    return AppCatalogEntry(
        app_id=app_id,
        display_name=display_name,
        aliases=tuple(alias for alias in aliases if isinstance(alias, str)),
        linked=linked,
        source=source,
    )


@dataclass(frozen=True, slots=True)
class TaskServerClient:
    server_url: str
    device_id: str
    wait_seconds: float = 5.0

    def create_task(
        self, telegram_user_id: int, chat_id: int, risk: str, intent: str
    ) -> TaskWorkflowResult:
        payload = {
            "device_id": self.device_id,
            "intent": intent,
            "source": "telegram",
            "risk": risk,
            "telegram_user_id": telegram_user_id,
            "chat_id": chat_id,
        }
        return self._post("/api/tasks", payload)

    def submit_auth_input(
        self,
        telegram_user_id: int,
        chat_id: int,
        value: str,
        challenge_id: str | None = None,
    ) -> TaskWorkflowResult:
        payload: dict[str, object] = {
            "device_id": self.device_id,
            "telegram_user_id": telegram_user_id,
            "chat_id": chat_id,
            "value": value,
            "wait_seconds": self.wait_seconds,
        }

        if challenge_id is not None:
            payload["challenge_id"] = challenge_id

        return self._post("/api/challenges/input", payload)

    def submit_decision(
        self,
        telegram_user_id: int,
        chat_id: int,
        decision: str,
        challenge_id: str | None = None,
    ) -> TaskWorkflowResult:
        payload: dict[str, object] = {
            "device_id": self.device_id,
            "telegram_user_id": telegram_user_id,
            "chat_id": chat_id,
            "decision": decision,
        }

        if challenge_id is not None:
            payload["challenge_id"] = challenge_id

        return self._post("/api/challenges/decision", payload)

    def fetch_task(self, task_id: str) -> TaskStatusResult:
        return parse_task_status_item(self._get_json(f"/api/tasks/{task_id}"))

    def fetch_latest_task(self, chat_id: int) -> TaskStatusResult:
        items = self._fetch_task_history(chat_id=chat_id)

        if len(items) == 0:
            return TaskStatusResult(found=False)

        return TaskStatusResult(
            found=True,
            task_id=items[0].task_id,
            status=items[0].status,
            result_text=items[0].result_text,
            error_text=items[0].error_text,
        )

    def fetch_active_queue(self) -> list[TaskSummaryResult]:
        return [
            item
            for item in self._fetch_task_history()
            if item.status in ACTIVE_TASK_STATUSES
        ]

    def fetch_recent_commands(self, limit: int = 5) -> list[TaskSummaryResult]:
        return self._fetch_task_history()[:limit]

    def fetch_device_status(self) -> DeviceStatusResult:
        parsed = self._get_json(f"/api/devices/{self.device_id}")

        if not isinstance(parsed, dict):
            return DeviceStatusResult(found=False)

        device_id = parsed.get("device_id")
        is_online = parsed.get("is_online")
        last_seen_at = parsed.get("last_seen_at")

        if not isinstance(device_id, str) or not isinstance(is_online, bool):
            return DeviceStatusResult(found=False)

        queue = self.fetch_active_queue()
        attention_count = sum(
            1 for item in queue if item.status in ATTENTION_TASK_STATUSES
        )

        return DeviceStatusResult(
            found=True,
            device_id=device_id,
            is_online=is_online,
            last_seen_at=last_seen_at if isinstance(last_seen_at, str) else None,
            pending_count=len(queue),
            attention_count=attention_count,
        )

    def cancel_task(self, task_id: str) -> TaskStatusResult:
        return parse_task_status_item(self._post_json(f"/api/tasks/{task_id}/cancel", None))

    def fetch_app_catalog(self) -> list[AppCatalogEntry]:
        parsed = self._get_json(f"/api/apps?{urlencode({'device_id': self.device_id})}")

        if not isinstance(parsed, dict):
            return []

        items = parsed.get("items")
        if not isinstance(items, list):
            return []

        return [
            item
            for item in (parse_app_catalog_item(value) for value in items)
            if item is not None
        ]

    def fetch_owner_profile_context(self) -> str | None:
        parsed = self._get_json(f"/api/profile?{urlencode({'device_id': self.device_id})}")
        return build_owner_profile_context(parsed)

    def _fetch_task_history(self, *, chat_id: int | None = None) -> list[TaskSummaryResult]:
        query = {
            "device_id": self.device_id,
            "include_history": "true",
        }

        if chat_id is not None:
            query["chat_id"] = str(chat_id)

        parsed = self._get_json(f"/api/tasks?{urlencode(query)}")

        if not isinstance(parsed, dict):
            return []

        items = parsed.get("items")

        if not isinstance(items, list):
            return []

        return [
            item
            for item in (parse_task_summary_item(value) for value in items)
            if item is not None
        ]

    def _post(self, path: str, payload: dict[str, object]) -> TaskWorkflowResult:
        return parse_workflow_result(self._post_json(path, payload))

    def _post_json(self, path: str, payload: dict[str, object] | None) -> object | None:
        request = Request(
            url=f"{self.server_url.rstrip('/')}{path}",
            data=None if payload is None else json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urlopen(request, timeout=self.wait_seconds + 1) as response:
                body = response.read().decode("utf-8")
        except HTTPError as error:
            if error.code == 404:
                return None
            return None
        except (URLError, TimeoutError, OSError):
            return None

        try:
            return json.loads(body) if body else None
        except json.JSONDecodeError:
            return None

    def _get_json(self, path: str) -> object | None:
        request = Request(
            url=f"{self.server_url.rstrip('/')}{path}",
            method="GET",
        )

        try:
            with urlopen(request, timeout=self.wait_seconds + 1) as response:
                body = response.read().decode("utf-8")
        except HTTPError as error:
            if error.code == 404:
                return None
            return None
        except (URLError, TimeoutError, OSError):
            return None

        try:
            return json.loads(body) if body else None
        except json.JSONDecodeError:
            return None
