from app.intent_resolver import RuleBasedIntentResolver


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


def test_resolver_falls_back_to_codex_for_generic_creative_request() -> None:
    resolver = RuleBasedIntentResolver()

    result = resolver.resolve("придумай три названия для новой фичи")

    assert result.kind == "task"
    assert result.risk == "high"
    assert result.intent == "codex придумай три названия для новой фичи"
