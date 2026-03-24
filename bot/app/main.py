import asyncio
import base64
from contextlib import suppress

from aiogram import Bot, Dispatcher
from aiogram.filters import Command, CommandStart
from aiogram.types import BufferedInputFile, Message

from app.config import Settings, get_settings
from app.delivery import run_delivery_poll_loop
from app.delivery_client import DeliveryServerClient
from app.handlers.help import get_help_text
from app.handlers.messages import get_default_message
from app.handlers.pair import resolve_pair_command
from app.handlers.task import (
    resolve_auth_command,
    resolve_confirm_command,
    resolve_decline_command,
    resolve_status_command,
    resolve_task_command,
)
from app.handlers.start import get_start_text
from app.pairing_client import PairingServerClient
from app.task_client import TaskServerClient


def create_dispatcher(
    settings: Settings | None = None,
    pairing_client: PairingServerClient | None = None,
    task_client: TaskServerClient | None = None,
) -> Dispatcher:
    resolved_settings = settings or get_settings()
    resolved_pairing_client = pairing_client or PairingServerClient(
        server_url=resolved_settings.server_url,
        device_id=resolved_settings.device_id,
        wait_seconds=resolved_settings.pair_wait_seconds,
    )
    resolved_task_client = task_client or TaskServerClient(
        server_url=resolved_settings.server_url,
        device_id=resolved_settings.device_id,
        wait_seconds=resolved_settings.auth_wait_seconds,
    )
    dispatcher = Dispatcher()

    @dispatcher.message(CommandStart())
    async def start_handler(message: Message) -> None:
        await message.answer(get_start_text())

    @dispatcher.message(Command("help"))
    async def help_handler(message: Message) -> None:
        await message.answer(get_help_text())

    @dispatcher.message(Command("pair"))
    async def pair_handler(message: Message) -> None:
        if message.from_user is None:
            return

        response = await asyncio.to_thread(
            resolve_pair_command,
            message.text or "",
            telegram_user_id=message.from_user.id,
            chat_id=message.chat.id,
            pairing_client=resolved_pairing_client,
        )

        if response is not None:
            await message.answer(response)

    @dispatcher.message(Command("task"))
    async def task_handler(message: Message) -> None:
        if message.from_user is None:
            return

        response = await asyncio.to_thread(
            resolve_task_command,
            message.text or "",
            telegram_user_id=message.from_user.id,
            chat_id=message.chat.id,
            task_client=resolved_task_client,
        )

        if response is not None:
            await message.answer(response)

    @dispatcher.message(Command("auth"))
    async def auth_handler(message: Message) -> None:
        if message.from_user is None:
            return

        response = await asyncio.to_thread(
            resolve_auth_command,
            message.text or "",
            telegram_user_id=message.from_user.id,
            chat_id=message.chat.id,
            task_client=resolved_task_client,
        )

        if response is not None:
            await message.answer(response)

    @dispatcher.message(Command("confirm"))
    async def confirm_handler(message: Message) -> None:
        if message.from_user is None:
            return

        response = await asyncio.to_thread(
            resolve_confirm_command,
            message.text or "",
            telegram_user_id=message.from_user.id,
            chat_id=message.chat.id,
            task_client=resolved_task_client,
        )

        if response is not None:
            await message.answer(response)

    @dispatcher.message(Command("decline"))
    async def decline_handler(message: Message) -> None:
        if message.from_user is None:
            return

        response = await asyncio.to_thread(
            resolve_decline_command,
            message.text or "",
            telegram_user_id=message.from_user.id,
            chat_id=message.chat.id,
            task_client=resolved_task_client,
        )

        if response is not None:
            await message.answer(response)

    @dispatcher.message(Command("status"))
    async def status_handler(message: Message) -> None:
        if message.from_user is None:
            return

        response = await asyncio.to_thread(
            resolve_status_command,
            message.text or "",
            telegram_user_id=message.from_user.id,
            chat_id=message.chat.id,
            task_client=resolved_task_client,
        )

        if response is not None:
            await message.answer(response)

    @dispatcher.message()
    async def message_handler(message: Message) -> None:
        response = get_default_message()

        if response is not None:
            await message.answer(response)

    return dispatcher


async def main() -> None:
    settings = get_settings()

    if not settings.bot_token:
        raise RuntimeError("KARPIK_TELEGRAM_TOKEN is not set")

    bot = Bot(token=settings.bot_token)
    dispatcher = create_dispatcher(settings=settings)
    delivery_client = DeliveryServerClient(
        server_url=settings.server_url,
        device_id=settings.device_id,
        wait_seconds=settings.auth_wait_seconds,
    )
    delivery_task = asyncio.create_task(
        run_delivery_poll_loop(
            client=delivery_client,
            send_message=lambda chat_id, text: bot.send_message(chat_id, text),
            send_photo=lambda chat_id, caption, event: bot.send_photo(
                chat_id,
                BufferedInputFile(
                    base64.b64decode(event.artifact_base64 or ""),
                    filename=event.artifact_file_name or "artifact.png",
                ),
                caption=caption,
            ),
            poll_interval_seconds=settings.delivery_poll_seconds,
        )
    )

    try:
        await dispatcher.start_polling(bot)
    finally:
        delivery_task.cancel()
        with suppress(asyncio.CancelledError):
            await delivery_task


if __name__ == "__main__":
    asyncio.run(main())
