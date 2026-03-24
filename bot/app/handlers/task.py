from __future__ import annotations

import re
from typing import Protocol

from app.task_client import TaskWorkflowResult

TASK_COMMAND_PATTERN = re.compile(r"^/task(?:@\w+)?\s+(low|medium|high)\s+(.+?)\s*$")
AUTH_COMMAND_PATTERN = re.compile(r"^/auth(?:@\w+)?\s+(.+?)\s*$")
CONFIRM_COMMAND_PATTERN = re.compile(r"^/confirm(?:@\w+)?\s*$")
DECLINE_COMMAND_PATTERN = re.compile(r"^/decline(?:@\w+)?\s*$")


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


def get_queue_success_text() -> str:
    return "Задача поставлена в очередь."


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
    if result.status == "queued":
        return get_queue_success_text()

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

    if result.status == "task_queued":
        return get_queue_success_text()

    return None


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
