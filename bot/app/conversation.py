from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Protocol

from app.handlers.task import (
    get_auth_password_prompt_text,
    get_auth_success_text,
    get_confirm_prompt_text,
    get_decline_text,
    get_invalid_password_text,
    get_invalid_totp_text,
    get_locked_text,
    get_queued_task_text,
    get_setup_required_text,
    map_task_workflow_response,
)
from app.intent_resolver import ClarificationResolution, IntentResolution, SupportsIntentResolver
from app.task_client import TaskWorkflowResult

PendingStateKind = Literal["auth_password", "auth_totp", "confirm", "screenshot_scope"]


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


@dataclass(frozen=True, slots=True)
class BotButton:
    text: str
    callback_data: str


@dataclass(frozen=True, slots=True)
class BotReply:
    text: str | None = None
    buttons: tuple[BotButton, ...] = ()


@dataclass(frozen=True, slots=True)
class PendingState:
    kind: PendingStateKind


class BotConversationStore:
    def __init__(self) -> None:
        self._chat_state: dict[int, PendingState] = {}

    def get(self, chat_id: int) -> PendingState | None:
        return self._chat_state.get(chat_id)

    def clear(self, chat_id: int) -> None:
        self._chat_state.pop(chat_id, None)

    def set_pending_auth(self, *, chat_id: int, step: Literal["password", "totp"]) -> None:
        self._chat_state[chat_id] = PendingState(
            kind="auth_password" if step == "password" else "auth_totp"
        )

    def set_pending_confirm(self, *, chat_id: int) -> None:
        self._chat_state[chat_id] = PendingState(kind="confirm")

    def set_pending_screenshot_choice(self, *, chat_id: int) -> None:
        self._chat_state[chat_id] = PendingState(kind="screenshot_scope")


SCREENSHOT_BUTTONS = (
    BotButton(text="Экран 1", callback_data="screenshot:screen-1"),
    BotButton(text="Экран 2", callback_data="screenshot:screen-2"),
    BotButton(text="Оба", callback_data="screenshot:both"),
)
DECISION_BUTTONS = (
    BotButton(text="Подтвердить", callback_data="decision:confirm"),
    BotButton(text="Отклонить", callback_data="decision:decline"),
)


def _reply_from_workflow_result(
    result: TaskWorkflowResult,
    *,
    chat_id: int,
    store: BotConversationStore,
) -> BotReply | None:
    if result.status in {"queued", "task_queued"}:
        store.clear(chat_id)

        if result.task_id is not None:
            return BotReply(
                text=get_queued_task_text(result.task_id, device_online=result.device_online)
            )

        return BotReply(text=get_auth_success_text(device_online=result.device_online))

    if result.status == "awaiting_auth" and result.challenge_step == "password":
        store.set_pending_auth(chat_id=chat_id, step="password")
        return BotReply(text=get_auth_password_prompt_text())

    if result.status == "awaiting_auth" and result.challenge_step == "confirm":
        store.set_pending_confirm(chat_id=chat_id)
        return BotReply(text=get_confirm_prompt_text(), buttons=DECISION_BUTTONS)

    if result.status == "totp_required":
        store.set_pending_auth(chat_id=chat_id, step="totp")
        return BotReply(text="Пароль принят. Введите код из приложения-аутентификатора.")

    if result.status == "confirm_required":
        store.set_pending_confirm(chat_id=chat_id)
        return BotReply(text=get_confirm_prompt_text(), buttons=DECISION_BUTTONS)

    if result.status == "invalid_password":
        store.set_pending_auth(chat_id=chat_id, step="password")
        return BotReply(text=get_invalid_password_text())

    if result.status == "invalid_totp":
        store.set_pending_auth(chat_id=chat_id, step="totp")
        return BotReply(text=get_invalid_totp_text())

    if result.status == "declined":
        store.clear(chat_id)
        return BotReply(text=get_decline_text())

    if result.status == "setup_required":
        store.clear(chat_id)
        return BotReply(text=result.message or get_setup_required_text())

    if result.status == "locked":
        store.clear(chat_id)
        return BotReply(text=get_locked_text())

    text = map_task_workflow_response(result)
    return BotReply(text=text) if text is not None else None


