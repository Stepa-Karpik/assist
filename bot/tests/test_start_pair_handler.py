from app.handlers.start import (
    get_start_text,
    resolve_start_pair_command,
)


class FakePairingClient:
    def __init__(self, result: str) -> None:
        self.result = result
        self.calls: list[dict[str, int | str]] = []

    def submit_pair_attempt(self, telegram_user_id: int, chat_id: int, code: str) -> str:
        self.calls.append(
            {
                "telegram_user_id": telegram_user_id,
                "chat_id": chat_id,
                "code": code,
            }
        )
        return self.result


def test_resolve_start_pair_command_returns_success_for_valid_payload() -> None:
    pairing_client = FakePairingClient("paired")

    response = resolve_start_pair_command(
        "/start pair_ABC123",
        telegram_user_id=42,
        chat_id=1001,
        pairing_client=pairing_client,
    )

    assert response == "Устройство привязано"
    assert pairing_client.calls == [
        {
            "telegram_user_id": 42,
            "chat_id": 1001,
            "code": "ABC123",
        }
    ]


def test_resolve_start_pair_command_returns_none_for_regular_start() -> None:
    pairing_client = FakePairingClient("paired")

    response = resolve_start_pair_command(
        "/start",
        telegram_user_id=42,
        chat_id=1001,
        pairing_client=pairing_client,
    )

    assert response is None
    assert pairing_client.calls == []


def test_start_text_mentions_start_link_and_pair_fallback() -> None:
    start_text = get_start_text()

    assert "/start pair_<код>" in start_text
    assert "/pair <code>" in start_text
