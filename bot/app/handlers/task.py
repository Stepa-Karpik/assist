from __future__ import annotations

import re
from typing import Protocol

from app.task_client import (
    DeviceStatusResult,
    TaskStatusResult,
    TaskSummaryResult,
    TaskWorkflowResult,
)

TASK_COMMAND_PATTERN = re.compile(r"^/task(?:@\w+)?\s+(low|medium|high)\s+(.+?)\s*$")
AUTH_COMMAND_PATTERN = re.compile(r"^/auth(?:@\w+)?\s+(.+?)\s*$")
CONFIRM_COMMAND_PATTERN = re.compile(r"^/confirm(?:@\w+)?\s*$")
DECLINE_COMMAND_PATTERN = re.compile(r"^/decline(?:@\w+)?\s*$")
STATUS_COMMAND_PATTERN = re.compile(r"^/status(?:@\w+)?(?:\s+(.+?))?\s*$")
DEVICE_COMMAND_PATTERN = re.compile(r"^/(?:pc|device)(?:@\w+)?\s*$")
QUEUE_COMMAND_PATTERN = re.compile(r"^/queue(?:@\w+)?\s*$")
LAST_COMMAND_PATTERN = re.compile(r"^/last(?:@\w+)?\s*$")
KILL_COMMAND_PATTERN = re.compile(r"^/kill(?:@\w+)?\s+(.+?)\s*$")


class SupportsTaskWorkflow(Protocol):
    def create_task(
        self, telegram_user_id: int, chat_id: int, risk: str, intent: str
    ) -> TaskWorkflowResult: ...

    def submit_auth_input(
        self,
        telegram_user_id: int,
        chat_id: int,
        value: str,
        challenge_id: str | None = None,
    ) -> TaskWorkflowResult: ...

    def submit_decision(
        self,
        telegram_user_id: int,
        chat_id: int,
        decision: str,
        challenge_id: str | None = None,
    ) -> TaskWorkflowResult: ...

    def fetch_task(self, task_id: str) -> TaskStatusResult: ...

    def fetch_latest_task(self, chat_id: int) -> TaskStatusResult: ...

    def fetch_device_status(self) -> DeviceStatusResult: ...

    def fetch_active_queue(self) -> list[TaskSummaryResult]: ...

    def fetch_recent_commands(self, limit: int = 5) -> list[TaskSummaryResult]: ...

    def cancel_task(self, task_id: str) -> TaskStatusResult: ...


def parse_task_command(text: str) -> tuple[str, str] | None:
    match = TASK_COMMAND_PATTERN.fullmatch(text.strip())
    if match is None:
        return None
    return match.group(1), match.group(2)


def parse_auth_command(text: str) -> str | None:
    match = AUTH_COMMAND_PATTERN.fullmatch(text.strip())
    return match.group(1) if match is not None else None


def parse_status_command(text: str) -> str | None:
    match = STATUS_COMMAND_PATTERN.fullmatch(text.strip())
    if match is None:
        return None

    task_id = match.group(1)
    return task_id.strip() if task_id is not None else ""


def parse_cancel_command(text: str) -> str | None:
    match = KILL_COMMAND_PATTERN.fullmatch(text.strip())
    if match is None:
        return None
    return match.group(1).strip()


def is_device_command(text: str) -> bool:
    return DEVICE_COMMAND_PATTERN.fullmatch(text.strip()) is not None


def is_queue_command(text: str) -> bool:
    return QUEUE_COMMAND_PATTERN.fullmatch(text.strip()) is not None


def is_last_command(text: str) -> bool:
    return LAST_COMMAND_PATTERN.fullmatch(text.strip()) is not None


def get_queued_task_text(task_id: str, *, device_online: bool | None = None) -> str:
    base_text = f"Задача {task_id} поставлена в очередь."

    if device_online is False:
        return f"{base_text} ПК сейчас офлайн."

    return base_text


def get_running_task_text(task_id: str) -> str:
    return f"Задача {task_id} выполняется."


def get_done_task_text(task_id: str, result_text: str) -> str:
    return f"Готово: {task_id}\n{result_text}"


def get_failed_task_text(task_id: str, error_text: str) -> str:
    return f"Ошибка: {task_id}\n{error_text}"


def get_cancel_requested_task_text(task_id: str) -> str:
    return f"Останавливаю задачу {task_id}."


def get_cancelled_task_text(task_id: str) -> str:
    return f"Задача {task_id} остановлена."


def get_task_not_found_text() -> str:
    return "Задача не найдена."


def get_auth_success_text(*, device_online: bool | None = None) -> str:
    base_text = "Авторизация пройдена. Задача поставлена в очередь."

    if device_online is False:
        return f"{base_text} ПК сейчас офлайн."

    return base_text


