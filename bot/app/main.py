import asyncio
import base64
from contextlib import suppress

from aiogram import Bot, Dispatcher
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    BufferedInputFile,
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)

from app.config import Settings, get_settings
from app.chat_responder import DeepSeekChatResponder
from app.conversation import (
    BotConversationStore,
    BotReply,
    build_app_catalog_reply,
    process_callback_query,
    process_manual_auth_input,
    process_manual_decision,
    process_manual_task_command,
    process_text_message,
)
from app.delivery import run_delivery_poll_loop
from app.delivery_client import DeliveryServerClient
from app.handlers.help import get_help_text
from app.handlers.pair import resolve_pair_command
from app.handlers.start import get_start_text, resolve_start_pair_command
from app.handlers.task import (
    is_device_command,
    is_last_command,
    is_queue_command,
    parse_auth_command,
    parse_cancel_command,
    parse_status_command,
    parse_task_command,
    resolve_cancel_command,
    resolve_device_command,
    resolve_last_command,
    resolve_queue_command,
    resolve_status_command,
)
from app.intent_resolver import DeepSeekIntentResolver, RuleBasedIntentResolver
from app.pairing_client import PairingServerClient
from app.task_client import TaskServerClient


def to_inline_keyboard(reply: BotReply) -> InlineKeyboardMarkup | None:
    if len(reply.buttons) == 0:
        return None

    rows: list[list[InlineKeyboardButton]] = []
    current_row: list[InlineKeyboardButton] = []

    for button in reply.buttons:
        current_row.append(
            InlineKeyboardButton(text=button.text, callback_data=button.callback_data)
        )

        if len(current_row) == 2:
            rows.append(current_row)
            current_row = []

    if current_row:
        rows.append(current_row)

    return InlineKeyboardMarkup(inline_keyboard=rows)


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
    resolved_intent_resolver = (
        DeepSeekIntentResolver(
            api_key=resolved_settings.deepseek_api_key,
            fallback_resolver=RuleBasedIntentResolver(),
            model=resolved_settings.deepseek_model,
        )
        if resolved_settings.deepseek_api_key
        else RuleBasedIntentResolver()
    )
    chat_responder = (
        DeepSeekChatResponder(
            api_key=resolved_settings.deepseek_api_key,
            model=resolved_settings.deepseek_model,
        )
        if resolved_settings.deepseek_api_key
        else None
    )
    conversation_store = BotConversationStore()
    dispatcher = Dispatcher()

    @dispatcher.message(CommandStart())
    async def start_handler(message: Message) -> None:
        if message.from_user is not None:
            response = await asyncio.to_thread(
                resolve_start_pair_command,
                message.text or "",
                telegram_user_id=message.from_user.id,
                chat_id=message.chat.id,
                pairing_client=resolved_pairing_client,
            )

            if response is not None:
                await message.answer(response)
                return

        await message.answer(get_start_text())

    @dispatcher.message(Command("help"))
    async def help_handler(message: Message) -> None:
        await message.answer(get_help_text())

    @dispatcher.message(Command("apps"))
    async def apps_handler(message: Message) -> None:
        reply = build_app_catalog_reply(resolved_task_client)
        await message.answer(reply.text or "", reply_markup=to_inline_keyboard(reply))

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

        parsed = parse_task_command(message.text or "")

        if parsed is None:
            await message.answer("Используйте /task <low|medium|high> <intent>.")
            return

        risk, intent = parsed
        response = await asyncio.to_thread(
            process_manual_task_command,
            telegram_user_id=message.from_user.id,
            chat_id=message.chat.id,
            risk=risk,
            intent=intent,
            task_client=resolved_task_client,
            store=conversation_store,
        )

        if response is not None:
            await message.answer(response.text or "", reply_markup=to_inline_keyboard(response))

    @dispatcher.message(Command("auth"))
    async def auth_handler(message: Message) -> None:
        if message.from_user is None:
            return

        value = parse_auth_command(message.text or "")

        if value is None:
            await message.answer("Используйте /auth <значение>.")
            return

        response = await asyncio.to_thread(
            process_manual_auth_input,
            telegram_user_id=message.from_user.id,
            chat_id=message.chat.id,
            value=value,
            task_client=resolved_task_client,
            store=conversation_store,
        )

        if response is not None:
            await message.answer(response.text or "", reply_markup=to_inline_keyboard(response))

    @dispatcher.message(Command("confirm"))
    async def confirm_handler(message: Message) -> None:
        if message.from_user is None:
            return

        response = await asyncio.to_thread(
            process_manual_decision,
            telegram_user_id=message.from_user.id,
            chat_id=message.chat.id,
            decision="confirm",
            task_client=resolved_task_client,
            store=conversation_store,
        )

        if response is not None:
            await message.answer(response.text or "", reply_markup=to_inline_keyboard(response))

    @dispatcher.message(Command("decline"))
    async def decline_handler(message: Message) -> None:
        if message.from_user is None:
            return

        response = await asyncio.to_thread(
            process_manual_decision,
            telegram_user_id=message.from_user.id,
            chat_id=message.chat.id,
            decision="decline",
            task_client=resolved_task_client,
            store=conversation_store,
        )

        if response is not None:
            await message.answer(response.text or "", reply_markup=to_inline_keyboard(response))

    @dispatcher.message(Command("status"))
    async def status_handler(message: Message) -> None:
        if message.from_user is None:
            return

        if parse_status_command(message.text or "") is None:
            await message.answer("Используйте /status [task_id].")
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

    @dispatcher.message(Command("pc"))
    @dispatcher.message(Command("device"))
    async def device_handler(message: Message) -> None:
        await message.answer(resolve_device_command(task_client=resolved_task_client))

    @dispatcher.message(Command("queue"))
    async def queue_handler(message: Message) -> None:
        await message.answer(resolve_queue_command(task_client=resolved_task_client))

    @dispatcher.message(Command("last"))
    async def last_handler(message: Message) -> None:
        await message.answer(resolve_last_command(task_client=resolved_task_client))

    @dispatcher.message(Command("kill"))
    async def kill_handler(message: Message) -> None:
        if parse_cancel_command(message.text or "") is None:
            await message.answer("Используйте /kill <task_id>.")
            return

        await message.answer(
            resolve_cancel_command(message.text or "", task_client=resolved_task_client)
        )

    @dispatcher.callback_query()
    async def callback_handler(callback: CallbackQuery) -> None:
        if callback.from_user is None or callback.message is None or callback.data is None:
            return

        response = await asyncio.to_thread(
            process_callback_query,
            callback.data,
            telegram_user_id=callback.from_user.id,
            chat_id=callback.message.chat.id,
            task_client=resolved_task_client,
            store=conversation_store,
        )
        await callback.answer()

        if response is not None:
            await callback.message.answer(
                response.text or "",
                reply_markup=to_inline_keyboard(response),
            )

    @dispatcher.message()
    async def message_handler(message: Message) -> None:
        if message.from_user is None:
            return

        text = message.text or ""

        if is_device_command(text):
            await message.answer(resolve_device_command(task_client=resolved_task_client))
            return

        if is_queue_command(text):
            await message.answer(resolve_queue_command(task_client=resolved_task_client))
            return

        if is_last_command(text):
            await message.answer(resolve_last_command(task_client=resolved_task_client))
            return

        response = await asyncio.to_thread(
            process_text_message,
            text,
            telegram_user_id=message.from_user.id,
            chat_id=message.chat.id,
            task_client=resolved_task_client,
            store=conversation_store,
            resolver=resolved_intent_resolver,
            chat_responder=chat_responder,
        )

        if response is not None:
            await message.answer(response.text or "", reply_markup=to_inline_keyboard(response))

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
            send_document=lambda chat_id, caption, event: bot.send_document(
                chat_id,
                BufferedInputFile(
                    base64.b64decode(event.artifact_base64 or ""),
                    filename=event.artifact_file_name or "artifact.bin",
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
