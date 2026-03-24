from __future__ import annotations

import copy
import json
import time
from pathlib import Path
from threading import Lock
from typing import TYPE_CHECKING, Protocol, TypeVar

if TYPE_CHECKING:
    from collections.abc import Callable

    from app.config import Settings

SectionValue = TypeVar("SectionValue")


class StateBackend(Protocol):
    def read_section(self, name: str, default: SectionValue) -> SectionValue: ...

    def write_section(self, name: str, value: object) -> None: ...


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

            self._replace_with_retry(temp_path)

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

    def _replace_with_retry(self, temp_path: Path) -> None:
        last_error: PermissionError | None = None

        for attempt in range(5):
            try:
                temp_path.replace(self._path)
                return
            except PermissionError as error:
                last_error = error

                if attempt == 4:
                    raise

                time.sleep(0.02)

        if last_error is not None:
            raise last_error


class PostgresStateBackend:
    def __init__(
        self,
        database_url: str,
        *,
        connect: "Callable[..., object] | None" = None,
        connect_timeout: int = 5,
        connect_retries: int = 15,
        retry_sleep_seconds: float = 1.0,
    ) -> None:
        self._database_url = database_url
        self._connect = connect or _import_psycopg_connect()
        self._connect_timeout = connect_timeout
        self._connect_retries = connect_retries
        self._retry_sleep_seconds = retry_sleep_seconds
        self._lock = Lock()
        self._ensure_schema()

    def read_section(self, name: str, default: SectionValue) -> SectionValue:
        with self._lock:
            with self._open_connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT payload
                        FROM karpik_state_sections
                        WHERE section_name = %s
                        """,
                        (name,),
                    )
                    row = cursor.fetchone()

            if row is None:
                return copy.deepcopy(default)

            payload = row[0]

            if isinstance(payload, str):
                value = json.loads(payload)
            else:
                value = payload

            return copy.deepcopy(value)

    def write_section(self, name: str, value: object) -> None:
        with self._lock:
            payload = json.dumps(value, ensure_ascii=True, sort_keys=True)

            with self._open_connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO karpik_state_sections (section_name, payload, updated_at)
                        VALUES (%s, %s::jsonb, NOW())
                        ON CONFLICT (section_name)
                        DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
                        """,
                        (name, payload),
                    )

    def _ensure_schema(self) -> None:
        last_error: Exception | None = None

        for attempt in range(self._connect_retries):
            try:
                with self._open_connection() as connection:
                    with connection.cursor() as cursor:
                        cursor.execute(
                            """
                            CREATE TABLE IF NOT EXISTS karpik_state_sections (
                              section_name text PRIMARY KEY,
                              payload jsonb NOT NULL,
                              updated_at timestamptz NOT NULL DEFAULT NOW()
                            )
                            """
                        )
                return
            except Exception as error:  # pragma: no cover - exact DB errors vary by driver/runtime
                last_error = error

                if attempt == self._connect_retries - 1:
                    raise

                time.sleep(self._retry_sleep_seconds)

        if last_error is not None:
            raise last_error

    def _open_connection(self):
        return self._connect(
            self._database_url,
            autocommit=True,
            connect_timeout=self._connect_timeout,
        )


def create_state_backend(
    settings: "Settings", *, connect: "Callable[..., object] | None" = None
) -> StateBackend:
    if settings.database_url:
        return PostgresStateBackend(
            settings.database_url,
            connect=connect,
            connect_timeout=settings.database_connect_timeout,
        )

    return JsonStateBackend(settings.state_file)


def _import_psycopg_connect():
    try:
        from psycopg import connect
    except ImportError as error:  # pragma: no cover - exercised only in misconfigured runtime
        raise RuntimeError("psycopg is required for PostgreSQL-backed server state") from error

    return connect
