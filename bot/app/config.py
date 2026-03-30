from dataclasses import dataclass
from os import getenv


@dataclass(frozen=True, slots=True)
class Settings:
    bot_token: str = ""
    bot_name: str = "Desktop_assist_bot"
    server_url: str = "http://127.0.0.1:8000"
    device_id: str = "desktop-local"
    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-chat"
    pair_wait_seconds: float = 5.0
    auth_wait_seconds: float = 5.0
    delivery_poll_seconds: float = 2.0


def get_float_env(name: str, default: float) -> float:
    raw_value = getenv(name)

    if raw_value is None:
        return default

    try:
        return float(raw_value)
    except ValueError:
        return default


def get_settings() -> Settings:
    return Settings(
        bot_token=getenv("KARPIK_TELEGRAM_TOKEN", ""),
        bot_name=getenv("KARPIK_BOT_NAME", "Desktop_assist_bot"),
        server_url=getenv("KARPIK_SERVER_URL", "http://127.0.0.1:8000"),
        device_id=getenv("KARPIK_DEVICE_ID", "desktop-local"),
        deepseek_api_key=getenv("DEEPSEEK_API_KEY", ""),
        deepseek_model=getenv("DEEPSEEK_MODEL", "deepseek-chat"),
        pair_wait_seconds=get_float_env("KARPIK_PAIR_WAIT_SECONDS", 5.0),
        auth_wait_seconds=get_float_env("KARPIK_AUTH_WAIT_SECONDS", 5.0),
        delivery_poll_seconds=get_float_env("KARPIK_DELIVERY_POLL_SECONDS", 2.0),
    )
