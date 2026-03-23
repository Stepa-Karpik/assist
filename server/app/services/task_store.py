from app.models.task import TaskCreateRequest, TaskRecord


class InMemoryTaskStore:
    def __init__(self) -> None:
        self._tasks: list[TaskRecord] = []

    def create_task(self, payload: TaskCreateRequest) -> TaskRecord:
        record = TaskRecord(
            device_id=payload.device_id,
            intent=payload.intent,
            source=payload.source,
        )
        self._tasks.append(record)
        return record

    def list_queued_tasks(self, device_id: str) -> list[TaskRecord]:
        return [
            task
            for task in self._tasks
            if task.device_id == device_id and task.status == "queued"
        ]