def get_auth_password_prompt_text() -> str:
    return "Введите пароль следующим сообщением."


def get_auth_totp_prompt_text() -> str:
    return "Пароль принят. Введите код из приложения-аутентификатора."


def get_confirm_prompt_text() -> str:
    return "Код TOTP принят. Подтвердить выполнение задачи?"


def get_invalid_password_text() -> str:
    return "Пароль неверный."


def get_invalid_totp_text() -> str:
    return "Код TOTP неверный."


def get_locked_text() -> str:
    return "Чат временно заблокирован на 3 минуты."


def get_decline_text() -> str:
    return "Задача отклонена."


def get_setup_required_text() -> str:
    return "Сначала настрой пароль и TOTP в GUI Karpik на ПК."


def get_device_status_text(
    *,
    device_id: str,
    is_online: bool,
    last_seen_at: str | None,
    pending_count: int,
    attention_count: int,
) -> str:
    lines = [
        f"ПК {device_id}: {'онлайн' if is_online else 'офлайн'}",
        f"Последний heartbeat: {last_seen_at or 'нет данных'}",
        f"Активных задач: {pending_count}",
        f"Требуют внимания: {attention_count}",
    ]
    return "\n".join(lines)


def format_task_summary_line(item: TaskSummaryResult) -> str:
    return f"- {item.task_id} [{item.status}] {item.intent}"


def get_queue_summary_text(items: list[TaskSummaryResult]) -> str:
    if len(items) == 0:
        return "Сейчас активных задач нет."

    return "\n".join(
        [
            "Активная очередь:",
            *[format_task_summary_line(item) for item in items[:8]],
        ]
    )


def get_recent_commands_text(items: list[TaskSummaryResult]) -> str:
    if len(items) == 0:
        return "История команд пока пустая."

    return "\n".join(
        [
            "Последние команды:",
            *[format_task_summary_line(item) for item in items[:5]],
        ]
    )


def map_task_workflow_response(result: TaskWorkflowResult) -> str | None:
    if result.status == "queued" and result.task_id is not None:
        return get_queued_task_text(result.task_id, device_online=result.device_online)

    if result.status == "queued":
        return get_auth_success_text(device_online=result.device_online)

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
        return get_queued_task_text(result.task_id, device_online=result.device_online)

    if result.status == "task_queued":
        return get_auth_success_text(device_online=result.device_online)

    if result.status == "totp_required":
        return get_auth_totp_prompt_text()

    if result.status == "confirm_required":
        return get_confirm_prompt_text()

    if result.status == "invalid_password":
        return get_invalid_password_text()

    if result.status == "invalid_totp":
        return get_invalid_totp_text()

    if result.status == "locked":
        return get_locked_text()

    if result.status == "declined":
        return get_decline_text()

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

    if result.status == "cancel_requested":
        return get_cancel_requested_task_text(result.task_id)

    if result.status == "cancelled":
        return get_cancelled_task_text(result.task_id)

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
        return "Используйте /task <low|medium|high> <intent>."

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
        return "Используйте /auth <значение>."

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
        return "Используйте /confirm."

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
        return "Используйте /decline."

    result = task_client.submit_decision(telegram_user_id, chat_id, "decline")
    return map_auth_workflow_response(result)


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
        return "Используйте /status [task_id]."

    if parsed == "":
        return map_task_status_response(task_client.fetch_latest_task(chat_id))

    task_result = task_client.fetch_task(parsed)

    if not task_result.found:
        return get_task_not_found_text()

    return map_task_status_response(task_result)


def resolve_device_command(*, task_client: SupportsTaskWorkflow) -> str:
    result = task_client.fetch_device_status()

    if not result.found or result.device_id is None or result.is_online is None:
        return "Статус ПК недоступен."

    return get_device_status_text(
        device_id=result.device_id,
        is_online=result.is_online,
        last_seen_at=result.last_seen_at,
        pending_count=result.pending_count,
        attention_count=result.attention_count,
    )


def resolve_queue_command(*, task_client: SupportsTaskWorkflow) -> str:
    return get_queue_summary_text(task_client.fetch_active_queue())


def resolve_last_command(*, task_client: SupportsTaskWorkflow) -> str:
    return get_recent_commands_text(task_client.fetch_recent_commands(5))


def resolve_cancel_command(text: str, *, task_client: SupportsTaskWorkflow) -> str:
    task_id = parse_cancel_command(text)

    if task_id is None:
        return "Используйте /kill <task_id>."

    result = task_client.cancel_task(task_id)

    if not result.found or result.task_id is None or result.status is None:
        return get_task_not_found_text()

    if result.status == "cancel_requested":
        return get_cancel_requested_task_text(result.task_id)

    if result.status == "cancelled":
        return get_cancelled_task_text(result.task_id)

    return map_task_status_response(result) or get_task_not_found_text()
