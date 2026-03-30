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


@dataclass
class FakeAppCatalogEntry:
    app_id: str
    display_name: str
    aliases: tuple[str, ...]
    linked: bool = True


@dataclass
class FakeChatResponder:
    reply_text: str

    def __post_init__(self) -> None:
        self.calls: list[dict[str, str | None]] = []

    def reply(
        self,
        text: str,
        owner_profile_context: str | None = None,
        knowledge_context: str | None = None,
    ) -> str:
        self.calls.append(
            {
                "text": text,
                "owner_profile_context": owner_profile_context,
                "knowledge_context": knowledge_context,
            }
        )
        return self.reply_text


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
        app_catalog: list[FakeAppCatalogEntry] | None = None,
        owner_profile_context: str | None = None,
        publish_memory_error: Exception | None = None,
    ) -> None:
        self.task_result = task_result or TaskWorkflowResult(status="ignored")
        self.auth_result = auth_result or TaskWorkflowResult(status="ignored")
        self.decision_result = decision_result or TaskWorkflowResult(status="ignored")
        self.device_status_result = device_status_result or DeviceStatusResult(found=False)
        self.queue_result = queue_result or []
        self.recent_result = recent_result or []
        self.cancel_result = cancel_result or TaskStatusResult(found=False)
        self.app_catalog = app_catalog or []
        self.owner_profile_context = owner_profile_context
        self.publish_memory_error = publish_memory_error
        self.conversation_memory_calls: list[dict[str, object]] = []
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

    def fetch_app_catalog(self) -> list[FakeAppCatalogEntry]:
        return self.app_catalog

    def fetch_owner_profile_context(self) -> str | None:
        return self.owner_profile_context

    def publish_conversation_memory(
        self,
        *,
        prompt: str,
        answer: str,
        source_urls: list[str],
        memory_writes: list[dict[str, str]],
    ) -> None:
        if self.publish_memory_error is not None:
            raise self.publish_memory_error
        self.conversation_memory_calls.append(
            {
                "prompt": prompt,
                "answer": answer,
                "source_urls": source_urls,
                "memory_writes": memory_writes,
            }
        )


def test_ambiguous_screenshot_message_returns_inline_screen_buttons() -> None:
    store = BotConversationStore()
    client = FakeTaskClient(owner_profile_context="Владелец: Степан Карпов")
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


def test_conversational_reply_publishes_memory_event() -> None:
    store = BotConversationStore()
    client = FakeTaskClient(owner_profile_context="Владелец: Степан Карпов")
    responder = FakeChatResponder(
        reply_text="Привет, Степан. По FastAPI недавно обновились release notes."
    )

    reply = process_text_message(
        "меня зовут Карпов Степан Викторович, я программист на Python и использую FastAPI, знаешь что нибудь про его свежие обновления?",
        telegram_user_id=42,
        chat_id=5001,
        task_client=client,
        store=store,
        resolver=FakeIntentResolver(
            IntentResolution(
                kind="task",
                risk="high",
                intent="codex меня зовут Карпов Степан Викторович, я программист на Python и использую FastAPI, знаешь что нибудь про его свежие обновления?",
            )
        ),
        chat_responder=responder,
    )

    assert reply is not None
    assert "FastAPI" in (reply.text or "")
    assert len(client.conversation_memory_calls) == 1
    assert client.conversation_memory_calls[0]["prompt"] == (
        "меня зовут Карпов Степан Викторович, я программист на Python и использую FastAPI, знаешь что нибудь про его свежие обновления?"
    )
    writes = client.conversation_memory_calls[0]["memory_writes"]
    assert {
        "target": "assist/profile",
        "key": "full_name",
        "value": "Карпов Степан Викторович",
    } in writes


