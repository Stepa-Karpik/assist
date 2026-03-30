from __future__ import annotations

import logging
from typing import Any, Protocol


logger = logging.getLogger(__name__)


class SupportsReplyMessage(Protocol):
    async def answer(self, text: str, reply_markup: Any = None): ...


class SupportsEditableMessage(Protocol):
    async def edit_text(self, text: str, reply_markup: Any = None): ...


async def publish_final_reply(
    *,
    message: SupportsReplyMessage,
    placeholder: SupportsEditableMessage,
    text: str,
    reply_markup=None,
    ack: SupportsEditableMessage | None = None,
) -> None:
    try:
        await placeholder.edit_text(text, reply_markup=reply_markup)
        return
    except Exception:
        logger.exception("Failed to edit placeholder reply; sending a new message instead")

    try:
        await message.answer(text, reply_markup=reply_markup)
        return
    except Exception:
        logger.exception("Failed to send a fallback reply message")

    if ack is not None:
        try:
            await ack.edit_text(text, reply_markup=reply_markup)
            return
        except Exception:
            logger.exception("Failed to rewrite the acknowledgment message with the final reply")

    raise RuntimeError("Failed to publish the final reply")
