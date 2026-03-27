from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from app.models.task import TaskArtifactKind

DeliveryKind = Literal["task_done", "task_failed"]
DeliveryStatus = Literal["pending", "delivered"]


class DeliveryEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    device_id: str
    task_id: str
    chat_id: int
    telegram_user_id: int
    kind: DeliveryKind
    status: DeliveryStatus = "pending"
    intent: str
    result_text: str | None = None
    error_text: str | None = None
    artifact_kind: TaskArtifactKind | None = None
    artifact_mime_type: str | None = None
    artifact_file_name: str | None = None
    artifact_base64: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class DeliveryEventListResponse(BaseModel):
    items: list[DeliveryEvent]


class DeliveryAckResponse(BaseModel):
    event_id: str
    status: DeliveryStatus
