from fastapi import APIRouter, HTTPException, Request

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
