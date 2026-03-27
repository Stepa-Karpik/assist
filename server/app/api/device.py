from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from app.models.device import DeviceOnlineResponse

router = APIRouter(prefix="/devices", tags=["devices"])


class DeviceOnlinePayload(BaseModel):
    device_id: str
    status: str


@router.post("/online", response_model=DeviceOnlineResponse)
def device_online(payload: DeviceOnlinePayload, request: Request) -> DeviceOnlineResponse:
    presence = request.app.state.device_presence_store.mark_online(payload.device_id)
    return DeviceOnlineResponse(**presence.model_dump(mode="python"), acknowledged=True)


@router.get("/{device_id}", response_model=DeviceOnlineResponse)
def get_device_presence(device_id: str, request: Request) -> DeviceOnlineResponse:
    presence = request.app.state.device_presence_store.get_presence(device_id)

    if presence is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    return DeviceOnlineResponse(**presence.model_dump(mode="python"), acknowledged=True)
