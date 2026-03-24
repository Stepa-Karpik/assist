from __future__ import annotations

import asyncio
from collections.abc import Callable
from contextlib import suppress
from typing import Protocol

from app.delivery_client import DeliveryEvent, DeliveryServerClient


class SupportsDeliveryClient(Protocol):
    def fetch_pending_events(self) -> list[DeliveryEvent]: ...

    def ack_event(self, event_id: str) -> None: ...


def render_delivery_text(event: DeliveryEvent) -> str:
    title = "Готово" if event.kind == "task_done" else "Ошибка"
    details = event.result_text if event.kind == "task_done" else event.error_text
    resolved_details = details or ("Готово." if event.kind == "task_done" else "Без деталей.")
    return f"{title}: {event.task_id}\n{event.intent}\n\n{resolved_details}"


def deliver_outbox_cycle(
    *,
    client: SupportsDeliveryClient,
    send_message: Callable[[int, str], None],
) -> None:
    for event in client.fetch_pending_events():
        text = render_delivery_text(event)

        try:
            send_message(event.chat_id, text)
        except Exception:
            continue

        client.ack_event(event.event_id)


async def run_delivery_poll_loop(
    *,
    client: DeliveryServerClient,
    send_message: Callable[[int, str], asyncio.Future[None] | asyncio.Task[None] | object],
    poll_interval_seconds: float,
) -> None:
    while True:
        events = await asyncio.to_thread(client.fetch_pending_events)

        for event in events:
            try:
                await send_message(event.chat_id, render_delivery_text(event))
            except Exception:
                continue

            await asyncio.to_thread(client.ack_event, event.event_id)

        await asyncio.sleep(poll_interval_seconds)


async def stop_background_task(task: asyncio.Task[None] | None) -> None:
    if task is None:
        return

    task.cancel()

    with suppress(asyncio.CancelledError):
        await task
