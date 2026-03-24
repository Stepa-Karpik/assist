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

    def list_queued_tasks(self, device_id: str) -> list[TaskRecord]:
        return [
            task
            for task in self._tasks
            if task.device_id == device_id and task.status == "queued"
        ]