def test_text_message_lists_linked_apps_with_inline_buttons() -> None:
    store = BotConversationStore()
    client = FakeTaskClient(
        app_catalog=[
            FakeAppCatalogEntry(
                app_id="app-osu",
                display_name="osu! lazer",
                aliases=("osu", "осу", "osu lazer"),
                linked=True,
            ),
            FakeAppCatalogEntry(
                app_id="app-code",
                display_name="Visual Studio Code",
                aliases=("code", "код"),
                linked=True,
            ),
            FakeAppCatalogEntry(
                app_id="app-discovered",
                display_name="Some Discovered App",
                aliases=("some app",),
                linked=False,
            ),
        ]
    )

    reply = process_text_message(
        "приложения",
        telegram_user_id=42,
        chat_id=5001,
        task_client=client,
        store=store,
        resolver=FakeIntentResolver(IntentResolution(kind="ignored")),
    )

    assert reply is not None
    assert "Связанные приложения" in (reply.text or "")
    assert reply.buttons == (
        BotButton(text="osu! lazer", callback_data="launch-app:app-osu"),
        BotButton(text="Visual Studio Code", callback_data="launch-app:app-code"),
    )


def test_text_message_launches_unique_app_match_as_medium_task() -> None:
    store = BotConversationStore()
    client = FakeTaskClient(
        task_result=TaskWorkflowResult(status="queued", task_id="task-app-1"),
        app_catalog=[
            FakeAppCatalogEntry(
                app_id="app-osu",
                display_name="osu! lazer",
                aliases=("osu", "осу", "osu lazer", "осу лазер"),
                linked=True,
            )
        ],
    )

    reply = process_text_message(
        "запусти осу",
        telegram_user_id=42,
        chat_id=5001,
        task_client=client,
        store=store,
        resolver=FakeIntentResolver(IntentResolution(kind="ignored")),
    )

    assert reply == BotReply(text="Задача task-app-1 поставлена в очередь.")
    assert client.task_calls == [
        {
            "telegram_user_id": 42,
            "chat_id": 5001,
            "risk": "medium",
            "intent": "launch-app app-osu",
        }
    ]


def test_text_message_creates_pending_app_selection_when_multiple_candidates_found() -> None:
    store = BotConversationStore()
    client = FakeTaskClient(
        app_catalog=[
            FakeAppCatalogEntry(
                app_id="app-osu",
                display_name="osu! lazer",
                aliases=("osu", "осу"),
                linked=True,
            ),
            FakeAppCatalogEntry(
                app_id="app-osu-dev",
                display_name="osu! dev",
                aliases=("osu", "осу", "osu dev"),
                linked=False,
            ),
        ]
    )

    reply = process_text_message(
        "запусти osu",
        telegram_user_id=42,
        chat_id=5001,
        task_client=client,
        store=store,
        resolver=FakeIntentResolver(IntentResolution(kind="ignored")),
    )

    assert reply is not None
    assert "1." in (reply.text or "")
    assert "2." in (reply.text or "")
    assert client.task_calls == []


def test_numeric_reply_launches_selected_pending_app_candidate() -> None:
    store = BotConversationStore()
    client = FakeTaskClient(
        task_result=TaskWorkflowResult(status="queued", task_id="task-app-2"),
        app_catalog=[
            FakeAppCatalogEntry(
                app_id="app-osu",
                display_name="osu! lazer",
                aliases=("osu", "осу"),
                linked=True,
            ),
            FakeAppCatalogEntry(
                app_id="app-osu-dev",
                display_name="osu! dev",
                aliases=("osu", "осу", "osu dev"),
                linked=False,
            ),
        ],
    )

    first_reply = process_text_message(
        "запусти osu",
        telegram_user_id=42,
        chat_id=5001,
        task_client=client,
        store=store,
        resolver=FakeIntentResolver(IntentResolution(kind="ignored")),
    )
    assert first_reply is not None

    second_reply = process_text_message(
        "2",
        telegram_user_id=42,
        chat_id=5001,
        task_client=client,
        store=store,
        resolver=FakeIntentResolver(IntentResolution(kind="ignored")),
    )

    assert second_reply == BotReply(text="Задача task-app-2 поставлена в очередь.")
    assert client.task_calls == [
        {
            "telegram_user_id": 42,
            "chat_id": 5001,
            "risk": "medium",
            "intent": "launch-app app-osu-dev",
        }
    ]


