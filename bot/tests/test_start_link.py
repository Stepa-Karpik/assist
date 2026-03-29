from app.handlers.start import (
    get_start_link_failure_text,
    get_start_link_success_text,
    resolve_start_command,
)


class FakeTaskClient:
    def __init__(self, paired: bool, device_id: str | None = None, device_label: str | None = None) -> None:
        self.paired = paired
        self.device_id = device_id
        self.device_label = device_label
        self.calls: list[dict[str, object]] = []

    def consume_start_link(self, token: str, telegram_user_id: int):
        self.calls.append(
            {
                "token": token,
                "telegram_user_id": telegram_user_id,
            }
        )
        return {
            "paired": self.paired,
            "device_id": self.device_id,
            "device_label": self.device_label,
        }


def test_resolve_start_command_pairs_device_from_deep_link_token() -> None:
    task_client = FakeTaskClient(
        paired=True,
        device_id="desktop-main",
        device_label="Stepa Desktop",
    )

    response = resolve_start_command(
        "/start pair_token-123",
        telegram_user_id=42,
        task_client=task_client,
    )

    assert response == get_start_link_success_text("Stepa Desktop")
    assert task_client.calls == [
        {
            "token": "token-123",
            "telegram_user_id": 42,
        }
    ]


def test_resolve_start_command_reports_invalid_or_expired_token() -> None:
    task_client = FakeTaskClient(paired=False)

    response = resolve_start_command(
        "/start pair_expired-token",
        telegram_user_id=42,
        task_client=task_client,
    )

    assert response == get_start_link_failure_text()