def _create_task_from_intent(
    *,
    telegram_user_id: int,
    chat_id: int,
    risk: Literal["low", "medium", "high"],
    intent: str,
    task_client: SupportsTaskWorkflow,
    store: BotConversationStore,
) -> BotReply | None:
    if intent == "screenshot both":
        replies = [
            _reply_from_workflow_result(
                task_client.create_task(telegram_user_id, chat_id, risk, "screenshot screen-1"),
                chat_id=chat_id,
                store=store,
            ),
            _reply_from_workflow_result(
                task_client.create_task(telegram_user_id, chat_id, risk, "screenshot screen-2"),
                chat_id=chat_id,
                store=store,
            ),
        ]
        combined_text = "\n".join(
            reply.text for reply in replies if reply is not None and reply.text is not None
        )
        return BotReply(text=combined_text) if combined_text else None

    result = task_client.create_task(telegram_user_id, chat_id, risk, intent)
    return _reply_from_workflow_result(result, chat_id=chat_id, store=store)


def process_text_message(
    text: str,
    *,
    telegram_user_id: int,
    chat_id: int,
    task_client: SupportsTaskWorkflow,
    store: BotConversationStore,
    resolver: SupportsIntentResolver,
) -> BotReply | None:
    current_state = store.get(chat_id)

    if current_state is not None and current_state.kind in {"auth_password", "auth_totp"}:
        result = task_client.submit_auth_input(telegram_user_id, chat_id, text.strip())
        return _reply_from_workflow_result(result, chat_id=chat_id, store=store)

    resolution = resolver.resolve(text)

    if resolution.kind == "ignored":
        return None

    if (
        resolution.kind == "clarification"
        and resolution.clarification == ClarificationResolution(kind="screenshot_scope")
    ):
        store.set_pending_screenshot_choice(chat_id=chat_id)
        return BotReply(text="Какой экран отправить?", buttons=SCREENSHOT_BUTTONS)

    if resolution.kind == "task" and resolution.intent is not None:
        return _create_task_from_intent(
            telegram_user_id=telegram_user_id,
            chat_id=chat_id,
            risk=resolution.risk,
            intent=resolution.intent,
            task_client=task_client,
            store=store,
        )

    return None


def process_callback_query(
    callback_data: str,
    *,
    telegram_user_id: int,
    chat_id: int,
    task_client: SupportsTaskWorkflow,
    store: BotConversationStore,
) -> BotReply | None:
    current_state = store.get(chat_id)

    if callback_data.startswith("screenshot:"):
        if current_state is None or current_state.kind != "screenshot_scope":
            return BotReply(text="Уточнение устарело. Отправьте задачу заново.")

        selected = callback_data.split(":", 1)[1]
        store.clear(chat_id)

        if selected == "screen-1":
            intent = "screenshot screen-1"
        elif selected == "screen-2":
            intent = "screenshot screen-2"
        elif selected == "both":
            intent = "screenshot both"
        else:
            return BotReply(text="Не удалось понять выбранный экран.")

        return _create_task_from_intent(
            telegram_user_id=telegram_user_id,
            chat_id=chat_id,
            risk="low",
            intent=intent,
            task_client=task_client,
            store=store,
        )

    if callback_data.startswith("decision:"):
        if current_state is None or current_state.kind != "confirm":
            return BotReply(text="Подтверждение уже неактуально. Отправьте задачу заново.")

        decision = callback_data.split(":", 1)[1]

        if decision not in {"confirm", "decline"}:
            return BotReply(text="Не удалось понять выбранное действие.")

        result = task_client.submit_decision(telegram_user_id, chat_id, decision)
        return _reply_from_workflow_result(result, chat_id=chat_id, store=store)

    return None


def process_manual_task_command(
    *,
    telegram_user_id: int,
    chat_id: int,
    risk: Literal["low", "medium", "high"],
    intent: str,
    task_client: SupportsTaskWorkflow,
    store: BotConversationStore,
) -> BotReply | None:
    return _create_task_from_intent(
        telegram_user_id=telegram_user_id,
        chat_id=chat_id,
        risk=risk,
        intent=intent,
        task_client=task_client,
        store=store,
    )


def process_manual_auth_input(
    *,
    telegram_user_id: int,
    chat_id: int,
    value: str,
    task_client: SupportsTaskWorkflow,
    store: BotConversationStore,
) -> BotReply | None:
    result = task_client.submit_auth_input(telegram_user_id, chat_id, value)
    return _reply_from_workflow_result(result, chat_id=chat_id, store=store)


def process_manual_decision(
    *,
    telegram_user_id: int,
    chat_id: int,
    decision: Literal["confirm", "decline"],
    task_client: SupportsTaskWorkflow,
    store: BotConversationStore,
) -> BotReply | None:
    result = task_client.submit_decision(telegram_user_id, chat_id, decision)
    return _reply_from_workflow_result(result, chat_id=chat_id, store=store)
