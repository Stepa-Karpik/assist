from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


ConversationEventStatus = Literal["pending", "running", "completed", "failed", "cancelled"]


class ConversationEventCreateRequest(BaseModel):
    device_id: str
    chat_id: int
    telegram_user_id: int
    prompt: str


class ConversationEventUpdateRequest(BaseModel):
    status: ConversationEventStatus
    response_text: str | None = None
    error_text: str | None = None


class ConversationEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    device_id: str
    chat_id: int
    telegram_user_id: int
    prompt: str
    status: ConversationEventStatus = "pending"
    response_text: str | None = None
    error_text: str | None = None
    revision: int = 0
    delivered_revision: int = -1
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ConversationEventListResponse(BaseModel):
    items: list[ConversationEvent]


class ConversationEventAckRequest(BaseModel):
    revision: int


class ConversationEventAckResponse(BaseModel):
    event_id: str
    revision: int
    status: ConversationEventStatus
