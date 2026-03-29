from dataclasses import dataclass
from os import getenv
from pathlib import Path


@dataclass(frozen=True, slots=True)
class Settings:
    app_name: str = "Karpik Server"
    environment: str = "development"
    api_prefix: str = "/api"
    state_file: Path = Path(__file__).resolve().parents[1] / ".tmp" / "runtime-state.json"
    database_url: str | None = None
    database_connect_timeout: int = 5
    telegram_bot_name: str = "Karpik"


def get_settings() -> Settings:
    return Settings(
        app_name=getenv("KARPIK_APP_NAME", "Karpik Server"),
        environment=getenv("KARPIK_ENV", "development"),
        api_prefix=getenv("KARPIK_API_PREFIX", "/api"),
        state_file=Path(
            getenv(
                "KARPIK_STATE_FILE",
                str(Path(__file__).resolve().parents[1] / ".tmp" / "runtime-state.json"),
            )
        ),
        database_url=getenv("KARPIK_DATABASE_URL"),
        database_connect_timeout=int(getenv("KARPIK_DATABASE_CONNECT_TIMEOUT", "5")),
        telegram_bot_name=getenv("KARPIK_BOT_NAME", "Karpik"),
    )
