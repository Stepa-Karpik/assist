from __future__ import annotations

import asyncio

from app.message_delivery import publish_final_reply


class FakeMessage:
    def __init__(self) -> None:
        self.answer_calls: list[tuple[str, object | None]] = []
        self.edit_calls: list[tuple[str, object | None]] = []
        self.should_fail_answer = False
        self.should_fail_edit = False

    async def answer(self, text: str, reply_markup=None):
        if self.should_fail_answer:
            raise RuntimeError("answer failed")
        self.answer_calls.append((text, reply_markup))
        return object()

    async def edit_text(self, text: str, reply_markup=None):
        if self.should_fail_edit:
            raise RuntimeError("edit failed")
        self.edit_calls.append((text, reply_markup))


class FakePlaceholder:
    def __init__(self, *, should_fail: bool = False) -> None:
        self.should_fail = should_fail
        self.edit_calls: list[tuple[str, object | None]] = []

    async def edit_text(self, text: str, reply_markup=None):
        self.edit_calls.append((text, reply_markup))
        if self.should_fail:
            raise RuntimeError("edit failed")


def test_publish_final_reply_prefers_editing_placeholder():
    message = FakeMessage()
    placeholder = FakePlaceholder()

    asyncio.run(
        publish_final_reply(
            message=message,
            placeholder=placeholder,
            text="Готовый ответ",
            reply_markup=None,
        )
    )

    assert placeholder.edit_calls == [("Готовый ответ", None)]
    assert message.answer_calls == []


def test_publish_final_reply_falls_back_to_new_message_when_edit_fails():
    message = FakeMessage()
    placeholder = FakePlaceholder(should_fail=True)

    asyncio.run(
        publish_final_reply(
            message=message,
            placeholder=placeholder,
            text="Готовый ответ",
            reply_markup=None,
        )
    )

    assert placeholder.edit_calls == [("Готовый ответ", None)]
    assert message.answer_calls == [("Готовый ответ", None)]
