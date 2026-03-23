from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

PairAttemptStatus = Literal["paired", "invalid_code", "ignored"]


def normalize_pair_attempt_status(value: object) -> PairAttemptStatus:
    if value == "paired":
        return "paired"

    if value == "invalid_code":
        return "invalid_code"

    return "ignored"


@dataclass(frozen=True, slots=True)
class PairingServerClient:
    server_url: str
    device_id: str
    wait_seconds: float = 5.0

    def submit_pair_attempt(
        self, telegram_user_id: int, chat_id: int, code: str
    ) -> PairAttemptStatus:
        payload = {
            "device_id": self.device_id,
            "telegram_user_id": telegram_user_id,
            "chat_id": chat_id,
            "code": code,
            "wait_seconds": self.wait_seconds,
        }
        request = Request(
            url=f"{self.server_url.rstrip('/')}/api/bot/pair-attempt",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urlopen(request, timeout=self.wait_seconds + 1) as response:
                body = response.read().decode("utf-8")
        except (HTTPError, URLError, TimeoutError, OSError):
            return "ignored"

        try:
            parsed = json.loads(body) if body else {}
        except json.JSONDecodeError:
            return "ignored"

        if not isinstance(parsed, dict):
            return "ignored"

        return normalize_pair_attempt_status(parsed.get("status"))
