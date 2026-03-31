import asyncio

from app.conversation_delivery import (
    PendingConversationReply,
    PendingConversationReplyStore,
    render_conversation_event_text,
    run_conversation_delivery_poll_loop,
)
from app.task_client import ConversationEventResult


class FakeConversationClient:
    def __init__(self, *, events: list[ConversationEventResult] | None = None) -> None:
        self.events = events or []
        self.ack_calls: list[tuple[str, int]] = []

    def fetch_pending_conversation_events(self) -> list[ConversationEventResult]:
        return list(self.events)

    def ack_conversation_event(self, event_id: str, revision: int) -> None:
        self.ack_calls.append((event_id, revision))


class FakeEditableMessage:
    def __init__(self) -> None:
        self.edits: list[str] = []
        self.deleted = False

    async def edit_text(self, text: str) -> None:
        self.edits.append(text)

    async def delete(self) -> None:
        self.deleted = True


def test_render_conversation_event_text_prefers_response_text() -> None:
    event = ConversationEventResult(
        event_id="conv-1",
        device_id="desktop-local",
        chat_id=5001,
        telegram_user_id=101,
        prompt="Привет",
        status="completed",
        revision=2,
        response_text="Привет. Чем помочь?",
    )

    assert render_conversation_event_text(event) == "Привет. Чем помочь?"


def test_conversation_delivery_loop_edits_placeholder_and_acks_revision() -> None:
    event = ConversationEventResult(
        event_id="conv-2",
        device_id="desktop-local",
        chat_id=5001,
        telegram_user_id=101,
        prompt="Сколько стран в мире?",
        status="completed",
        revision=1,
        response_text="Обычно считают 195 государств.",
    )
    client = FakeConversationClient(events=[event])
    pending_store = PendingConversationReplyStore()
    ack_message = FakeEditableMessage()
    placeholder_message = FakeEditableMessage()
    pending_store.register(
        PendingConversationReply(
            event_id="conv-2",
            chat_id=5001,
            ack_message=ack_message,
            placeholder_message=placeholder_message,
        )
    )
    sent_messages: list[tuple[int, str]] = []

    async def sender(chat_id: int, text: str) -> None:
        sent_messages.append((chat_id, text))

    async def run_once() -> None:
        task = asyncio.create_task(
            run_conversation_delivery_poll_loop(
                client=client,
                pending_store=pending_store,
                send_message=sender,
                poll_interval_seconds=0.01,
            )
        )
        await asyncio.sleep(0.02)
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    asyncio.run(run_once())

    assert placeholder_message.edits == ["Обычно считают 195 государств."]
    assert ack_message.deleted is True
    assert sent_messages == []
    assert client.ack_calls == [("conv-2", 1)]
    assert pending_store.get("conv-2") is None
