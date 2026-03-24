import json
from pathlib import Path

from app.config import Settings
from app.services.state_backend import (
    JsonStateBackend,
    PostgresStateBackend,
    create_state_backend,
)


class FakeCursor:
    def __init__(self, sections: dict[str, object]) -> None:
        self._sections = sections
        self._row: tuple[object] | None = None

    def execute(self, query: str, params: tuple[object, ...] | None = None) -> None:
        normalized = " ".join(query.split()).lower()

        if normalized.startswith("create table"):
            return

        if normalized.startswith("select payload from karpik_state_sections"):
            assert params is not None
            payload = self._sections.get(str(params[0]))
            self._row = None if payload is None else (payload,)
            return

        if normalized.startswith("insert into karpik_state_sections"):
            assert params is not None
            section_name = str(params[0])
            raw_payload = params[1]

            if isinstance(raw_payload, str):
                payload = json.loads(raw_payload)
            else:
                payload = raw_payload

            self._sections[section_name] = payload
            self._row = None
            return

        raise AssertionError(f"Unexpected SQL: {query}")

    def fetchone(self) -> tuple[object] | None:
        return self._row

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


class FakeConnection:
    def __init__(self, sections: dict[str, object]) -> None:
        self._sections = sections

    def cursor(self) -> FakeCursor:
        return FakeCursor(self._sections)

    def __enter__(self) -> "FakeConnection":
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


def create_fake_connect_factory() -> tuple[dict[str, object], object]:
    sections: dict[str, object] = {}

    def connect(*_args, **_kwargs) -> FakeConnection:
        return FakeConnection(sections)

    return sections, connect


def test_create_state_backend_prefers_postgres_when_database_url_is_set() -> None:
    _, connect = create_fake_connect_factory()
    backend = create_state_backend(
        Settings(
            database_url="postgresql://karpik:karpik@postgres:5432/karpik",
            state_file=Path("ignored.json"),
        ),
        connect=connect,
    )

    assert isinstance(backend, PostgresStateBackend)


def test_create_state_backend_falls_back_to_json_when_database_url_is_missing() -> None:
    backend = create_state_backend(Settings(state_file=Path("runtime-state.json")))

    assert isinstance(backend, JsonStateBackend)


def test_postgres_state_backend_reads_and_writes_sections() -> None:
    sections, connect = create_fake_connect_factory()
    backend = PostgresStateBackend(
        "postgresql://karpik:karpik@postgres:5432/karpik",
        connect=connect,
    )

    backend.write_section("tasks", [{"task_id": "task-1", "status": "queued"}])

    assert sections["tasks"] == [{"task_id": "task-1", "status": "queued"}]
    assert backend.read_section("tasks", []) == [{"task_id": "task-1", "status": "queued"}]
    assert backend.read_section("missing", {"ok": True}) == {"ok": True}
