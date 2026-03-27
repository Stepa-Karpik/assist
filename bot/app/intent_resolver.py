from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Literal, Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

TaskRisk = Literal["low", "medium", "high"]
IntentResolutionKind = Literal["task", "clarification", "ignored"]
ClarificationKind = Literal["screenshot_scope"]

FILE_EXTENSION_PATTERN = re.compile(
    r"\b[\w.\-]+\.(?:pptx?|pdf|docx?|xlsx?|txt|md|png|jpe?g|gif|zip)\b",
    re.IGNORECASE,
)
NUMERIC_CODE_PATTERN = re.compile(r"^\d{4,8}$")

STOP_WORDS = {
    "скинь",
    "скиньте",
    "пришли",
    "пришлите",
    "отправь",
    "отправьте",
    "пожалуйста",
    "мне",
    "файл",
    "файлик",
    "документ",
    "документа",
    "с",
    "со",
    "из",
    "на",
    "рабочего",
    "стола",
    "desktop",
}


@dataclass(frozen=True, slots=True)
class ClarificationResolution:
    kind: ClarificationKind


@dataclass(frozen=True, slots=True)
class IntentResolution:
    kind: IntentResolutionKind
    risk: TaskRisk = "high"
    intent: str | None = None
    clarification: ClarificationResolution | None = None

    @property
    def clarification_kind(self) -> ClarificationKind | None:
        return self.clarification.kind if self.clarification is not None else None


class SupportsIntentResolver(Protocol):
    def resolve(self, text: str) -> IntentResolution: ...


def normalize_whitespace(value: str) -> str:
    return " ".join(value.strip().split())


def contains_any(value: str, needles: set[str]) -> bool:
    return any(needle in value for needle in needles)


def extract_file_query(text: str) -> str:
    exact_file_match = FILE_EXTENSION_PATTERN.search(text)

    if exact_file_match is not None:
        return exact_file_match.group(0)

    tokens = [
        token
        for token in re.findall(r"[\w\-]+", text.casefold())
        if token not in STOP_WORDS and len(token) > 1
    ]

    if len(tokens) == 0:
        return "file"

    if any(token.startswith("презентац") for token in tokens):
        tokens = [token for token in tokens if not token.startswith("презентац")]
        if len(tokens) == 0:
            return "presentation"
        return f"presentation {' '.join(tokens)}"

    return " ".join(tokens)


