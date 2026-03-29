from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal, Protocol

from app.handlers.task import (
    get_auth_password_prompt_text,
    get_auth_success_text,
    get_auth_totp_prompt_text,
    get_cancel_requested_task_text,
    get_cancelled_task_text,
    get_confirm_prompt_text,
    get_decline_text,
    get_invalid_password_text,
    get_invalid_totp_text,
    get_locked_text,
    get_queued_task_text,
    get_setup_required_text,
    get_task_not_found_text,
    map_task_status_response,
    map_task_workflow_response,
    resolve_device_command,
    resolve_last_command,
    resolve_queue_command,
)
from app.intent_resolver import (
    ClarificationResolution,
    SupportsIntentResolver,
    message_explicitly_requests_codex,
    message_requires_codex,
)
from app.task_client import TaskWorkflowResult

PendingStateKind = Literal[
    "auth_password",
    "auth_totp",
    "confirm",
    "screenshot_scope",
    "app_selection",
]
AppSelectionAction = Literal["launch"]

DEVICE_TEXT_PATTERN = re.compile(
    r"\b(что\s+с\s+пк|статус\s+пк|как\s+там\s+пк|состояние\s+пк|pc\s+status|device\s+status)\b",
    re.IGNORECASE,
)
QUEUE_TEXT_PATTERN = re.compile(
    r"\b(что\s+сейчас\s+с\s+задачами|что\s+с\s+задачами|что\s+по\s+задачам|очередь|список\s+очереди|какие\s+задачи)\b",
    re.IGNORECASE,
)
LAST_TEXT_PATTERN = re.compile(
    r"\b(последние\s+команды|последние\s+5\s+команд|что\s+делали\s+последним|история\s+команд)\b",
    re.IGNORECASE,
)
APPS_TEXT_PATTERN = re.compile(
    r"\b(приложения|программы|какие\s+приложения\s+доступны|какие\s+программы\s+доступны)\b",
    re.IGNORECASE,
)
CANCEL_TEXT_PATTERN = re.compile(
    r"(?:останови|убей|отмени|прерви|cancel|kill)\s+(?:задачу\s+)?([a-z0-9-]{6,})",
    re.IGNORECASE,
)
OPEN_TARGET_PATTERN = re.compile(
    r"^(?:открой|открыть|запусти|запустить|open|launch|run)\s+(.+?)\s*$",
    re.IGNORECASE,
)
NUMERIC_SELECTION_PATTERN = re.compile(r"^\d{1,2}$")

SITE_ALIASES: dict[str, str] = {
    "ютуб": "https://youtube.com",
    "youtube": "https://youtube.com",
    "utube": "https://youtube.com",
    "google": "https://google.com",
    "гугл": "https://google.com",
    "github": "https://github.com",
    "гитхаб": "https://github.com",
    "openai": "https://openai.com",
}


class SupportsAppCatalogEntry(Protocol):
    app_id: str
    display_name: str
    aliases: tuple[str, ...] | list[str]
    linked: bool


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

    def fetch_device_status(self, telegram_user_id: int) -> object: ...

    def fetch_active_queue(self, telegram_user_id: int) -> object: ...

    def fetch_recent_commands(self, telegram_user_id: int, limit: int = 5) -> object: ...

    def cancel_task(self, task_id: str) -> object: ...

    def fetch_app_catalog(self, telegram_user_id: int) -> list[SupportsAppCatalogEntry]: ...

    def fetch_owner_profile_context(self, telegram_user_id: int) -> str | None: ...


class SupportsChatResponder(Protocol):
    def reply(self, text: str, owner_profile_context: str | None = None) -> str: ...


@dataclass(frozen=True, slots=True)
class BotButton:
    text: str
    callback_data: str


@dataclass(frozen=True, slots=True)
class BotReply:
    text: str | None = None
    buttons: tuple[BotButton, ...] = ()


@dataclass(frozen=True, slots=True)
class PendingAppCandidate:
    app_id: str
    display_name: str


@dataclass(frozen=True, slots=True)
class PendingState:
    kind: PendingStateKind
    challenge_id: str | None = None
    app_action: AppSelectionAction | None = None
    app_candidates: tuple[PendingAppCandidate, ...] = field(default_factory=tuple)


