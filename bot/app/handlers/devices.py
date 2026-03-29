from __future__ import annotations

import re
from typing import Protocol

from app.task_client import TrustedDeviceListResult

USE_COMMAND_PATTERN = re.compile(r"^/use(?:@\w+)?\s+(.+?)\s*$")


class SupportsDeviceSelection(Protocol):
    def fetch_trusted_devices(self, telegram_user_id: int) -> TrustedDeviceListResult: ...

    def use_device(
        self, telegram_user_id: int, device_id: str
    ) -> TrustedDeviceListResult | None: ...


def parse_use_command(text: str) -> str | None:
    match = USE_COMMAND_PATTERN.fullmatch(text.strip())
    return match.group(1).strip() if match is not None else None


def normalize_match_key(value: str) -> str:
    normalized = value.casefold().replace("ё", "е")
    normalized = re.sub(r"[^\w\s-]", " ", normalized)
    return " ".join(normalized.split())


def format_devices_text(result: TrustedDeviceListResult) -> str:
    if len(result.items) == 0:
        return "Для вас пока нет привязанных устройств. Откройте pairing на нужном ПК и отправьте /pair <code>."

    lines = ["Ваши устройства:"]

    for item in result.items:
        marker = "активно" if item.is_active else "доступно"
        owner_suffix = f" · {item.owner_label}" if item.owner_label else ""
        lines.append(
            f"- {item.device_label} ({item.device_id}) · {marker}{owner_suffix}"
        )

    if result.active_device_id is not None:
        lines.append(f"Активное устройство: {result.active_device_id}")

    lines.append("Чтобы переключиться, используйте /use <device_id>.")
    return "\n".join(lines)


def resolve_devices_command(
    *, telegram_user_id: int, task_client: SupportsDeviceSelection
) -> str:
    return format_devices_text(task_client.fetch_trusted_devices(telegram_user_id))


def resolve_use_command(
    text: str, *, telegram_user_id: int, task_client: SupportsDeviceSelection
) -> str:
    query = parse_use_command(text)

    if query is None:
        return "Используйте /use <device_id>."

    devices = task_client.fetch_trusted_devices(telegram_user_id)
    if len(devices.items) == 0:
        return "Для вас пока нет привязанных устройств."

    query_key = normalize_match_key(query)
    matches = [
        item
        for item in devices.items
        if query_key == normalize_match_key(item.device_id)
        or query_key == normalize_match_key(item.device_label)
        or query_key in normalize_match_key(item.device_id)
        or query_key in normalize_match_key(item.device_label)
    ]

    if len(matches) == 0:
        return "Не удалось найти такое устройство."

    if len(matches) > 1:
        return "Нашёл несколько устройств. Уточните device_id из /devices."

    selected = matches[0]
    updated = task_client.use_device(telegram_user_id, selected.device_id)
    if updated is None:
        return "Не удалось переключить активное устройство."

    return f"Активное устройство переключено на {selected.device_label}."
