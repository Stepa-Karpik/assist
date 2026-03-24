from datetime import UTC, datetime

from app.models.task import RequiredAuth, TaskCreateRequest, TaskRecord, TaskStatus


class InMemoryTaskStore:
    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self._tasks: list[TaskRecord] = []

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
        return task

    def complete_task(self, task_id: str, result_text: str) -> TaskRecord | None:
        task = self.get_task(task_id)

        if task is None or task.status != "running":
            return None

        task.status = "done"
        task.finished_at = datetime.now(UTC)
        task.result_text = result_text
        task.error_text = None
        return task

    def fail_task(self, task_id: str, error_text: str) -> TaskRecord | None:
        task = self.get_task(task_id)

        if task is None or task.status != "running":
            return None

        task.status = "failed"
        task.finished_at = datetime.now(UTC)
        task.result_text = None
        task.error_text = error_text
        return task
