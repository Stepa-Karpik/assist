from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

TaskWorkflowStatus = Literal[
    "queued",
    "awaiting_auth",
    "setup_required",
    "locked",
    "ignored",
    "task_queued",
    "totp_required",
    "confirm_required",
    "invalid_password",
    "invalid_totp",
    "declined",
]


@dataclass(frozen=True, slots=True)
class TaskWorkflowResult:
    status: TaskWorkflowStatus
    challenge_step: str | None = None
    message: str | None = None


def normalize_workflow_result(value: object) -> TaskWorkflowStatus:
    if value in {
        "queued",
        "awaiting_auth",
        "setup_required",
        "locked",
        "task_queued",
        "totp_required",
        "confirm_required",
        "invalid_password",
        "invalid_totp",
        "declined",
    }:
        return value

    return "ignored"


def parse_workflow_result(body: str) -> TaskWorkflowResult:
    try:
        parsed = json.loads(body) if body else {}
    except json.JSONDecodeError:
        return TaskWorkflowResult(status="ignored")

    if not isinstance(parsed, dict):
        return TaskWorkflowResult(status="ignored")

    return TaskWorkflowResult(
        status=normalize_workflow_result(parsed.get("status")),
        challenge_step=parsed.get("challenge_step"),
        message=parsed.get("message"),
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
        self, telegram_user_id: int, chat_id: int, value: str
    ) -> TaskWorkflowResult:
        payload = {
            "device_id": self.device_id,
            "telegram_user_id": telegram_user_id,
            "chat_id": chat_id,
            "value": value,
            "wait_seconds": self.wait_seconds,
        }
        return self._post("/api/challenges/input", payload)

    def submit_decision(
        self, telegram_user_id: int, chat_id: int, decision: str
    ) -> TaskWorkflowResult:
        payload = {
            "device_id": self.device_id,
            "telegram_user_id": telegram_user_id,
            "chat_id": chat_id,
            "decision": decision,
        }
        return self._post("/api/challenges/decision", payload)

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
