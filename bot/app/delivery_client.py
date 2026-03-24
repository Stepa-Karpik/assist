from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

DeliveryKind = Literal["task_done", "task_failed"]
DeliveryStatus = Literal["pending", "delivered"]


@dataclass(frozen=True, slots=True)
class DeliveryEvent:
    event_id: str
    device_id: str
    task_id: str
    chat_id: int
    telegram_user_id: int
    kind: DeliveryKind
    intent: str
    result_text: str | None
    error_text: str | None
    status: DeliveryStatus
    created_at: str


def parse_delivery_event(value: object) -> DeliveryEvent | None:
    if not isinstance(value, dict):
        return None

    required_strings = {
        "event_id": value.get("event_id"),
        "device_id": value.get("device_id"),
        "task_id": value.get("task_id"),
        "intent": value.get("intent"),
        "kind": value.get("kind"),
        "status": value.get("status"),
        "created_at": value.get("created_at"),
    }

    if any(not isinstance(item, str) for item in required_strings.values()):
        return None

    chat_id = value.get("chat_id")
    telegram_user_id = value.get("telegram_user_id")

    if not isinstance(chat_id, int) or not isinstance(telegram_user_id, int):
        return None

    kind = required_strings["kind"]
    status = required_strings["status"]

    if kind not in {"task_done", "task_failed"}:
        return None

    if status not in {"pending", "delivered"}:
        return None

    result_text = value.get("result_text")
    error_text = value.get("error_text")

    return DeliveryEvent(
        event_id=required_strings["event_id"],
        device_id=required_strings["device_id"],
        task_id=required_strings["task_id"],
        chat_id=chat_id,
        telegram_user_id=telegram_user_id,
        kind=kind,
        intent=required_strings["intent"],
        result_text=result_text if isinstance(result_text, str) else None,
        error_text=error_text if isinstance(error_text, str) else None,
        status=status,
        created_at=required_strings["created_at"],
    )


@dataclass(frozen=True, slots=True)
class DeliveryServerClient:
    server_url: str
    device_id: str
    wait_seconds: float = 5.0

    def fetch_pending_events(self) -> list[DeliveryEvent]:
        query = urlencode({"device_id": self.device_id})
        request = Request(
            url=f"{self.server_url.rstrip('/')}/api/bot/outbox?{query}",
            method="GET",
        )

        try:
            with urlopen(request, timeout=self.wait_seconds + 1) as response:
                body = response.read().decode("utf-8")
        except (HTTPError, URLError, TimeoutError, OSError):
            return []

        try:
            parsed = json.loads(body) if body else {}
        except json.JSONDecodeError:
            return []

        if not isinstance(parsed, dict):
            return []

        items = parsed.get("items")

        if not isinstance(items, list):
            return []

        result: list[DeliveryEvent] = []

        for item in items:
            event = parse_delivery_event(item)
            if event is not None:
                result.append(event)

        return result

    def ack_event(self, event_id: str) -> None:
        request = Request(
            url=f"{self.server_url.rstrip('/')}/api/bot/outbox/{event_id}/ack",
            data=b"",
            method="POST",
        )

        try:
            with urlopen(request, timeout=self.wait_seconds + 1):
                return
        except (HTTPError, URLError, TimeoutError, OSError):
            return
