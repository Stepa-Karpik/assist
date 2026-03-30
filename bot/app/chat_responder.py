from __future__ import annotations

import json
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


FALLBACK_REPLY = (
    "Не смог сразу нормально ответить. Попробуй уточнить запрос, и я разберу его по шагам."
)


@dataclass(frozen=True, slots=True)
class DeepSeekChatResponder:
    api_key: str
    model: str = "deepseek-chat"
    timeout_seconds: float = 10.0

    def reply(self, text: str, owner_profile_context: str | None = None) -> str:
        system_prompt = (
            "You are Karpik, a natural Russian-speaking personal assistant. "
            "Answer in Russian. Sound human, calm and practical, not robotic. "
            "Do not mention DeepSeek or that you are a separate model. "
            "When it helps, finish with one short next useful step based on the user's context."
        )
        if owner_profile_context is not None and owner_profile_context.strip():
            system_prompt = (
                f"{system_prompt}\n\n"
                f"Owner profile context:\n{owner_profile_context.strip()}"
            )

        request_body = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": text,
                },
            ],
            "temperature": 0.3,
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
            return FALLBACK_REPLY

        try:
            parsed = json.loads(body)
            content = parsed["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError, json.JSONDecodeError):
            return FALLBACK_REPLY

        if not isinstance(content, str) or not content.strip():
            return FALLBACK_REPLY

        return content.strip()
