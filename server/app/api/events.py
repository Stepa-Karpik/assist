from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import JSONResponse

from app.models.pairing import (
    PairAttemptEvent,
    PairAttemptRequest,
    PairAttemptResolutionRequest,
    PairAttemptResolutionResponse,
    PairAttemptResponse,
    PairingEventListResponse,
)

router = APIRouter(tags=["pairing-events"])


@router.post("/bot/pair-attempt", response_model=PairAttemptResponse)
def create_pair_attempt(payload: PairAttemptRequest, request: Request) -> PairAttemptResponse:
    store = request.app.state.pairing_store
    event = PairAttemptEvent(
        device_id=payload.device_id or "",
        telegram_user_id=payload.telegram_user_id,
        chat_id=payload.chat_id,
        code=payload.code,
    )
    created = store.create_pair_attempt(event)

    if created is None:
        return PairAttemptResponse(status="ignored")

    if created.status == "resolved" and created.result is not None:
        return PairAttemptResponse(status=created.result, event_id=created.event_id)

    resolved = store.wait_for_resolution(created.event_id, payload.wait_seconds)

    if resolved is not None and resolved.status == "resolved" and resolved.result is not None:
        return PairAttemptResponse(status=resolved.result, event_id=resolved.event_id)

    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content=PairAttemptResponse(status="pending", event_id=created.event_id).model_dump(),
    )


@router.get("/events", response_model=PairingEventListResponse)
def list_pairing_events(device_id: str, request: Request) -> PairingEventListResponse:
    store = request.app.state.pairing_store
    return PairingEventListResponse(items=store.list_pending_events(device_id))


@router.post("/events/{event_id}/resolve", response_model=PairAttemptResolutionResponse)
def resolve_pairing_event(
    event_id: str, payload: PairAttemptResolutionRequest, request: Request
) -> PairAttemptResolutionResponse:
    store = request.app.state.pairing_store
    resolved = store.resolve_event(event_id, payload)

    if resolved is None or resolved.result is None:
        raise HTTPException(status_code=404, detail="Pairing event not found")

    return PairAttemptResolutionResponse(
        event_id=resolved.event_id,
        result=resolved.result,
        trusted_users=store.get_trusted_users(resolved.device_id),
    )
