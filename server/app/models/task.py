from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field

TaskSource = Literal["desktop", "telegram"]
TaskStatus = Literal[
    "queued",
    "awaiting_auth",
    "awaiting_local_approval",
    "blocked",
    "running",
    "done",
    "failed",
    "stalled",
]


class TaskCreateRequest(BaseModel):
    device_id: str
    intent: str
    source: TaskSource


class TaskRecord(BaseModel):
    task_id: str = Field(default_factory=lambda: str(uuid4()))
    device_id: str
    intent: str
    source: TaskSource
    status: TaskStatus = "queued"


class TaskListResponse(BaseModel):
    items: list[TaskRecord]
