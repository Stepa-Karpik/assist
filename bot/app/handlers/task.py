from __future__ import annotations

import re
from typing import Protocol

from app.task_client import TaskStatusResult, TaskWorkflowResult

TASK_COMMAND_PATTERN = re.compile(r"^/task(?:@\w+)?\s+(low|medium|high)\s+(.+?)\s*$")
AUTH_COMMAND_PATTERN = re.compile(r"^/auth(?:@\w+)?\s+(.+?)\s*$")
CONFIRM_COMMAND_PATTERN = re.compile(r"^/confirm(?:@\w+)?\s*$")
DECLINE_COMMAND_PATTERN = re.compile(r"^/decline(?:@\w+)?\s*$")
STATUS_COMMAND_PATTERN = re.compile(r"^/status(?:@\w+)?(?:\s+(.+?))?\s*$")


class SupportsTaskWorkflow(Protocol):
    def create_task(
        self, telegram_user_id: int, chat_id: int, risk: str, intent: str
    ) -> TaskWorkflowResult: ...

    def submit_auth_input(
        self, telegram_user_id: int, chat_id: int, value: str
    ) -> TaskWorkflowResult: ...

    def submit_decision(
        self, telegram_user_id: int, chat_id: int, decision: str
    ) -> TaskWorkflowResult: ...

    def fetch_task(self, task_id: str) -> TaskStatusResult: ...

    def fetch_latest_task(self, chat_id: int) -> TaskStatusResult: ...


def parse_task_command(text: str) -> tuple[str, str] | None:
    match = TASK_COMMAND_PATTERN.fullmatch(text.strip())

    if not match:
        return None

    return match.group(1), match.group(2)


def parse_auth_command(text: str) -> str | None:
    match = AUTH_COMMAND_PATTERN.fullmatch(text.strip())

    if not match:
        return None

    return match.group(1)


def parse_status_command(text: str) -> str | None:
    match = STATUS_COMMAND_PATTERN.fullmatch(text.strip())

    if not match:
        return None

    task_id = match.group(1)
    return task_id.strip() if task_id is not None else ""


def get_queued_task_text(task_id: str) -> str:
    return f"Задача {task_id} поставлена в очередь."


def get_running_task_text(task_id: str) -> str:
    return f"Задача {task_id} выполняется."


def get_done_task_text(task_id: str, result_text: str) -> str:
    return f"Задача {task_id} завершена: {result_text}"


def get_failed_task_text(task_id: str, error_text: str) -> str:
    return f"Задача {task_id} завершилась с ошибкой: {error_text}"


def get_task_not_found_text() -> str:
    return "Задача не найдена."


def get_auth_success_text() -> str:
    return "Авторизация пройдена. Задача поставлена в очередь."


def get_auth_password_prompt_text() -> str:
    return "Введите пароль командой /auth <пароль>."


def get_confirm_prompt_text() -> str:
    return "Код TOTP принят. Подтверди задачу командой /confirm или отклони /decline."


def get_invalid_password_text() -> str:
    return "Пароль неверный."


def get_invalid_totp_text() -> str:
    return "Код TOTP неверный."


def get_locked_text() -> str:
    return "Чат временно заблокирован на 3 минуты."


def get_decline_text() -> str:
    return "Задача отклонена."


def get_setup_required_text() -> str:
    return "Настрой пароль и TOTP в GUI Karpik на ПК."


def map_task_workflow_response(result: TaskWorkflowResult) -> str | None:
    if result.status == "queued" and result.task_id is not None:
        return get_queued_task_text(result.task_id)

    if result.status == "queued":
        return get_auth_success_text()

    if result.status == "awaiting_auth" and result.challenge_step == "password":
        return get_auth_password_prompt_text()

    if result.status == "awaiting_auth" and result.challenge_step == "confirm":
        return get_confirm_prompt_text()

    if result.status == "setup_required":
        return result.message or get_setup_required_text()

    if result.status == "locked":
        return get_locked_text()

    return None


def map_auth_workflow_response(result: TaskWorkflowResult) -> str | None:
    if result.status == "task_queued" and result.task_id is not None:
        return get_queued_task_text(result.task_id)

    if result.status == "task_queued":
        return get_auth_success_text()

    if result.status == "totp_required":
        return "Пароль принят. Введите код TOTP командой /auth <код>."

    if result.status == "confirm_required":
        return get_confirm_prompt_text()

    if result.status == "invalid_password":
        return get_invalid_password_text()

    if result.status == "invalid_totp":
        return get_invalid_totp_text()

    if result.status == "locked":
        return get_locked_text()

    return None


def map_task_status_response(result: TaskStatusResult) -> str | None:
    if not result.found or result.task_id is None or result.status is None:
        return None

    if result.status == "queued":
        return get_queued_task_text(result.task_id)

    if result.status == "running":
        return get_running_task_text(result.task_id)

    if result.status == "done":
        return get_done_task_text(result.task_id, result.result_text or "Готово.")

    if result.status == "failed":
        return get_failed_task_text(result.task_id, result.error_text or "Без деталей.")

    if result.status == "awaiting_auth":
        return f"Задача {result.task_id} ждёт авторизации."

    if result.status == "awaiting_local_approval":
        return f"Задача {result.task_id} ждёт локального подтверждения."

    if result.status == "blocked":
        return f"Задача {result.task_id} заблокирована."

    if result.status == "stalled":
        return f"Задача {result.task_id} зависла."

    return None


def resolve_task_command(
    text: str,
    *,
    telegram_user_id: int,
    chat_id: int,
    task_client: SupportsTaskWorkflow,
) -> str | None:
    parsed = parse_task_command(text)

    if parsed is None:
        return "Используй /task <low|medium|high> <intent>."

    risk, intent = parsed
    result = task_client.create_task(telegram_user_id, chat_id, risk, intent)
    return map_task_workflow_response(result)


def resolve_auth_command(
    text: str,
    *,
    telegram_user_id: int,
    chat_id: int,
    task_client: SupportsTaskWorkflow,
) -> str | None:
    value = parse_auth_command(text)

    if value is None:
        return "Используй /auth <значение>."

    result = task_client.submit_auth_input(telegram_user_id, chat_id, value)
    return map_auth_workflow_response(result)


def resolve_confirm_command(
    text: str,
    *,
    telegram_user_id: int,
    chat_id: int,
    task_client: SupportsTaskWorkflow,
) -> str | None:
    if not CONFIRM_COMMAND_PATTERN.fullmatch(text.strip()):
        return "Используй /confirm."

    result = task_client.submit_decision(telegram_user_id, chat_id, "confirm")
    return map_auth_workflow_response(result)


def resolve_decline_command(
    text: str,
    *,
    telegram_user_id: int,
    chat_id: int,
    task_client: SupportsTaskWorkflow,
) -> str | None:
    if not DECLINE_COMMAND_PATTERN.fullmatch(text.strip()):
        return "Используй /decline."

    result = task_client.submit_decision(telegram_user_id, chat_id, "decline")

    if result.status == "declined":
        return get_decline_text()

    return None


def resolve_status_command(
    text: str,
    *,
    telegram_user_id: int,
    chat_id: int,
    task_client: SupportsTaskWorkflow,
) -> str | None:
    del telegram_user_id

    parsed = parse_status_command(text)

    if parsed is None:
        return "Используй /status [task_id]."

    if parsed == "":
        return map_task_status_response(task_client.fetch_latest_task(chat_id))

    task_result = task_client.fetch_task(parsed)

    if not task_result.found:
        return get_task_not_found_text()

    return map_task_status_response(task_result)
