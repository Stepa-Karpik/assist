from __future__ import annotations

import re
from dataclasses import asdict, dataclass


URL_PATTERN = re.compile(r"https?://[^\s)\]]+")
FULL_NAME_PATTERN = re.compile(
    r"\bменя\s+зовут\s+([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){1,2})",
    re.IGNORECASE,
)
ROLE_PATTERN = re.compile(
    r"\bя\s+(?:работаю|занимаюсь|программист|разработчик|инженер)(?:\s+на)?\s+([A-Za-zА-Яа-яЁё0-9+.\-/,\s]+)",
    re.IGNORECASE,
)

STACK_LABELS: tuple[tuple[str, str], ...] = (
    ("fastapi", "FastAPI"),
    ("python", "Python"),
    ("typescript", "TypeScript"),
    ("react", "React"),
    ("mcp", "MCP"),
    ("docker", "Docker"),
    ("postgres", "PostgreSQL"),
)


@dataclass(frozen=True, slots=True)
class ConversationMemoryWrite:
    target: str
    key: str
    value: str


def extract_memory_writes(text: str) -> list[ConversationMemoryWrite]:
    writes: list[ConversationMemoryWrite] = []
    normalized = text.strip()

    full_name_match = FULL_NAME_PATTERN.search(normalized)
    if full_name_match is not None:
        writes.append(
            ConversationMemoryWrite(
                target="assist/profile",
                key="full_name",
                value=full_name_match.group(1).strip(),
            )
        )

    role_match = ROLE_PATTERN.search(normalized)
    if role_match is not None:
        writes.append(
            ConversationMemoryWrite(
                target="assist/profile",
                key="occupation",
                value=role_match.group(1).strip(" ,."),
            )
        )

    detected_stack = [
        label for needle, label in STACK_LABELS if needle in normalized.casefold()
    ]
    if detected_stack:
        writes.append(
            ConversationMemoryWrite(
                target="assist/preferences",
                key="preferred_stack",
                value=", ".join(dict.fromkeys(detected_stack)),
            )
        )

    for url in extract_source_urls(text):
        writes.append(
            ConversationMemoryWrite(
                target="assist/docs/websites",
                key="trusted_source",
                value=url,
            )
        )

    return writes


def extract_source_urls(*chunks: str) -> list[str]:
    urls: list[str] = []
    for chunk in chunks:
        for match in URL_PATTERN.findall(chunk):
            normalized = match.rstrip(".,;")
            if normalized not in urls:
                urls.append(normalized)
    return urls


def serialize_memory_writes(writes: list[ConversationMemoryWrite]) -> list[dict[str, str]]:
    return [asdict(write) for write in writes]