class BotConversationStore:
    def __init__(self) -> None:
        self._chat_state: dict[int, PendingState] = {}

    def get(self, chat_id: int) -> PendingState | None:
        return self._chat_state.get(chat_id)

    def clear(self, chat_id: int) -> None:
        self._chat_state.pop(chat_id, None)

    def set_pending_auth(
        self,
        *,
        chat_id: int,
        step: Literal["password", "totp"],
        challenge_id: str | None = None,
    ) -> None:
        self._chat_state[chat_id] = PendingState(
            kind="auth_password" if step == "password" else "auth_totp",
            challenge_id=challenge_id,
        )

    def set_pending_confirm(self, *, chat_id: int, challenge_id: str | None = None) -> None:
        self._chat_state[chat_id] = PendingState(kind="confirm", challenge_id=challenge_id)

    def set_pending_screenshot_choice(self, *, chat_id: int) -> None:
        self._chat_state[chat_id] = PendingState(kind="screenshot_scope")

    def set_pending_app_selection(
        self,
        *,
        chat_id: int,
        action: AppSelectionAction,
        candidates: list[PendingAppCandidate],
    ) -> None:
        self._chat_state[chat_id] = PendingState(
            kind="app_selection",
            app_action=action,
            app_candidates=tuple(candidates),
        )


SCREENSHOT_BUTTONS = (
    BotButton(text="Экран 1", callback_data="screenshot:screen-1"),
    BotButton(text="Экран 2", callback_data="screenshot:screen-2"),
    BotButton(text="Оба", callback_data="screenshot:both"),
)


def build_decision_buttons(challenge_id: str | None) -> tuple[BotButton, ...]:
    prefix = f"decision:{challenge_id}:" if challenge_id else "decision:"
    return (
        BotButton(text="Подтвердить", callback_data=f"{prefix}confirm"),
        BotButton(text="Отклонить", callback_data=f"{prefix}decline"),
    )


def build_cancel_button(task_id: str) -> tuple[BotButton, ...]:
    return (BotButton(text="Остановить", callback_data=f"kill:{task_id}"),)


def normalize_match_key(value: str) -> str:
    normalized = value.casefold().replace("ё", "е")
    normalized = re.sub(r"[^\w\s]", " ", normalized)
    return " ".join(normalized.split())


def to_pending_candidates(
    items: list[SupportsAppCatalogEntry],
) -> list[PendingAppCandidate]:
    return [
        PendingAppCandidate(app_id=item.app_id, display_name=item.display_name)
        for item in items
    ]


def build_linked_app_buttons(
    catalog: list[SupportsAppCatalogEntry],
) -> tuple[BotButton, ...]:
    linked_items = sorted(
        [item for item in catalog if getattr(item, "linked", False)],
        key=lambda item: item.display_name.casefold(),
    )
    return tuple(
        BotButton(text=item.display_name, callback_data=f"launch-app:{item.app_id}")
        for item in linked_items
    )


def build_app_catalog_reply(
    task_client: SupportsTaskWorkflow, telegram_user_id: int
) -> BotReply:
    catalog = task_client.fetch_app_catalog(telegram_user_id)
    buttons = build_linked_app_buttons(catalog)

    if len(buttons) == 0:
        return BotReply(text="Пока нет связанных приложений.")

    return BotReply(text="Связанные приложения:", buttons=buttons)


def format_app_selection_text(candidates: list[SupportsAppCatalogEntry]) -> str:
    lines = ["Нашёл несколько подходящих приложений. Ответьте номером:"]
    for index, item in enumerate(candidates, start=1):
        lines.append(f"{index}. {item.display_name}")
    return "\n".join(lines)


def try_match_known_site(query: str) -> str | None:
    normalized = normalize_match_key(query)

    for alias, url in SITE_ALIASES.items():
        if normalized == alias or f" {alias} " in f" {normalized} ":
            return url

    return None


def app_matches_query(query: str, item: SupportsAppCatalogEntry) -> bool:
    query_key = normalize_match_key(query)

    if not query_key:
        return False

    name_key = normalize_match_key(item.display_name)
    if query_key == name_key or query_key in name_key:
        return True

    for alias in item.aliases:
        alias_key = normalize_match_key(alias)
        if query_key == alias_key or query_key in alias_key or alias_key in query_key:
            return True

    return False


