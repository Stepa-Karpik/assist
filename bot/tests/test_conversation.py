from dataclasses import dataclass

from app.conversation import (
    BotButton,
    BotConversationStore,
    BotReply,
    ClarificationResolution,
    IntentResolution,
    process_callback_query,
    process_text_message,
)
from app.task_client import TaskStatusResult, TaskWorkflowResult


@dataclass
class FakeIntentResolver:
    next_result: IntentResolution

    def resolve(self, _text: str) -> IntentResolution:
        return self.next_result


class FakeTaskClient:
    def __init__(
        self,
        *,
        task_result: TaskWorkflowResult | None = None,
        auth_result: TaskWorkflowResult | None = None,
        decision_result: TaskWorkflowResult | None = None,
    ) -> None:
        self.task_result = task_result or TaskWorkflowResult(status="ignored")
        self.auth_result = auth_result or TaskWorkflowResult(status="ignored")
        self.decision_result = decision_result or TaskWorkflowResult(status="ignored")
        self.task_calls: list[dict[str, object]] = []
        self.auth_calls: list[dict[str, object]] = []
        self.decision_calls: list[dict[str, object]] = []

    def create_task(
        self, telegram_user_id: int, chat_id: int, risk: str, intent: str
    ) -> TaskWorkflowResult:
        self.task_calls.append(
            {
                "telegram_user_id": telegram_user_id,
                "chat_id": chat_id,
                "risk": risk,
                "intent": intent,
            }
        )
        return self.task_result

    def submit_auth_input(
        self,
        telegram_user_id: int,
        chat_id: int,
        value: str,
        challenge_id: str | None = None,
    ) -> TaskWorkflowResult:
        self.auth_calls.append(
            {
                "telegram_user_id": telegram_user_id,
                "chat_id": chat_id,
                "value": value,
                "challenge_id": challenge_id,
            }
        )
        return self.auth_result

    def submit_decision(
        self,
        telegram_user_id: int,
        chat_id: int,
        decision: str,
        challenge_id: str | None = None,
    ) -> TaskWorkflowResult:
        self.decision_calls.append(
            {
                "telegram_user_id": telegram_user_id,
                "chat_id": chat_id,
                "decision": decision,
                "challenge_id": challenge_id,
            }
        )
        return self.decision_result

    def fetch_task(self, task_id: str) -> TaskStatusResult:
        raise AssertionError(f"fetch_task is not used in this test: {task_id}")

    def fetch_latest_task(self, chat_id: int) -> TaskStatusResult:
        raise AssertionError(f"fetch_latest_task is not used in this test: {chat_id}")


def test_ambiguous_screenshot_message_returns_inline_screen_buttons() -> None:
    store = BotConversationStore()
    client = FakeTaskClient()
    resolver = FakeIntentResolver(
        IntentResolution(
            kind="clarification",
            risk="low",
            clarification=ClarificationResolution(kind="screenshot_scope"),
        )
    )

    reply = process_text_message(
        "скинь скриншот",
        telegram_user_id=42,
        chat_id=5001,
        task_client=client,
        store=store,
        resolver=resolver,
    )

    assert reply == BotReply(
        text="Какой экран отправить?",
        buttons=(
            BotButton(text="Экран 1", callback_data="screenshot:screen-1"),
            BotButton(text="Экран 2", callback_data="screenshot:screen-2"),
            BotButton(text="Оба", callback_data="screenshot:both"),
        ),
    )


def test_screenshot_callback_creates_task_for_selected_screen() -> None:
    store = BotConversationStore()
    store.set_pending_screenshot_choice(chat_id=5001)
    client = FakeTaskClient(
        task_result=TaskWorkflowResult(status="queued", task_id="task-7")
    )

    reply = process_callback_query(
        "screenshot:screen-2",
        telegram_user_id=42,
        chat_id=5001,
        task_client=client,
        store=store,
    )

    assert client.task_calls == [
        {
            "telegram_user_id": 42,
            "chat_id": 5001,
            "risk": "low",
            "intent": "screenshot screen-2",
        }
    ]
    assert reply == BotReply(text="Задача task-7 поставлена в очередь.")


def test_password_message_is_bound_to_the_current_challenge() -> None:
    store = BotConversationStore()
    store.set_pending_auth(chat_id=5001, step="password", challenge_id="challenge-1")
    client = FakeTaskClient(
        auth_result=TaskWorkflowResult(
            status="totp_required",
            challenge_id="challenge-1",
        )
    )

    reply = process_text_message(
        "secret-password",
        telegram_user_id=42,
        chat_id=5001,
        task_client=client,
        store=store,
        resolver=FakeIntentResolver(IntentResolution(kind="ignored")),
    )

    assert client.auth_calls == [
        {
            "telegram_user_id": 42,
            "chat_id": 5001,
            "value": "secret-password",
            "challenge_id": "challenge-1",
        }
    ]
    assert reply == BotReply(
        text="Пароль принят. Введите код из приложения-аутентификатора."
    )


def test_confirm_stage_returns_inline_buttons_with_challenge_id() -> None:
    store = BotConversationStore()
    store.set_pending_auth(chat_id=5001, step="totp", challenge_id="challenge-2")
    client = FakeTaskClient(
        auth_result=TaskWorkflowResult(
            status="confirm_required",
            challenge_id="challenge-2",
        )
    )

    reply = process_text_message(
        "123456",
        telegram_user_id=42,
        chat_id=5001,
        task_client=client,
        store=store,
        resolver=FakeIntentResolver(IntentResolution(kind="ignored")),
    )

    assert client.auth_calls == [
        {
            "telegram_user_id": 42,
            "chat_id": 5001,
            "value": "123456",
            "challenge_id": "challenge-2",
        }
    ]
    assert reply == BotReply(
        text="Код TOTP принят. Подтвердить выполнение задачи?",
        buttons=(
            BotButton(text="Подтвердить", callback_data="decision:challenge-2:confirm"),
            BotButton(text="Отклонить", callback_data="decision:challenge-2:decline"),
        ),
    )


def test_confirm_callback_submits_decision_for_matching_challenge() -> None:
    store = BotConversationStore()
    store.set_pending_confirm(chat_id=5001, challenge_id="challenge-2")
    client = FakeTaskClient(
        decision_result=TaskWorkflowResult(status="task_queued", task_id="task-9")
    )

    reply = process_callback_query(
        "decision:challenge-2:confirm",
        telegram_user_id=42,
        chat_id=5001,
        task_client=client,
        store=store,
    )

    assert client.decision_calls == [
        {
            "telegram_user_id": 42,
            "chat_id": 5001,
            "decision": "confirm",
            "challenge_id": "challenge-2",
        }
    ]
    assert reply == BotReply(text="Задача task-9 поставлена в очередь.")
