from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field

TaskSource = Literal["desktop", "telegram"]
TaskRisk = Literal["low", "medium", "high"]
RequiredAuth = Literal["none", "password", "password_and_totp", "local_only"]
TaskArtifactKind = Literal["image_base64", "file_base64"]
TaskStatus = Literal[
    "queued",
    "awaiting_auth",
    "awaiting_local_approval",
    "cancel_requested",
    "cancelled",
    "blocked",
    "running",
    "done",
    "failed",
    "stalled",
]
ChallengeStep = Literal["password", "totp", "confirm"]
TaskIntakeStatus = Literal["queued", "awaiting_auth", "setup_required", "locked", "ignored"]


class TaskCreateRequest(BaseModel):
    device_id: str
    intent: str
    source: TaskSource
    risk: TaskRisk = "low"
    telegram_user_id: int | None = None
    chat_id: int | None = None


class TaskArtifact(BaseModel):
    kind: TaskArtifactKind
    mime_type: str
    file_name: str
    content_base64: str


class TaskRecord(BaseModel):
    task_id: str = Field(default_factory=lambda: str(uuid4()))
    device_id: str
    intent: str
    source: TaskSource
    status: TaskStatus = "queued"
    risk: TaskRisk = "low"
    required_auth: RequiredAuth = "none"
    telegram_user_id: int | None = None
    chat_id: int | None = None
    challenge_id: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    result_text: str | None = None
    error_text: str | None = None
    artifact_kind: TaskArtifactKind | None = None
    artifact_mime_type: str | None = None
    artifact_file_name: str | None = None
    artifact_base64: str | None = None
    attempt_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class TaskIntakeResponse(BaseModel):
    status: TaskIntakeStatus
    task: TaskRecord | None = None
    device_online: bool | None = None
    challenge_id: str | None = None
    challenge_step: ChallengeStep | None = None
    lock_expires_at: datetime | None = None
    message: str | None = None


class TaskListResponse(BaseModel):
    items: list[TaskRecord]


class TaskCompleteRequest(BaseModel):
    result_text: str
    artifact: TaskArtifact | None = None


class TaskAwaitingLocalApprovalRequest(BaseModel):
    result_text: str


class TaskFailRequest(BaseModel):
    error_text: str


class TaskBlockRequest(BaseModel):
    error_text: str


class TaskCancelRequest(BaseModel):
    error_text: str | None = None
