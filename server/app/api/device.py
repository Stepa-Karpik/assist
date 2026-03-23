from pydantic import BaseModel
from fastapi import APIRouter

router = APIRouter(prefix="/devices", tags=["devices"])


class DeviceOnlinePayload(BaseModel):
    device_id: str
    status: str


@router.post("/online")
def device_online(payload: DeviceOnlinePayload) -> dict[str, str | bool]:
    return {
        "device_id": payload.device_id,
        "status": payload.status,
        "acknowledged": True,
    }
