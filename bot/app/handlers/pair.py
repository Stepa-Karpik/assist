import re

PAIR_COMMAND_PATTERN = re.compile(r"^/pair(?:@\w+)?\s+([A-Za-z0-9_-]+)\s*$")


def parse_pair_command(text: str) -> str | None:
    match = PAIR_COMMAND_PATTERN.fullmatch(text.strip())

    if not match:
        return None

    return match.group(1)


def get_pair_success_text(code: str) -> str:
    return f"Pairing code received: {code}. Verification flow will be added next."


def get_pair_failure_text() -> str:
    return "Send /pair <code> to start device pairing."
