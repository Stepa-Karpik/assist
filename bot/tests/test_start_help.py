from app.handlers.help import get_help_text
from app.handlers.start import get_start_text


def test_start_text_points_to_help() -> None:
    start_text = get_start_text()

    assert "/pair <code>" in start_text
    assert "/task <risk> <intent>" in start_text
    assert "/help" in start_text


def test_help_text_lists_supported_remote_commands() -> None:
    help_text = get_help_text()

    assert "/pair <code>" in help_text
    assert "/task low status" in help_text
    assert "/task low screenshot" in help_text
    assert "/task low read docs/notes/<file>" in help_text
    assert "/task low write-note <name> :: <text>" in help_text
    assert "/task high codex <prompt>" in help_text
    assert "/task high codex-write <prompt>" in help_text
    assert "/status [task_id]" in help_text
    assert "/auth <value>" in help_text
    assert "/confirm" in help_text
    assert "/decline" in help_text
