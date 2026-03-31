from fastapi import APIRouter, HTTPException, Request

from app.models.conversation_event import (
    ConversationEvent,
    ConversationEventAckRequest,
    ConversationEventAckResponse,
    ConversationEventCreateRequest,
    ConversationEventListResponse,
    ConversationEventUpdateRequest,
)

router = APIRouter(tags=["conversation-events"])


@router.post("/conversation-events", response_model=ConversationEvent)
def create_conversation_event(
    payload: ConversationEventCreateRequest, request: Request
) -> ConversationEvent:
    return request.app.state.conversation_event_store.create(payload)


@router.get("/conversation-events", response_model=ConversationEventListResponse)
def list_conversation_events(
    device_id: str, request: Request
) -> ConversationEventListResponse:
    return ConversationEventListResponse(
        items=request.app.state.conversation_event_store.list_pending_for_device(device_id)
    )


@router.post("/conversation-events/{event_id}/update", response_model=ConversationEvent)
def update_conversation_event(
    event_id: str, payload: ConversationEventUpdateRequest, request: Request
) -> ConversationEvent:
    event = request.app.state.conversation_event_store.update(event_id, payload)

    if event is None:
        raise HTTPException(status_code=404, detail="Conversation event not found")

    return event


@router.get(
    "/conversation-events/outbox", response_model=ConversationEventListResponse
)
def list_conversation_event_outbox(request: Request) -> ConversationEventListResponse:
    return ConversationEventListResponse(
        items=request.app.state.conversation_event_store.list_pending_for_bot()
    )


@router.post(
    "/conversation-events/{event_id}/ack",
    response_model=ConversationEventAckResponse,
)
def ack_conversation_event(
    event_id: str, payload: ConversationEventAckRequest, request: Request
) -> ConversationEventAckResponse:
    ack = request.app.state.conversation_event_store.ack(event_id, payload.revision)

    if ack is None:
        raise HTTPException(status_code=404, detail="Conversation event not found")

    return ack
