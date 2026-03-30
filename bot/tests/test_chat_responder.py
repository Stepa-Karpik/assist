import json

import app.chat_responder as chat_responder_module
from app.chat_responder import DeepSeekChatResponder


class FakeDeepSeekResponse:
    def __init__(self, payload: dict[str, object]) -> None:
        self._payload = payload

    def __enter__(self) -> "FakeDeepSeekResponse":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None

    def read(self) -> bytes:
        return json.dumps(self._payload).encode("utf-8")


def test_chat_responder_returns_deepseek_reply(monkeypatch) -> None:
    def fake_urlopen(request, timeout):
        del request, timeout
        return FakeDeepSeekResponse(
            {
                "choices": [
                    {
                        "message": {
                            "content": "Привет. Чем помочь?"
                        }
                    }
                ]
            }
        )

    monkeypatch.setattr(chat_responder_module, "urlopen", fake_urlopen)
    responder = DeepSeekChatResponder(api_key="test-key")

    assert responder.reply("привет") == "Привет. Чем помочь?"


def test_chat_responder_returns_russian_fallback_on_invalid_response(monkeypatch) -> None:
    def fake_urlopen(request, timeout):
        del request, timeout
        return FakeDeepSeekResponse({"choices": []})

    monkeypatch.setattr(chat_responder_module, "urlopen", fake_urlopen)
    responder = DeepSeekChatResponder(api_key="test-key")

    assert (
        responder.reply("привет")
        == "Не смог сразу нормально ответить. Попробуй уточнить запрос, и я разберу его по шагам."
    )


def test_chat_responder_injects_owner_profile_context(monkeypatch) -> None:
    captured_payload: dict[str, object] = {}

    def fake_urlopen(request, timeout):
        del timeout
        captured_payload.update(json.loads(request.data.decode("utf-8")))
        return FakeDeepSeekResponse(
            {
                "choices": [
                    {
                        "message": {
                            "content": "Принято."
                        }
                    }
                ]
            }
        )

    monkeypatch.setattr(chat_responder_module, "urlopen", fake_urlopen)
    responder = DeepSeekChatResponder(api_key="test-key")

    responder.reply(
        "какой план на день?",
        owner_profile_context="Владелец: Степан Карпов\nГород: Москва",
    )

    system_prompt = captured_payload["messages"][0]["content"]
    assert "Владелец: Степан Карпов" in system_prompt
    assert "Город: Москва" in system_prompt
