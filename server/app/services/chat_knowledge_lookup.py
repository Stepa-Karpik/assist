from __future__ import annotations

import re
from dataclasses import dataclass
from html import unescape
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


@dataclass(frozen=True, slots=True)
class ChatKnowledgeLookupResult:
    context: str | None
    source_urls: list[str]


KNOWN_DOC_SOURCES: tuple[tuple[re.Pattern[str], tuple[tuple[str, str], ...]], ...] = (
    (
        re.compile(r"\bfastapi\b", re.IGNORECASE),
        (("https://fastapi.tiangolo.com/release-notes/", "FastAPI Release Notes"),),
    ),
    (
        re.compile(r"\bmcp\b", re.IGNORECASE),
        (("https://modelcontextprotocol.io/introduction", "Model Context Protocol"),),
    ),
    (
        re.compile(r"\bpython\b", re.IGNORECASE),
        (("https://docs.python.org/3/whatsnew/", "Python What's New"),),
    ),
    (
        re.compile(r"\breact\b", re.IGNORECASE),
        (("https://react.dev/blog", "React Blog"),),
    ),
    (
        re.compile(r"\btypescript\b", re.IGNORECASE),
        (("https://devblogs.microsoft.com/typescript/", "TypeScript Blog"),),
    ),
    (
        re.compile(r"\bcodex\b", re.IGNORECASE),
        (("https://openai.com/index/introducing-codex/", "Introducing Codex"),),
    ),
)


def _trim_snippet(value: str, max_length: int) -> str:
    normalized = re.sub(r"\s+", " ", value).strip()
    return normalized if len(normalized) <= max_length else f"{normalized[: max_length - 3]}..."


def _strip_html(value: str) -> str:
    value = re.sub(r"<script[\s\S]*?</script>", " ", value, flags=re.IGNORECASE)
    value = re.sub(r"<style[\s\S]*?</style>", " ", value, flags=re.IGNORECASE)
    value = re.sub(r"<[^>]+>", " ", value)
    return unescape(value)


def lookup_external_docs(text: str, *, timeout_seconds: float = 8.0) -> ChatKnowledgeLookupResult:
    sources: tuple[tuple[str, str], ...] | None = None

    for pattern, candidate_sources in KNOWN_DOC_SOURCES:
        if pattern.search(text):
            sources = candidate_sources
            break

    if sources is None:
        return ChatKnowledgeLookupResult(context=None, source_urls=[])

    snippets: list[str] = []
    source_urls: list[str] = []

    for url, label in sources:
        request = Request(url, method="GET", headers={"User-Agent": "Karpik/1.0"})
        try:
            with urlopen(request, timeout=timeout_seconds) as response:
                body = response.read().decode("utf-8", errors="ignore")
        except (HTTPError, URLError, TimeoutError, OSError):
            continue

        snippet = _trim_snippet(_strip_html(body), 420)
        if not snippet:
            continue

        snippets.append(f"{label}: {snippet}")
        source_urls.append(url)

    return ChatKnowledgeLookupResult(
        context=f"External docs:\n\n{'\n\n'.join(snippets)}" if snippets else None,
        source_urls=source_urls,
    )