def test_text_message_opens_confident_site_request_as_medium_task() -> None:
    store = BotConversationStore()
    client = FakeTaskClient(task_result=TaskWorkflowResult(status="queued", task_id="task-site-1"))

    reply = process_text_message(
        "открой ютуб",
        telegram_user_id=42,
        chat_id=5001,
        task_client=client,
        store=store,
        resolver=FakeIntentResolver(IntentResolution(kind="ignored")),
    )

    assert reply == BotReply(text="Задача task-site-1 поставлена в очередь.")
    assert client.task_calls == [
        {
            "telegram_user_id": 42,
            "chat_id": 5001,
            "risk": "medium",
            "intent": "open-site https://youtube.com",
        }
    ]


def test_generic_message_uses_chat_responder_when_codex_is_not_forced() -> None:
    store = BotConversationStore()
    client = FakeTaskClient(owner_profile_context="Владелец: Степан Карпов")
    chat_responder = FakeChatResponder("Привет. Чем помочь?")

    reply = process_text_message(
        "привет",
        telegram_user_id=42,
        chat_id=5001,
        task_client=client,
        store=store,
        resolver=FakeIntentResolver(IntentResolution(kind="task", risk="high", intent="codex привет")),
        chat_responder=chat_responder,
    )

    assert reply == BotReply(text="Привет. Чем помочь?")
    assert client.task_calls == []
    assert chat_responder.calls == [
        {
            "text": "привет",
            "owner_profile_context": "Владелец: Степан Карпов",
            "knowledge_context": None,
        }
    ]


def test_explicit_codex_message_still_creates_task_even_with_chat_responder() -> None:
    store = BotConversationStore()
    client = FakeTaskClient(task_result=TaskWorkflowResult(status="queued", task_id="task-codex-1"))
    chat_responder = FakeChatResponder("unused")

    reply = process_text_message(
        "кодекс, объясни стек",
        telegram_user_id=42,
        chat_id=5001,
        task_client=client,
        store=store,
        resolver=FakeIntentResolver(
            IntentResolution(kind="task", risk="high", intent="codex кодекс, объясни стек")
        ),
        chat_responder=chat_responder,
    )

    assert reply == BotReply(text="Задача task-codex-1 поставлена в очередь.")
    assert client.task_calls == [
        {
            "telegram_user_id": 42,
            "chat_id": 5001,
            "risk": "high",
            "intent": "codex кодекс, объясни стек",
        }
    ]
    assert chat_responder.calls == []


def test_article_message_that_mentions_codex_stays_conversational() -> None:
    store = BotConversationStore()
    client = FakeTaskClient(owner_profile_context="Р’Р»Р°РґРµР»РµС†: РЎС‚РµРїР°РЅ РљР°СЂРїРѕРІ")
    chat_responder = FakeChatResponder(
        "Да, это материал про то, как Codex работает на практике."
    )

    reply = process_text_message(
        "читаю на хабре https://habr.com/ru/articles/912576/, например про то, как работает codex, знаешь что нибудь об этом?",
        telegram_user_id=42,
        chat_id=5001,
        task_client=client,
        store=store,
        resolver=FakeIntentResolver(
            IntentResolution(
                kind="task",
                risk="high",
                intent="codex читаю на хабре https://habr.com/ru/articles/912576/, например про то, как работает codex, знаешь что нибудь об этом?",
            )
        ),
        chat_responder=chat_responder,
    )

    assert reply == BotReply(text="Да, это материал про то, как Codex работает на практике.")
    assert client.task_calls == []
    assert len(client.conversation_memory_calls) == 1


def test_conversational_reply_still_returns_when_memory_publish_fails() -> None:
    store = BotConversationStore()
    client = FakeTaskClient(
        owner_profile_context="Р’Р»Р°РґРµР»РµС†: РЎС‚РµРїР°РЅ РљР°СЂРїРѕРІ",
        publish_memory_error=RuntimeError("memory publish failed"),
    )
    responder = FakeChatResponder("В мире обычно считают 195 государств.")

    reply = process_text_message(
        "сколько стран в мире?",
        telegram_user_id=42,
        chat_id=5001,
        task_client=client,
        store=store,
        resolver=FakeIntentResolver(
            IntentResolution(kind="task", risk="high", intent="codex сколько стран в мире?")
        ),
        chat_responder=responder,
    )

    assert reply == BotReply(text="В мире обычно считают 195 государств.")
    assert client.task_calls == []
