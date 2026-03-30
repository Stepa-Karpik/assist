from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


ConversationMemoryStatus = Literal["pending", "delivered"]
ConversationMemoryOrigin = Literal["telegram-chat"]
ConversationMemoryTarget = Literal[
    "assist/profile",
    "assist/preferences",
    "assist/docs/websites",
    "assist/docs/papers",
]


class ConversationMemoryWrite(BaseModel):
    target: ConversationMemoryTarget
    key: str
    value: str


class ConversationMemoryEventCreateRequest(BaseModel):
    device_id: str
    origin: ConversationMemoryOrigin = "telegram-chat"
    prompt: str
    answer: str
    source_urls: list[str] = Field(default_factory=list)
    memory_writes: list[ConversationMemoryWrite] = Field(default_factory=list)


class ConversationMemoryEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    device_id: str
    origin: ConversationMemoryOrigin = "telegram-chat"
    prompt: str
    answer: str
    source_urls: list[str] = Field(default_factory=list)
    memory_writes: list[ConversationMemoryWrite] = Field(default_factory=list)
    status: ConversationMemoryStatus = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ConversationMemoryEventListResponse(BaseModel):
    items: list[ConversationMemoryEvent]


class ConversationMemoryEventAckResponse(BaseModel):
    event_id: str
    status: ConversationMemoryStatus
