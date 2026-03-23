from aiogram import Bot, Dispatcher
from aiogram.filters import Command, CommandStart
from aiogram.types import Message

from app.config import get_settings
from app.handlers.messages import get_default_message
from app.handlers.pair import get_pair_failure_text, get_pair_success_text, parse_pair_command
from app.handlers.start import get_start_text


def create_dispatcher() -> Dispatcher:
    dispatcher = Dispatcher()

    @dispatcher.message(CommandStart())
    async def start_handler(message: Message) -> None:
        await message.answer(get_start_text())

    @dispatcher.message(Command("pair"))
    async def pair_handler(message: Message) -> None:
        code = parse_pair_command(message.text or "")
        response = get_pair_success_text(code) if code else get_pair_failure_text()
        await message.answer(response)

    @dispatcher.message()
    async def message_handler(message: Message) -> None:
        await message.answer(get_default_message())

    return dispatcher


async def main() -> None:
    settings = get_settings()

    if not settings.bot_token:
        raise RuntimeError("KARPIK_TELEGRAM_TOKEN is not set")

    bot = Bot(token=settings.bot_token)
    dispatcher = create_dispatcher()
    await dispatcher.start_polling(bot)


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
