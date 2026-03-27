from app.handlers.help import get_help_text
from app.handlers.start import get_start_text


def test_start_text_points_to_pair_and_help() -> None:
    start_text = get_start_text()

    assert "/pair <code>" in start_text
    assert "обычными сообщениями" in start_text
    assert "/help" in start_text


def test_help_text_lists_natural_language_examples_and_manual_fallbacks() -> None:
    help_text = get_help_text()

    assert "скинь скриншот" in help_text
    assert "открой ютуб" in help_text
    assert "запусти osu" in help_text
    assert "скинь файл с рабочего стола hack.pptx" in help_text
    assert "/pc" in help_text
    assert "/queue" in help_text
    assert "/last" in help_text
    assert "/apps" in help_text
    assert "/kill <task_id>" in help_text
    assert "/task medium open-site https://youtube.com" in help_text
    assert "/task medium send-file desktop::hack.pptx" in help_text
    assert "/status [task_id]" in help_text
