import re
from typing import Protocol

from app.handlers.pair import resolve_pair_code

START_PAIR_PATTERN = re.compile(r"^/start(?:@\w+)?\s+pair_([A-Za-z0-9_-]+)\s*$")


class SupportsPairAttempt(Protocol):
    def submit_pair_attempt(
        self, telegram_user_id: int, chat_id: int, code: str
    ) -> str: ...


def get_start_text() -> str:
    return (
        "Karpik онлайн. Для первого подключения можно использовать быструю ссылку "
        "вида /start pair_<код> или fallback-команду /pair <code>. "
        "После pairing можно писать обычными сообщениями: например, "
        "\"скинь скриншот\", \"скинь файл hack.pptx\" или "
        "\"придумай название фичи\". Список возможностей и ручных команд: /help."
    )


def parse_start_pair_command(text: str) -> str | None:
    match = START_PAIR_PATTERN.fullmatch(text.strip())

    if not match:
        return None

    return match.group(1)


def resolve_start_pair_command(
    text: str,
    *,
    telegram_user_id: int,
    chat_id: int,
    pairing_client: SupportsPairAttempt,
) -> str | None:
    code = parse_start_pair_command(text)

    if code is None:
        return None

    return resolve_pair_code(
        code,
        telegram_user_id=telegram_user_id,
        chat_id=chat_id,
        pairing_client=pairing_client,
    )
