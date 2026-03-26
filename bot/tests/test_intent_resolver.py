import json

import app.intent_resolver as intent_resolver
from app.intent_resolver import DeepSeekIntentResolver, RuleBasedIntentResolver


class FakeDeepSeekResponse:
    def __init__(self, payload: dict[str, object]) -> None:
        self._payload = payload

    def __enter__(self) -> "FakeDeepSeekResponse":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None

    def read(self) -> bytes:
        return json.dumps(self._payload).encode("utf-8")


def test_resolver_requests_screen_selection_for_ambiguous_screenshot() -> None:
    resolver = RuleBasedIntentResolver()

    result = resolver.resolve("скинь скриншот")

    assert result.kind == "clarification"
    assert result.clarification_kind == "screenshot_scope"
    assert result.risk == "low"


def test_resolver_maps_second_screen_request_to_structured_screenshot_intent() -> None:
    resolver = RuleBasedIntentResolver()

    result = resolver.resolve("Скинь скриншот второго экрана")

    assert result.kind == "task"
    assert result.risk == "low"
    assert result.intent == "screenshot screen-2"


def test_resolver_maps_desktop_file_request_to_send_file_intent() -> None:
    resolver = RuleBasedIntentResolver()

    result = resolver.resolve("скинь файл с рабочего стола hack.pptx")

    assert result.kind == "task"
    assert result.risk == "medium"
    assert result.intent == "send-file desktop::hack.pptx"


def test_resolver_preserves_named_presentation_hint_for_send_file_request() -> None:
    resolver = RuleBasedIntentResolver()

    result = resolver.resolve("скинь презентацию хак с рабочего стола")

    assert result.kind == "task"
    assert result.risk == "medium"
    assert result.intent == "send-file desktop::presentation хак"


def test_resolver_maps_status_question_to_status_task() -> None:
    resolver = RuleBasedIntentResolver()

    result = resolver.resolve("что сейчас с задачами")

    assert result.kind == "task"
    assert result.risk == "low"
    assert result.intent == "status"


def test_resolver_ignores_cli_style_help_probe() -> None:
    resolver = RuleBasedIntentResolver()

    result = resolver.resolve("—help")

    assert result.kind == "ignored"


def test_resolver_ignores_standalone_numeric_code_without_auth_context() -> None:
    resolver = RuleBasedIntentResolver()

    result = resolver.resolve("469112")

    assert result.kind == "ignored"


def test_resolver_falls_back_to_codex_for_generic_creative_request() -> None:
    resolver = RuleBasedIntentResolver()

    result = resolver.resolve("придумай три названия для новой фичи")

    assert result.kind == "task"
    assert result.risk == "high"
    assert result.intent == "codex придумай три названия для новой фичи"


def test_deepseek_resolver_maps_free_form_status_request(monkeypatch) -> None:
    def fake_urlopen(request, timeout):
        del request, timeout
        return FakeDeepSeekResponse(
            {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "kind": "task",
                                    "risk": "low",
                                    "intent": "status",
                                    "clarification_kind": None,
                                }
                            )
                        }
                    }
                ]
            }
        )

    monkeypatch.setattr(intent_resolver, "urlopen", fake_urlopen)
    resolver = DeepSeekIntentResolver(
        api_key="test-key",
        fallback_resolver=RuleBasedIntentResolver(),
    )

    result = resolver.resolve("какие задачи сейчас висят")

    assert result.kind == "task"
    assert result.risk == "low"
    assert result.intent == "status"


def test_deepseek_resolver_falls_back_on_invalid_response(monkeypatch) -> None:
    def fake_urlopen(request, timeout):
        del request, timeout
        return FakeDeepSeekResponse({"choices": []})

    monkeypatch.setattr(intent_resolver, "urlopen", fake_urlopen)
    resolver = DeepSeekIntentResolver(
        api_key="test-key",
        fallback_resolver=RuleBasedIntentResolver(),
    )

    result = resolver.resolve("придумай три названия для новой фичи")

    assert result.kind == "task"
    assert result.risk == "high"
    assert result.intent == "codex придумай три названия для новой фичи"
