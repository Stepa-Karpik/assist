from app.config import get_settings


def test_default_bot_name_matches_public_handle(monkeypatch) -> None:
    monkeypatch.delenv("KARPIK_BOT_NAME", raising=False)

    settings = get_settings()

    assert settings.bot_name == "Desktop_assist_bot"
