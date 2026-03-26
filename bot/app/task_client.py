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
    "blocked",
    "running",
    "done",
    "failed",
    "stalled",
]


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


def parse_workflow_result(body: str) -> TaskWorkflowResult:
    try:
        parsed = json.loads(body) if body else {}
    except json.JSONDecodeError:
        return TaskWorkflowResult(status="ignored")

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
        parsed = self._get_json(f"/api/tasks/{task_id}")
        return parse_task_status_item(parsed)

    def fetch_latest_task(self, chat_id: int) -> TaskStatusResult:
        query = urlencode(
            {
                "device_id": self.device_id,
                "include_history": "true",
                "chat_id": str(chat_id),
            }
        )
        parsed = self._get_json(f"/api/tasks?{query}")

        if not isinstance(parsed, dict):
            return TaskStatusResult(found=False)

        items = parsed.get("items")

        if not isinstance(items, list) or len(items) == 0:
            return TaskStatusResult(found=False)

        return parse_task_status_item(items[0])

    def _post(self, path: str, payload: dict[str, object]) -> TaskWorkflowResult:
        request = Request(
            url=f"{self.server_url.rstrip('/')}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urlopen(request, timeout=self.wait_seconds + 1) as response:
                body = response.read().decode("utf-8")
        except (HTTPError, URLError, TimeoutError, OSError):
            return TaskWorkflowResult(status="ignored")

        return parse_workflow_result(body)

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
