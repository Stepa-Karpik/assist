from fastapi import APIRouter, HTTPException, Request

from app.models.device import StartLinkConsumeRequest, StartLinkConsumeResponse
from app.models.pairing import (
    PairAttemptRequest,
    PairAttemptResolutionRequest,
    PairAttemptResolutionResponse,
    PairAttemptResponse,
    PairingEventListResponse,
)

router = APIRouter(tags=["pairing-events"])


@router.post("/bot/pair-attempt", response_model=PairAttemptResponse)
def create_pair_attempt(payload: PairAttemptRequest, request: Request) -> PairAttemptResponse:
    result = request.app.state.pairing_store.submit_pair_attempt(
        code=payload.code,
        telegram_user_id=payload.telegram_user_id,
        device_id=payload.device_id,
    )
    return PairAttemptResponse(status=result)


@router.post("/bot/start-link", response_model=StartLinkConsumeResponse)
def consume_start_link(
    payload: StartLinkConsumeRequest, request: Request
) -> StartLinkConsumeResponse:
    token_record = request.app.state.onboarding_token_store.consume_token(payload.token)

    if token_record is None:
        return StartLinkConsumeResponse(paired=False)

    request.app.state.device_registry.grant_trust(
        device_id=token_record.device_id,
        telegram_user_id=payload.telegram_user_id,
        set_active=True,
    )
    device = request.app.state.device_registry.get_device(token_record.device_id)

    return StartLinkConsumeResponse(
        device_id=token_record.device_id,
        device_label=device.device_label if device is not None else token_record.device_id,
        paired=True,
    )


@router.get("/events", response_model=PairingEventListResponse)
def list_pairing_events(device_id: str, request: Request) -> PairingEventListResponse:
    _ = request
    _ = device_id
    return PairingEventListResponse(items=[])


@router.post("/events/{event_id}/resolve", response_model=PairAttemptResolutionResponse)
def resolve_pairing_event(
    event_id: str, payload: PairAttemptResolutionRequest, request: Request
) -> PairAttemptResolutionResponse:
    _ = payload
    _ = request
    raise HTTPException(status_code=404, detail=f"Pairing event {event_id} not found")
