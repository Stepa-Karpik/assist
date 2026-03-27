import re
from typing import Protocol

from app.pairing_client import PairAttemptStatus

PAIR_COMMAND_PATTERN = re.compile(r"^/pair(?:@\w+)?\s+([A-Za-z0-9_-]+)\s*$")


class SupportsPairAttempt(Protocol):
    def submit_pair_attempt(
        self, telegram_user_id: int, chat_id: int, code: str
    ) -> PairAttemptStatus: ...


def parse_pair_command(text: str) -> str | None:
    match = PAIR_COMMAND_PATTERN.fullmatch(text.strip())

    if not match:
        return None

    return match.group(1)


def get_pair_success_text() -> str:
    return "Устройство привязано"


def get_pair_failure_text() -> str:
    return "Код недействителен"


def resolve_pair_command(
    text: str,
    *,
    telegram_user_id: int,
    chat_id: int,
    pairing_client: SupportsPairAttempt,
) -> str | None:
    code = parse_pair_command(text)

    if code is None:
        return get_pair_failure_text()

    result = pairing_client.submit_pair_attempt(telegram_user_id, chat_id, code)

    if result == "paired":
        return get_pair_success_text()

    if result == "invalid_code":
        return get_pair_failure_text()

    return None