def find_matching_apps(
    query: str, catalog: list[SupportsAppCatalogEntry]
) -> list[SupportsAppCatalogEntry]:
    unique_matches: dict[str, SupportsAppCatalogEntry] = {}
    for item in catalog:
        if app_matches_query(query, item):
            unique_matches[item.app_id] = item

    return list(unique_matches.values())


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
        store.set_pending_auth(
            chat_id=chat_id, step="password", challenge_id=result.challenge_id
        )
        return BotReply(text=get_auth_password_prompt_text())

    if result.status == "awaiting_auth" and result.challenge_step == "confirm":
        store.set_pending_confirm(chat_id=chat_id, challenge_id=result.challenge_id)
        return BotReply(
            text=get_confirm_prompt_text(),
            buttons=build_decision_buttons(result.challenge_id),
        )

    if result.status == "totp_required":
        store.set_pending_auth(chat_id=chat_id, step="totp", challenge_id=result.challenge_id)
        return BotReply(text=get_auth_totp_prompt_text())

    if result.status == "confirm_required":
        store.set_pending_confirm(chat_id=chat_id, challenge_id=result.challenge_id)
        return BotReply(
            text=get_confirm_prompt_text(),
            buttons=build_decision_buttons(result.challenge_id),
        )

    if result.status == "invalid_password":
        store.set_pending_auth(chat_id=chat_id, step="password", challenge_id=result.challenge_id)
        return BotReply(text=get_invalid_password_text())

    if result.status == "invalid_totp":
        store.set_pending_auth(chat_id=chat_id, step="totp", challenge_id=result.challenge_id)
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


def _resolve_operator_text(
    text: str,
    *,
    telegram_user_id: int,
    chat_id: int,
    task_client: SupportsTaskWorkflow,
    store: BotConversationStore,
) -> BotReply | None:
    normalized = " ".join(text.strip().split())
    lowered = normalized.lower()

    if DEVICE_TEXT_PATTERN.search(normalized):
        return BotReply(
            text=resolve_device_command(
                telegram_user_id=telegram_user_id,
                task_client=task_client,
            )
        )

    if QUEUE_TEXT_PATTERN.search(normalized):
        return BotReply(
            text=resolve_queue_command(
                telegram_user_id=telegram_user_id,
                task_client=task_client,
            )
        )

    if LAST_TEXT_PATTERN.search(normalized):
        return BotReply(
            text=resolve_last_command(
                telegram_user_id=telegram_user_id,
                task_client=task_client,
            )
        )

    if APPS_TEXT_PATTERN.search(normalized):
        return build_app_catalog_reply(task_client, telegram_user_id)

    cancel_match = CANCEL_TEXT_PATTERN.search(normalized)
    if cancel_match is not None:
        task_id = cancel_match.group(1)
        result = task_client.cancel_task(task_id)

        if not getattr(result, "found", False):
            return BotReply(text=get_task_not_found_text())

        if getattr(result, "status", None) == "cancel_requested":
            return BotReply(text=get_cancel_requested_task_text(task_id))

        if getattr(result, "status", None) == "cancelled":
            return BotReply(text=get_cancelled_task_text(task_id))

        status_text = map_task_status_response(result)
        return BotReply(text=status_text) if status_text is not None else None

    open_match = OPEN_TARGET_PATTERN.fullmatch(normalized)
    if open_match is None:
        return None

    query = open_match.group(1).strip()
    site_url = try_match_known_site(query)
    if site_url is not None:
        return _create_task_from_intent(
            telegram_user_id=telegram_user_id,
            chat_id=chat_id,
            risk="medium",
            intent=f"open-site {site_url}",
            task_client=task_client,
            store=store,
        )

    catalog = task_client.fetch_app_catalog(telegram_user_id)
    app_matches = find_matching_apps(query, catalog)

    if len(app_matches) == 1:
        return _create_task_from_intent(
            telegram_user_id=telegram_user_id,
            chat_id=chat_id,
            risk="medium",
            intent=f"launch-app {app_matches[0].app_id}",
            task_client=task_client,
            store=store,
        )

    if len(app_matches) > 1:
        store.set_pending_app_selection(
            chat_id=chat_id,
            action="launch",
            candidates=to_pending_candidates(app_matches),
        )
        return BotReply(text=format_app_selection_text(app_matches))

    return None


