from __future__ import annotations

import copy
import json
from pathlib import Path
from threading import Lock
from typing import TypeVar

SectionValue = TypeVar("SectionValue")


class JsonStateBackend:
    def __init__(self, path: str | Path) -> None:
        self._path = Path(path)
        self._lock = Lock()

    def read_section(self, name: str, default: SectionValue) -> SectionValue:
        with self._lock:
            state = self._load_all_unlocked()
            value = state.get(name, default)
            return copy.deepcopy(value)

    def write_section(self, name: str, value: object) -> None:
        with self._lock:
            state = self._load_all_unlocked()
            state[name] = value
            self._path.parent.mkdir(parents=True, exist_ok=True)
            temp_path = self._path.with_suffix(f"{self._path.suffix}.tmp")

            with temp_path.open("w", encoding="utf-8") as handle:
                json.dump(state, handle, ensure_ascii=True, indent=2, sort_keys=True)

            temp_path.replace(self._path)

    def _load_all_unlocked(self) -> dict[str, object]:
        if not self._path.exists():
            return {}

        try:
            with self._path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except (OSError, json.JSONDecodeError):
            return {}

        if not isinstance(payload, dict):
            return {}

        return payload
