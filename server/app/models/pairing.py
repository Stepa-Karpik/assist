from datetime import datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field

PairingSessionStatus = Literal["inactive", "active", "consumed", "expired", "cancelled"]
PairAttemptStatus = Literal["pending", "resolved", "expired"]
PairAttemptResult = Literal["paired", "invalid_code", "ignored"]


class PairingOpenRequest(BaseModel):
    device_id: str
    code: str
    expires_at: datetime


class PairingCloseRequest(BaseModel):
    device_id: str


class PairingSession(BaseModel):
    device_id: str
    code: str
    status: PairingSessionStatus
    expires_at: datetime
    attempt_count: int = 0


class PairingStateResponse(BaseModel):
    device_id: str
    code: str | None
    status: PairingSessionStatus
    expires_at: datetime | None
    trusted_telegram_user_ids: list[int]


class PairAttemptRequest(BaseModel):
    device_id: str | None = None
    telegram_user_id: int
    chat_id: int
    code: str
    wait_seconds: float = 0


class PairAttemptEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    type: Literal["pair_attempt"] = "pair_attempt"
    device_id: str
    telegram_user_id: int
    chat_id: int
    code: str
    status: PairAttemptStatus = "pending"
    result: PairAttemptResult | None = None


class PairAttemptResponse(BaseModel):
    status: Literal["pending", "paired", "invalid_code", "ignored"]
    event_id: str | None = None


class PairingEventListResponse(BaseModel):
    items: list[PairAttemptEvent]


class PairAttemptResolutionRequest(BaseModel):
    result: PairAttemptResult
    trusted_telegram_user_id: int | None = None


class PairAttemptResolutionResponse(BaseModel):
    event_id: str
    result: PairAttemptResult
    trusted_users: list[int]
