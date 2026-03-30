from fastapi import APIRouter, HTTPException, Request

from app.models.conversation_memory import (
    ConversationMemoryEvent,
    ConversationMemoryEventAckResponse,
    ConversationMemoryEventCreateRequest,
    ConversationMemoryEventListResponse,
)

router = APIRouter(tags=["conversation-memory"])


@router.post("/chat-memory/events", response_model=ConversationMemoryEvent)
def create_conversation_memory_event(
    payload: ConversationMemoryEventCreateRequest, request: Request
) -> ConversationMemoryEvent:
    return request.app.state.conversation_memory_store.create(payload)


@router.get("/chat-memory/events", response_model=ConversationMemoryEventListResponse)
def list_conversation_memory_events(
    device_id: str, request: Request
) -> ConversationMemoryEventListResponse:
    return ConversationMemoryEventListResponse(
        items=request.app.state.conversation_memory_store.list_pending(device_id)
    )


@router.post(
    "/chat-memory/events/{event_id}/ack",
    response_model=ConversationMemoryEventAckResponse,
)
def ack_conversation_memory_event(
    event_id: str, request: Request
) -> ConversationMemoryEventAckResponse:
    ack = request.app.state.conversation_memory_store.ack(event_id)

    if ack is None:
        raise HTTPException(status_code=404, detail="Conversation memory event not found")

    return ack
