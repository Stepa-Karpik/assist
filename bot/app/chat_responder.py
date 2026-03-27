from __future__ import annotations

import json
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


@dataclass(frozen=True, slots=True)
class DeepSeekChatResponder:
    api_key: str
    model: str = "deepseek-chat"
    timeout_seconds: float = 10.0

    def reply(self, text: str) -> str:
        request_body = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are Karpik, a concise Russian-speaking desktop assistant. "
                        "Answer in Russian. Be direct and helpful. "
                        "Do not mention DeepSeek or that you are a separate model."
                    ),
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
            return "Сейчас не получилось обработать обычный вопрос. Попробуйте ещё раз или уточните запрос."

        try:
            parsed = json.loads(body)
            content = parsed["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError, json.JSONDecodeError):
            return "Сейчас не получилось обработать обычный вопрос. Попробуйте ещё раз или уточните запрос."

        if not isinstance(content, str) or not content.strip():
            return "Сейчас не получилось обработать обычный вопрос. Попробуйте ещё раз или уточните запрос."

        return content.strip()
