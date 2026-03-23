from fastapi import APIRouter, status

from app.models.task import TaskCreateRequest, TaskListResponse, TaskRecord
from app.services.task_store import InMemoryTaskStore

router = APIRouter(prefix="/tasks", tags=["tasks"])
store = InMemoryTaskStore()


@router.post("", response_model=TaskRecord, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreateRequest) -> TaskRecord:
    return store.create_task(payload)


@router.get("", response_model=TaskListResponse)
def list_tasks(device_id: str) -> TaskListResponse:
    return TaskListResponse(items=store.list_queued_tasks(device_id))
