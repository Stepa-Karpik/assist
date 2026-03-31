from fastapi.testclient import TestClient

from app.api import chat as chat_api
from app.main import app
from app.models.profile import OwnerProfile
from app.services.chat_knowledge_lookup import ChatKnowledgeLookupResult

client = TestClient(app)


class FakeResponder:
    def __init__(self) -> None:
        self.calls: list[dict[str, str | None]] = []

    def reply(
        self,
        text: str,
        owner_profile_context: str | None = None,
        knowledge_context: str | None = None,
        history_context: str | None = None,
    ) -> str:
        self.calls.append(
            {
                "text": text,
                "owner_profile_context": owner_profile_context,
                "knowledge_context": knowledge_context,
                "history_context": history_context,
            }
        )
        return "Вот краткий ответ по теме."


def test_chat_response_uses_device_profile_and_external_docs(monkeypatch) -> None:
    fake_responder = FakeResponder()
    app.state.chat_responder = fake_responder
    app.state.owner_profile_store.save_profile(
        "desktop-local",
        OwnerProfile(
            full_name="Карпов Степан Викторович",
            occupation="Python developer",
            city="Москва",
        ),
    )
    monkeypatch.setattr(
        chat_api,
        "lookup_external_docs",
        lambda _prompt: ChatKnowledgeLookupResult(
            context="External docs:\n\nFastAPI Release Notes: useful updates",
            source_urls=["https://fastapi.tiangolo.com/release-notes/"],
        ),
    )

    response = client.post(
        "/api/chat/respond",
        json={
            "device_id": "desktop-local",
            "prompt": "что нового в fastapi?",
            "knowledge_context": "Локальные заметки: уже использую FastAPI в проде.",
            "history_context": "Пользователь: я backend-разработчик\nАссистент: принял, учту твой стек",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "text": "Вот краткий ответ по теме.",
        "source_urls": ["https://fastapi.tiangolo.com/release-notes/"],
    }
    assert fake_responder.calls == [
        {
            "text": "что нового в fastapi?",
            "owner_profile_context": "ФИО: Карпов Степан Викторович\nРоль: Python developer\nГород: Москва",
            "knowledge_context": "Локальные заметки: уже использую FastAPI в проде.\n\nExternal docs:\n\nFastAPI Release Notes: useful updates",
            "history_context": "Пользователь: я backend-разработчик\nАссистент: принял, учту твой стек",
        }
    ]