def process_text_message(
    text: str,
    *,
    telegram_user_id: int,
    chat_id: int,
    task_client: SupportsTaskWorkflow,
    store: BotConversationStore,
    resolver: SupportsIntentResolver,
    chat_responder: SupportsChatResponder | None = None,
) -> BotReply | None:
    current_state = store.get(chat_id)
    normalized_text = text.strip()

    if current_state is not None and current_state.kind in {"auth_password", "auth_totp"}:
        result = task_client.submit_auth_input(
            telegram_user_id,
            chat_id,
            normalized_text,
            challenge_id=current_state.challenge_id,
        )
        return _reply_from_workflow_result(result, chat_id=chat_id, store=store)

    if current_state is not None and current_state.kind == "app_selection":
        if not NUMERIC_SELECTION_PATTERN.fullmatch(normalized_text):
            return BotReply(
                text=f"Введите число от 1 до {len(current_state.app_candidates)}."
            )

        selected_index = int(normalized_text) - 1
        if selected_index < 0 or selected_index >= len(current_state.app_candidates):
            return BotReply(
                text=f"Введите число от 1 до {len(current_state.app_candidates)}."
            )

        selected = current_state.app_candidates[selected_index]
        store.clear(chat_id)
        return _create_task_from_intent(
            telegram_user_id=telegram_user_id,
            chat_id=chat_id,
            risk="medium",
            intent=f"launch-app {selected.app_id}",
            task_client=task_client,
            store=store,
        )

    operator_reply = _resolve_operator_text(
        text,
        telegram_user_id=telegram_user_id,
        chat_id=chat_id,
        task_client=task_client,
        store=store,
    )
    if operator_reply is not None:
        return operator_reply

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
        default_codex_intent = f"codex {normalized_text}"
        if (
            chat_responder is not None
            and resolution.intent == default_codex_intent
            and not message_explicitly_requests_codex(text)
            and not message_requires_codex(text)
        ):
            return BotReply(
                text=chat_responder.reply(
                    normalized_text,
                    owner_profile_context=task_client.fetch_owner_profile_context(
                        telegram_user_id
                    ),
                )
            )

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

        parts = callback_data.split(":")
        challenge_id: str | None = None

        if len(parts) == 2:
            _, decision = parts
            challenge_id = current_state.challenge_id
        elif len(parts) == 3:
            _, challenge_id, decision = parts
        else:
            return BotReply(text="Не удалось понять выбранное действие.")

        if decision not in {"confirm", "decline"}:
            return BotReply(text="Не удалось понять выбранное действие.")

        if (
            current_state.challenge_id is not None
            and challenge_id is not None
            and current_state.challenge_id != challenge_id
        ):
            return BotReply(text="Подтверждение уже неактуально. Отправьте задачу заново.")

        result = task_client.submit_decision(
            telegram_user_id,
            chat_id,
            decision,
            challenge_id=challenge_id,
        )
        return _reply_from_workflow_result(result, chat_id=chat_id, store=store)

    if callback_data.startswith("kill:"):
        task_id = callback_data.split(":", 1)[1]
        result = task_client.cancel_task(task_id)

        if not getattr(result, "found", False):
            return BotReply(text=get_task_not_found_text())

        if getattr(result, "status", None) == "cancel_requested":
            return BotReply(text=get_cancel_requested_task_text(task_id))

        if getattr(result, "status", None) == "cancelled":
            return BotReply(text=get_cancelled_task_text(task_id))

        status_text = map_task_status_response(result)
        return BotReply(text=status_text) if status_text is not None else None

    if callback_data.startswith("launch-app:"):
        app_id = callback_data.split(":", 1)[1]
        return _create_task_from_intent(
            telegram_user_id=telegram_user_id,
            chat_id=chat_id,
            risk="medium",
            intent=f"launch-app {app_id}",
            task_client=task_client,
            store=store,
        )

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
