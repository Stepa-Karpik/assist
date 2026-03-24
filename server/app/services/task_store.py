from datetime import UTC, datetime

from app.models.task import (
    RequiredAuth,
    TaskArtifact,
    TaskCreateRequest,
    TaskRecord,
    TaskStatus,
)
from app.services.state_backend import JsonStateBackend


class InMemoryTaskStore:
    def __init__(self, state_backend: JsonStateBackend | None = None) -> None:
        self._state_backend = state_backend
        self._tasks: list[TaskRecord] = []
        self._restore_state()

    def reset(self) -> None:
        self._tasks = []
        self._persist()

    def create_task(
        self,
        payload: TaskCreateRequest,
        *,
        status: TaskStatus = "queued",
        required_auth: RequiredAuth = "none",
        challenge_id: str | None = None,
    ) -> TaskRecord:
        record = TaskRecord(
            device_id=payload.device_id,
            intent=payload.intent,
            source=payload.source,
            status=status,
            risk=payload.risk,
            required_auth=required_auth,
            telegram_user_id=payload.telegram_user_id,
            chat_id=payload.chat_id,
            challenge_id=challenge_id,
        )
        self._tasks.append(record)
        self._persist()
        return record

    def get_task(self, task_id: str) -> TaskRecord | None:
        for task in self._tasks:
            if task.task_id == task_id:
                return task

        return None

    def update_status(
        self, task_id: str, status: TaskStatus, *, challenge_id: str | None = None
    ) -> TaskRecord | None:
        task = self.get_task(task_id)

        if task is None:
            return None

        task.status = status

        if challenge_id is not None:
            task.challenge_id = challenge_id

        self._persist()
        return task

    def list_tasks(
        self, device_id: str, *, include_history: bool = False, chat_id: int | None = None
    ) -> list[TaskRecord]:
        items = [
            task
            for task in self._tasks
            if task.device_id == device_id
            and (include_history or task.status == "queued")
            and (chat_id is None or task.chat_id == chat_id)
        ]

        if include_history:
            return list(reversed(items))

        return items

    def start_task(self, task_id: str) -> TaskRecord | None:
        task = self.get_task(task_id)

        if task is None or task.status != "queued":
            return None

        task.status = "running"
        task.started_at = datetime.now(UTC)
        task.finished_at = None
        task.result_text = None
        task.error_text = None
        task.attempt_count += 1
        self._persist()
        return task

    def complete_task(
        self, task_id: str, result_text: str, artifact: TaskArtifact | None = None
    ) -> TaskRecord | None:
        task = self.get_task(task_id)

        if task is None or task.status not in {"running", "awaiting_local_approval"}:
            return None

        task.status = "done"
        task.finished_at = datetime.now(UTC)
        task.result_text = result_text
        task.error_text = None
        task.artifact_kind = artifact.kind if artifact is not None else None
        task.artifact_mime_type = artifact.mime_type if artifact is not None else None
        task.artifact_file_name = artifact.file_name if artifact is not None else None
        task.artifact_base64 = artifact.content_base64 if artifact is not None else None
        self._persist()
        return task

    def fail_task(self, task_id: str, error_text: str) -> TaskRecord | None:
        task = self.get_task(task_id)

        if task is None or task.status not in {"running", "awaiting_local_approval"}:
            return None

        task.status = "failed"
        task.finished_at = datetime.now(UTC)
        task.result_text = None
        task.error_text = error_text
        task.artifact_kind = None
        task.artifact_mime_type = None
        task.artifact_file_name = None
        task.artifact_base64 = None
        self._persist()
        return task

    def await_local_approval(self, task_id: str, result_text: str) -> TaskRecord | None:
        task = self.get_task(task_id)

        if task is None or task.status != "running":
            return None

        task.status = "awaiting_local_approval"
        task.result_text = result_text
        task.error_text = None
        task.finished_at = None
        task.artifact_kind = None
        task.artifact_mime_type = None
        task.artifact_file_name = None
        task.artifact_base64 = None
        self._persist()
        return task

    def block_task(self, task_id: str, error_text: str) -> TaskRecord | None:
        task = self.get_task(task_id)

        if task is None or task.status not in {"running", "awaiting_local_approval"}:
            return None

        task.status = "blocked"
        task.finished_at = datetime.now(UTC)
        task.result_text = None
        task.error_text = error_text
        task.artifact_kind = None
        task.artifact_mime_type = None
        task.artifact_file_name = None
        task.artifact_base64 = None
        self._persist()
        return task

    def persist(self) -> None:
        self._persist()

    def _restore_state(self) -> None:
        if self._state_backend is None:
            return

        raw_items = self._state_backend.read_section("tasks", [])
        self._tasks = [TaskRecord.model_validate(item) for item in raw_items]

    def _persist(self) -> None:
        if self._state_backend is None:
            return

        self._state_backend.write_section(
            "tasks",
            [task.model_dump(mode="json") for task in self._tasks],
        )
