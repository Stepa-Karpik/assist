from __future__ import annotations

import asyncio
from contextlib import suppress
from dataclasses import dataclass
from typing import Protocol

from app.task_client import ConversationEventResult


@dataclass(slots=True)
class PendingConversationReply:
    event_id: str
    chat_id: int
    ack_message: object | None
    placeholder_message: object | None


class PendingConversationReplyStore:
    def __init__(self) -> None:
        self._items: dict[str, PendingConversationReply] = {}

    def register(self, item: PendingConversationReply) -> None:
        self._items[item.event_id] = item

    def get(self, event_id: str) -> PendingConversationReply | None:
        return self._items.get(event_id)

    def remove(self, event_id: str) -> None:
        self._items.pop(event_id, None)


class SupportsConversationEventClient(Protocol):
    def fetch_pending_conversation_events(self) -> list[ConversationEventResult]: ...

    def ack_conversation_event(self, event_id: str, revision: int) -> None: ...


def render_conversation_event_text(event: ConversationEventResult) -> str:
    if event.response_text and event.response_text.strip():
        return event.response_text

    if event.error_text and event.error_text.strip():
        return event.error_text

    if event.status == "completed":
        return "Ответ готов."

    if event.status == "failed":
        return "Не удалось подготовить ответ."

    if event.status == "cancelled":
        return "Ответ остановлен."

    return "Ассистент отвечает..."


def is_terminal_conversation_event(event: ConversationEventResult) -> bool:
    return event.status in {"completed", "failed", "cancelled"}


async def run_conversation_delivery_poll_loop(
    *,
    client: SupportsConversationEventClient,
    pending_store: PendingConversationReplyStore,
    send_message,
    poll_interval_seconds: float,
) -> None:
    while True:
        events = await asyncio.to_thread(client.fetch_pending_conversation_events)

        for event in events:
            text = render_conversation_event_text(event)
            pending = pending_store.get(event.event_id)

            try:
                if pending is not None and pending.placeholder_message is not None:
                    await pending.placeholder_message.edit_text(text)
                else:
                    await send_message(event.chat_id, text)
            except Exception:
                continue

            if is_terminal_conversation_event(event):
                if pending is not None and pending.ack_message is not None:
                    with suppress(Exception):
                        await pending.ack_message.delete()
                pending_store.remove(event.event_id)

            await asyncio.to_thread(
                client.ack_conversation_event, event.event_id, event.revision
            )

        await asyncio.sleep(poll_interval_seconds)
