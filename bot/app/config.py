from dataclasses import dataclass
from os import getenv


@dataclass(frozen=True, slots=True)
class Settings:
    bot_token: str = ""
    bot_name: str = "Karpik"


def get_settings() -> Settings:
    return Settings(
        bot_token=getenv("KARPIK_TELEGRAM_TOKEN", ""),
        bot_name=getenv("KARPIK_BOT_NAME", "Karpik"),
    )
