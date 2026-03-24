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
    title = "Р“РѕС‚РѕРІРѕ" if event.kind == "task_done" else "РћС€РёР±РєР°"
    details = event.result_text if event.kind == "task_done" else event.error_text
    resolved_details = details or ("Р“РѕС‚РѕРІРѕ." if event.kind == "task_done" else "Р‘РµР· РґРµС‚Р°Р»РµР№.")
    return f"{title}: {event.task_id}\n{event.intent}\n\n{resolved_details}"


def has_image_artifact(event: DeliveryEvent) -> bool:
    return (
        event.artifact_kind == "image_base64"
        and isinstance(event.artifact_mime_type, str)
        and event.artifact_mime_type.startswith("image/")
        and isinstance(event.artifact_base64, str)
    )


def deliver_outbox_cycle(
    *,
    client: SupportsDeliveryClient,
    send_message: Callable[[int, str], None],
    send_photo: Callable[[int, str, DeliveryEvent], None] | None = None,
) -> None:
    for event in client.fetch_pending_events():
        text = render_delivery_text(event)

        try:
            if has_image_artifact(event) and send_photo is not None:
                send_photo(event.chat_id, text, event)
            else:
                send_message(event.chat_id, text)
        except Exception:
            continue

        client.ack_event(event.event_id)


async def run_delivery_poll_loop(
    *,
    client: DeliveryServerClient,
    send_message: Callable[[int, str], asyncio.Future[None] | asyncio.Task[None] | object],
    send_photo: Callable[[int, str, DeliveryEvent], asyncio.Future[None] | asyncio.Task[None] | object]
    | None = None,
    poll_interval_seconds: float,
) -> None:
    while True:
        events = await asyncio.to_thread(client.fetch_pending_events)

        for event in events:
            try:
                text = render_delivery_text(event)

                if has_image_artifact(event) and send_photo is not None:
                    await send_photo(event.chat_id, text, event)
                else:
                    await send_message(event.chat_id, text)
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
