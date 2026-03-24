from fastapi import APIRouter, HTTPException, Request

from app.models.delivery import DeliveryAckResponse, DeliveryEventListResponse

router = APIRouter(tags=["bot-delivery"])


@router.get("/bot/outbox", response_model=DeliveryEventListResponse)
def list_bot_outbox(device_id: str, request: Request) -> DeliveryEventListResponse:
    return DeliveryEventListResponse(items=request.app.state.delivery_store.list_pending(device_id))


@router.post("/bot/outbox/{event_id}/ack", response_model=DeliveryAckResponse)
def ack_bot_outbox(event_id: str, request: Request) -> DeliveryAckResponse:
    ack = request.app.state.delivery_store.ack(event_id)

    if ack is None:
        raise HTTPException(status_code=404, detail="Delivery event not found")

    return ack
