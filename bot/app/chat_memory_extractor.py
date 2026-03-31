from __future__ import annotations

import re
from dataclasses import asdict, dataclass


URL_PATTERN = re.compile(r"https?://[^\s)\]]+")
FULL_NAME_PATTERN = re.compile(
    r"\bменя\s+зовут\s+([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){1,2})",
    re.IGNORECASE,
)
ROLE_PATTERN = re.compile(
    r"(?:^|[\s,.:;!?()])(?:я\s+)?(программист|разработчик|python[-\s]?разработчик|backend[-\s]?разработчик|frontend[-\s]?разработчик)(?=$|[\s,.:;!?()])",
    re.IGNORECASE,
)
GPU_PATTERN = re.compile(
    r"\b((?:AMD\s+Radeon|NVIDIA\s+GeForce|Intel\s+Arc)\s+[A-Za-z0-9!()+\-.\s]+?)(?=,|\.|;|$)",
    re.IGNORECASE,
)
CPU_LABELED_PATTERN = re.compile(
    r"(?:процессор|cpu)\s+([A-Za-z0-9+\-.\s]+?)(?=,|\.|;|$)",
    re.IGNORECASE,
)
CPU_DIRECT_PATTERN = re.compile(
    r"\b((?:Ryzen|Intel\s+Core|Intel\s+Xeon|Apple\s+M)\s+[A-Za-z0-9+\-.\s]+?)(?=,|\.|;|$)",
    re.IGNORECASE,
)
RAM_PATTERN = re.compile(
    r"(\d+)\s*(gb|гб|tb|тб)\s*(?:ozu|озу|ram|оператив(?:ной)? памяти?)",
    re.IGNORECASE,
)
STORAGE_PATTERN = re.compile(
    r"(?:диск|ssd|hdd|накопитель)(?:\s+\w+)*\s+(?:на\s*)?(\d+)\s*(gb|гб|tb|тб)",
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


def _normalize_space(value: str) -> str:
    return " ".join(value.split()).strip()


def _normalize_capacity(value: str, unit: str) -> str:
    return f"{value} {'TB' if unit.casefold() in {'tb', 'тб'} else 'GB'}"


def extract_memory_writes(text: str) -> list[ConversationMemoryWrite]:
    writes: list[ConversationMemoryWrite] = []
    normalized = _normalize_space(text)

    full_name_match = FULL_NAME_PATTERN.search(normalized)
    if full_name_match is not None:
        writes.append(
            ConversationMemoryWrite(
                target="assist/profile",
                key="full_name",
                value=_normalize_space(full_name_match.group(1)),
            )
        )

    role_match = ROLE_PATTERN.search(normalized)
    if role_match is not None:
        writes.append(
            ConversationMemoryWrite(
                target="assist/profile",
                key="occupation",
                value=_normalize_space(role_match.group(1).lower()),
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

    if re.search(r"(нравится|люблю)\s+(?:изучать\s+)?нейросети", normalized, re.IGNORECASE) or re.search(
        r"\bнейросет", normalized, re.IGNORECASE
    ):
        writes.append(
            ConversationMemoryWrite(
                target="assist/preferences",
                key="interests",
                value="Нейросети",
            )
        )

    gpu_match = GPU_PATTERN.search(normalized)
    if gpu_match is not None:
        writes.append(
            ConversationMemoryWrite(
                target="assist/profile",
                key="gpu",
                value=_normalize_space(gpu_match.group(1)),
            )
        )

    cpu_match = CPU_LABELED_PATTERN.search(normalized) or CPU_DIRECT_PATTERN.search(normalized)
    if cpu_match is not None:
        writes.append(
            ConversationMemoryWrite(
                target="assist/profile",
                key="cpu",
                value=_normalize_space(cpu_match.group(1)),
            )
        )

    ram_match = RAM_PATTERN.search(normalized)
    if ram_match is not None:
        writes.append(
            ConversationMemoryWrite(
                target="assist/profile",
                key="ram",
                value=_normalize_capacity(ram_match.group(1), ram_match.group(2)),
            )
        )

    storage_match = STORAGE_PATTERN.search(normalized)
    if storage_match is not None:
        writes.append(
            ConversationMemoryWrite(
                target="assist/profile",
                key="storage",
                value=_normalize_capacity(storage_match.group(1), storage_match.group(2)),
            )
        )

    for url in extract_source_urls(text):
        host_match = re.match(r"https?://([^/]+)", url)
        host = host_match.group(1) if host_match is not None else url
        writes.append(
            ConversationMemoryWrite(
                target="assist/docs/websites",
                key=f"https://{host}",
                value=host,
            )
        )
        writes.append(
            ConversationMemoryWrite(
                target="assist/docs/papers",
                key=url,
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