class RuleBasedIntentResolver:
    def resolve(self, text: str) -> IntentResolution:
        normalized = normalize_whitespace(text)

        if not normalized or normalized.startswith("/"):
            return IntentResolution(kind="ignored")

        if NUMERIC_CODE_PATTERN.fullmatch(normalized):
            return IntentResolution(kind="ignored")

        lowered = normalized.casefold()

        if self._looks_like_meta_command(normalized, lowered):
            return IntentResolution(kind="ignored")

        if self._looks_like_status(lowered):
            return IntentResolution(kind="task", risk="low", intent="status")

        screenshot_resolution = self._resolve_screenshot(lowered)
        if screenshot_resolution is not None:
            return screenshot_resolution

        file_resolution = self._resolve_file_request(normalized, lowered)
        if file_resolution is not None:
            return file_resolution

        read_resolution = self._resolve_read_request(normalized, lowered)
        if read_resolution is not None:
            return read_resolution

        list_resolution = self._resolve_list_request(lowered)
        if list_resolution is not None:
            return list_resolution

        return IntentResolution(kind="task", risk="high", intent=f"codex {normalized}")

    def _looks_like_meta_command(self, normalized: str, lowered: str) -> bool:
        stripped = lowered.lstrip("-—–").strip()
        return stripped == "help" or normalized in {"--help", "-help", "—help", "–help"}

    def _looks_like_status(self, lowered: str) -> bool:
        if contains_any(
            lowered,
            {
                "статус",
                "онлайн",
                "online",
                "жив",
                "пинг",
                "что сейчас с задач",
                "что с задач",
                "что по задач",
                "какие задачи",
                "как там задачи",
                "как дела у задач",
            },
        ):
            return True

        return "задач" in lowered and "сейчас" in lowered

    def _resolve_screenshot(self, lowered: str) -> IntentResolution | None:
        if not contains_any(
            lowered,
            {"скрин", "screenshot", "screen", "экран", "экрана"},
        ):
            return None

        if contains_any(lowered, {"оба", "обоих", "двух экран", "both"}):
            return IntentResolution(kind="task", risk="low", intent="screenshot both")

        if contains_any(lowered, {"второго", "второй", "экран 2", "screen 2"}):
            return IntentResolution(kind="task", risk="low", intent="screenshot screen-2")

        if contains_any(
            lowered,
            {"первого", "первый", "основного", "главного", "экран 1", "screen 1"},
        ):
            return IntentResolution(kind="task", risk="low", intent="screenshot screen-1")

        return IntentResolution(
            kind="clarification",
            risk="low",
            clarification=ClarificationResolution(kind="screenshot_scope"),
        )

    def _resolve_file_request(
        self, normalized: str, lowered: str
    ) -> IntentResolution | None:
        looks_like_send = contains_any(
            lowered,
            {
                "скинь",
                "пришли",
                "отправь",
                "send",
                "send-file",
                "файл",
                "документ",
                "презентац",
                ".ppt",
                ".pptx",
                ".pdf",
                ".doc",
                ".docx",
                ".xlsx",
                ".png",
                ".jpg",
                ".jpeg",
                ".zip",
            },
        )

        if not looks_like_send:
            return None

        query = extract_file_query(normalized)
        prefix = "desktop::" if "рабоч" in lowered or "desktop" in lowered else ""

        return IntentResolution(
            kind="task",
            risk="medium",
            intent=f"send-file {prefix}{query}".strip(),
        )

    def _resolve_read_request(
        self, normalized: str, lowered: str
    ) -> IntentResolution | None:
        if not contains_any(
            lowered,
            {"прочитай", "покажи содержимое", "открой файл", "read "},
        ):
            return None

        file_match = FILE_EXTENSION_PATTERN.search(normalized)

        if file_match is None:
            return None

        return IntentResolution(
            kind="task",
            risk="low",
            intent=f"read {file_match.group(0)}",
        )

    def _resolve_list_request(self, lowered: str) -> IntentResolution | None:
        if not contains_any(
            lowered,
            {"список", "что в папке", "покажи папку", "list "},
        ):
            return None

        if "docs" in lowered:
            return IntentResolution(kind="task", risk="low", intent="list docs")

        if "notes" in lowered:
            return IntentResolution(kind="task", risk="low", intent="list docs/notes")

        if "рабоч" in lowered or "desktop" in lowered:
            return IntentResolution(kind="task", risk="medium", intent="list desktop")

        return IntentResolution(kind="task", risk="low", intent="list docs")


@dataclass(frozen=True, slots=True)
class DeepSeekIntentResolver:
    api_key: str
    fallback_resolver: SupportsIntentResolver
    model: str = "deepseek-chat"
    timeout_seconds: float = 10.0

    def resolve(self, text: str) -> IntentResolution:
        fallback = self.fallback_resolver.resolve(text)

        if fallback.kind == "ignored":
            return fallback

        if fallback.kind == "task" and fallback.intent != f"codex {normalize_whitespace(text)}":
            return fallback

        request_body = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Classify the user request into one supported Karpik action. "
                        "Return only JSON with fields: "
                        "kind(task|clarification|ignored), risk(low|medium|high), intent, clarification_kind. "
                        "Supported task intents: status, screenshot screen-1, screenshot screen-2, screenshot both, "
                        "send-file <query>, read <path>, list <path>, codex <prompt>. "
                        "Use clarification_kind=screenshot_scope only when screenshot target is ambiguous."
                    ),
                },
                {
                    "role": "user",
                    "content": text,
                },
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
        }
        request = Request(
            "https://api.deepseek.com/chat/completions",
            data=json.dumps(request_body).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )

        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                body = response.read().decode("utf-8")
        except (HTTPError, URLError, TimeoutError, OSError):
            return fallback

        try:
            parsed = json.loads(body)
            content = parsed["choices"][0]["message"]["content"]
            resolved = json.loads(content)
        except (KeyError, IndexError, TypeError, json.JSONDecodeError):
            return fallback

        kind = resolved.get("kind")
        risk = resolved.get("risk")
        intent = resolved.get("intent")
        clarification_kind = resolved.get("clarification_kind")

        if kind == "task" and risk in {"low", "medium", "high"} and isinstance(intent, str):
            return IntentResolution(kind="task", risk=risk, intent=normalize_whitespace(intent))

        if kind == "clarification" and risk in {"low", "medium", "high"}:
            if clarification_kind == "screenshot_scope":
                return IntentResolution(
                    kind="clarification",
                    risk=risk,
                    clarification=ClarificationResolution(kind="screenshot_scope"),
                )

        return fallback
