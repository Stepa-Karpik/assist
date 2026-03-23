import asyncio

from aiogram import Bot, Dispatcher
from aiogram.filters import Command, CommandStart
from aiogram.types import Message

from app.config import Settings, get_settings
from app.handlers.messages import get_default_message
from app.handlers.pair import resolve_pair_command
from app.handlers.start import get_start_text
from app.pairing_client import PairingServerClient


def create_dispatcher(
    settings: Settings | None = None, pairing_client: PairingServerClient | None = None
) -> Dispatcher:
    resolved_settings = settings or get_settings()
    resolved_pairing_client = pairing_client or PairingServerClient(
        server_url=resolved_settings.server_url,
        device_id=resolved_settings.device_id,
        wait_seconds=resolved_settings.pair_wait_seconds,
    )
    dispatcher = Dispatcher()

    @dispatcher.message(CommandStart())
    async def start_handler(message: Message) -> None:
        await message.answer(get_start_text())

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
    await dispatcher.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
