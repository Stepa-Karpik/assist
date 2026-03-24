from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import JSONResponse

from app.models.challenge import (
    AuthConfigStatus,
    AuthConfigStatusRequest,
    AuthEventListResponse,
    AuthEventResolutionRequest,
    AuthEventResolutionResponse,
    ChallengeDecisionRequest,
    ChallengeDecisionResponse,
    ChallengeInputRequest,
    ChallengeInputResponse,
)

router = APIRouter(tags=["auth-challenges"])


@router.post("/auth/config/status", response_model=AuthConfigStatus)
def set_auth_config_status(
    payload: AuthConfigStatusRequest, request: Request
) -> AuthConfigStatus:
    return request.app.state.challenge_store.set_auth_config(payload)


@router.get("/auth/events", response_model=AuthEventListResponse)
def list_auth_events(device_id: str, request: Request) -> AuthEventListResponse:
    return AuthEventListResponse(items=request.app.state.challenge_store.list_pending_events(device_id))


@router.post(
    "/auth/events/{event_id}/resolve", response_model=AuthEventResolutionResponse
)
def resolve_auth_event(
    event_id: str, payload: AuthEventResolutionRequest, request: Request
) -> AuthEventResolutionResponse:
    resolved = request.app.state.challenge_store.resolve_auth_event(
        event_id, payload, request.app.state.task_store
    )

    if resolved is None or resolved.response_status is None:
        raise HTTPException(status_code=404, detail="Auth event not found")

    return AuthEventResolutionResponse(
        status=resolved.response_status,
        challenge_id=resolved.challenge_id,
        challenge_step=resolved.next_step,
        task=resolved.task,
        lock_expires_at=resolved.lock_expires_at,
    )


@router.post("/challenges/input", response_model=ChallengeInputResponse)
def submit_challenge_input(
    payload: ChallengeInputRequest, request: Request
) -> ChallengeInputResponse:
    event = request.app.state.challenge_store.create_auth_event(
        payload.device_id, payload.telegram_user_id, payload.chat_id, payload.value
    )

    if event is None:
        return ChallengeInputResponse(status="ignored")

    resolved = request.app.state.challenge_store.wait_for_event_resolution(
        event.event_id, payload.wait_seconds
    )

    if resolved is not None and resolved.status == "resolved" and resolved.response_status is not None:
        return ChallengeInputResponse(
            status=resolved.response_status,
            event_id=resolved.event_id,
            challenge_id=resolved.challenge_id,
            challenge_step=resolved.next_step,
            task=resolved.task,
            lock_expires_at=resolved.lock_expires_at,
        )

    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content=ChallengeInputResponse(
            status="pending",
            event_id=event.event_id,
            challenge_id=event.challenge_id,
            challenge_step=event.step,
        ).model_dump(mode="json"),
    )


@router.post("/challenges/decision", response_model=ChallengeDecisionResponse)
def submit_challenge_decision(
    payload: ChallengeDecisionRequest, request: Request
) -> ChallengeDecisionResponse:
    status_value, task = request.app.state.challenge_store.handle_decision(
        payload.device_id,
        payload.telegram_user_id,
        payload.chat_id,
        payload.decision,
        request.app.state.task_store,
    )
    return ChallengeDecisionResponse(status=status_value, task=task)
