from dataclasses import dataclass

from app.conversation import (
    BotButton,
    BotConversationStore,
    BotReply,
    process_callback_query,
    process_text_message,
)
from app.intent_resolver import ClarificationResolution, IntentResolution
from app.task_client import DeviceStatusResult, TaskStatusResult, TaskSummaryResult, TaskWorkflowResult


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
        device_status_result: DeviceStatusResult | None = None,
        queue_result: list[TaskSummaryResult] | None = None,
        recent_result: list[TaskSummaryResult] | None = None,
        cancel_result: TaskStatusResult | None = None,
    ) -> None:
        self.task_result = task_result or TaskWorkflowResult(status="ignored")
        self.auth_result = auth_result or TaskWorkflowResult(status="ignored")
        self.decision_result = decision_result or TaskWorkflowResult(status="ignored")
        self.device_status_result = device_status_result or DeviceStatusResult(found=False)
        self.queue_result = queue_result or []
        self.recent_result = recent_result or []
        self.cancel_result = cancel_result or TaskStatusResult(found=False)
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

    def fetch_device_status(self) -> DeviceStatusResult:
        return self.device_status_result

    def fetch_active_queue(self) -> list[TaskSummaryResult]:
        return self.queue_result

    def fetch_recent_commands(self, limit: int = 5) -> list[TaskSummaryResult]:
        del limit
        return self.recent_result

    def cancel_task(self, task_id: str) -> TaskStatusResult:
        self.decision_calls.append(
            {
                "operator_action": "cancel",
                "task_id": task_id,
            }
        )
        return self.cancel_result


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
    client = FakeTaskClient(task_result=TaskWorkflowResult(status="queued", task_id="task-7"))

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
    assert reply == BotReply(text="Пароль принят. Введите код из приложения-аутентификатора.")


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


def test_text_message_can_return_pc_status_without_creating_task() -> None:
    store = BotConversationStore()
    client = FakeTaskClient(
        device_status_result=DeviceStatusResult(
            found=True,
            device_id="stepa-desktop",
            is_online=True,
            last_seen_at="2026-03-27T10:00:00Z",
            pending_count=1,
            attention_count=0,
        )
    )

    reply = process_text_message(
        "что с пк",
        telegram_user_id=42,
        chat_id=5001,
        task_client=client,
        store=store,
        resolver=FakeIntentResolver(IntentResolution(kind="ignored")),
    )

    assert reply is not None
    assert "ПК stepa-desktop" in (reply.text or "")
    assert client.task_calls == []


def test_text_message_can_return_queue_summary_without_creating_task() -> None:
    store = BotConversationStore()
    client = FakeTaskClient(
        queue_result=[
            TaskSummaryResult(
                task_id="task-1",
                status="running",
                intent="codex summarize release notes",
            )
        ]
    )

    reply = process_text_message(
        "что сейчас с задачами",
        telegram_user_id=42,
        chat_id=5001,
        task_client=client,
        store=store,
        resolver=FakeIntentResolver(IntentResolution(kind="ignored")),
    )

    assert reply is not None
    assert "task-1" in (reply.text or "")
    assert client.task_calls == []


def test_text_message_can_cancel_task_from_natural_language() -> None:
    store = BotConversationStore()
    client = FakeTaskClient(
        cancel_result=TaskStatusResult(
            found=True,
            task_id="task-77",
            status="cancel_requested",
        )
    )

    reply = process_text_message(
        "останови задачу task-77",
        telegram_user_id=42,
        chat_id=5001,
        task_client=client,
        store=store,
        resolver=FakeIntentResolver(IntentResolution(kind="ignored")),
    )

    assert reply == BotReply(text="Останавливаю задачу task-77.")
    assert client.decision_calls == [
        {
            "operator_action": "cancel",
            "task_id": "task-77",
        }
    ]
