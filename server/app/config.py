from dataclasses import dataclass
from os import getenv


@dataclass(frozen=True, slots=True)
class Settings:
    app_name: str = "Karpik Server"
    environment: str = "development"
    api_prefix: str = "/api"


def get_settings() -> Settings:
    return Settings(
        app_name=getenv("KARPIK_APP_NAME", "Karpik Server"),
        environment=getenv("KARPIK_ENV", "development"),
        api_prefix=getenv("KARPIK_API_PREFIX", "/api"),
    )
