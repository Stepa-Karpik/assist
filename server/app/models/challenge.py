from datetime import datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from app.models.task import ChallengeStep, TaskIntakeResponse, TaskRecord, TaskRisk

ChallengeStatus = Literal["pending", "passed", "failed", "expired", "locked", "cancelled"]
AuthEventStatus = Literal["pending", "resolved"]
InputResolutionStatus = Literal[
    "pending",
    "task_queued",
    "totp_required",
    "confirm_required",
    "invalid_password",
    "invalid_totp",
    "locked",
    "ignored",
]
DecisionResolutionStatus = Literal["task_queued", "declined", "ignored"]


class AuthConfigStatusRequest(BaseModel):
    device_id: str
    password_configured: bool
    totp_configured: bool


class AuthConfigStatus(BaseModel):
    device_id: str
    password_configured: bool
    totp_configured: bool


class ChallengeRecord(BaseModel):
    challenge_id: str = Field(default_factory=lambda: str(uuid4()))
    task_id: str
    device_id: str
    telegram_user_id: int
    chat_id: int
    risk: TaskRisk
    step: ChallengeStep
    status: ChallengeStatus = "pending"
    expires_at: datetime
    trust_window_expires_at: datetime | None = None
    failure_count: int = 0
    summary: str


class AuthInputEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    type: Literal["auth_input"] = "auth_input"
    device_id: str
    challenge_id: str
    telegram_user_id: int
    chat_id: int
    step: ChallengeStep
    value: str
    status: AuthEventStatus = "pending"
    accepted: bool | None = None
    response_status: InputResolutionStatus | None = None
    next_step: ChallengeStep | None = None
    task: TaskRecord | None = None
    lock_expires_at: datetime | None = None


class AuthEventListResponse(BaseModel):
    items: list[AuthInputEvent]


class AuthEventResolutionRequest(BaseModel):
    accepted: bool


class AuthEventResolutionResponse(BaseModel):
    status: InputResolutionStatus
    challenge_id: str
    challenge_step: ChallengeStep | None = None
    task: TaskRecord | None = None
    lock_expires_at: datetime | None = None


class ChallengeInputRequest(BaseModel):
    device_id: str
    telegram_user_id: int
    chat_id: int
    value: str
    wait_seconds: float = 0


class ChallengeInputResponse(BaseModel):
    status: InputResolutionStatus
    event_id: str | None = None
    challenge_id: str | None = None
    challenge_step: ChallengeStep | None = None
    task: TaskRecord | None = None
    lock_expires_at: datetime | None = None


class ChallengeDecisionRequest(BaseModel):
    device_id: str
    telegram_user_id: int
    chat_id: int
    decision: Literal["confirm", "decline"]


class ChallengeDecisionResponse(BaseModel):
    status: DecisionResolutionStatus
    task: TaskRecord | None = None


class ProtectedTaskContext(BaseModel):
    task: TaskRecord
    response: TaskIntakeResponse
