from app.task_client import StartLinkResult


def get_start_text() -> str:
    return (
        "Karpik на связи. Для первого подключения нажмите «Открыть Telegram» в приложении. "
        "Если deep link недоступен, используйте /pair <code>. "
        "После привязки можно писать обычными сообщениями, например: "
        '"скинь скриншот", "скинь файл hack.pptx" или "придумай название фичи". '
        "Список возможностей и ручных команд: /help."
    )


def get_start_link_success_text(device_label: str | None) -> str:
    target = device_label or "это устройство"
    return f"Telegram привязан к устройству «{target}». Можно продолжать работу."


def get_start_link_failure_text() -> str:
    return "Ссылка привязки недействительна или уже истекла. Откройте новую ссылку из приложения или используйте /pair <code>."


def resolve_start_command(
    text: str,
    *,
    telegram_user_id: int,
    task_client,
) -> str:
    parts = text.strip().split(maxsplit=1)
    payload = parts[1] if len(parts) == 2 else ""

    if payload.startswith("pair_"):
        result: StartLinkResult | dict[str, object] = task_client.consume_start_link(
            payload.removeprefix("pair_"),
            telegram_user_id,
        )

        if isinstance(result, dict):
            paired = result.get("paired") is True
            device_label = result.get("device_label")
        else:
            paired = result.paired
            device_label = result.device_label

        if paired:
            return get_start_link_success_text(
                device_label if isinstance(device_label, str) else None
            )

        return get_start_link_failure_text()

    return get_start_text()
