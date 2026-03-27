from app.handlers.pair import (
    get_pair_failure_text,
    get_pair_success_text,
    resolve_pair_command,
)


class FakePairingClient:
    def __init__(self, result: str) -> None:
        self.result = result
        self.calls: list[dict[str, int | str]] = []

    def submit_pair_attempt(
        self, telegram_user_id: int, chat_id: int, code: str
    ) -> str:
        self.calls.append(
            {
                "telegram_user_id": telegram_user_id,
                "chat_id": chat_id,
                "code": code,
            }
        )
        return self.result


def test_resolve_pair_command_returns_success_for_paired_user():
    pairing_client = FakePairingClient("paired")

    response = resolve_pair_command(
        "/pair 123456",
        telegram_user_id=42,
        chat_id=1001,
        pairing_client=pairing_client,
    )

    assert response == get_pair_success_text()
    assert pairing_client.calls == [
        {
            "telegram_user_id": 42,
            "chat_id": 1001,
            "code": "123456",
        }
    ]


def test_resolve_pair_command_returns_failure_for_invalid_code():
    pairing_client = FakePairingClient("invalid_code")

    response = resolve_pair_command(
        "/pair wrong-code",
        telegram_user_id=42,
        chat_id=1001,
        pairing_client=pairing_client,
    )

    assert response == get_pair_failure_text()


def test_resolve_pair_command_ignores_missing_pairing_session():
    pairing_client = FakePairingClient("ignored")

    response = resolve_pair_command(
        "/pair 123456",
        telegram_user_id=42,
        chat_id=1001,
        pairing_client=pairing_client,
    )

    assert response is None
