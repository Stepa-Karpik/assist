from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from app.models.device import (
    DeviceOnlineResponse,
    DeviceSelectionRequest,
    DeviceSelectionResponse,
    TrustedDeviceItem,
    TrustedDeviceListResponse,
)

router = APIRouter(prefix="/devices", tags=["devices"])


class DeviceOnlinePayload(BaseModel):
    device_id: str
    status: str


@router.get("", response_model=TrustedDeviceListResponse)
def list_trusted_devices(telegram_user_id: int, request: Request) -> TrustedDeviceListResponse:
    registry = request.app.state.device_registry
    active_device_id = registry.resolve_active_device(telegram_user_id)
    items = [
        TrustedDeviceItem(
            device_id=device.device_id,
            device_label=device.device_label,
            owner_label=device.owner_label,
            status=device.status,
            last_seen_at=device.last_seen_at,
            is_active=device.device_id == active_device_id,
        )
        for device in registry.get_trusted_devices(telegram_user_id)
    ]
    return TrustedDeviceListResponse(
        telegram_user_id=telegram_user_id,
        active_device_id=active_device_id,
        items=items,
    )


@router.post("/use", response_model=DeviceSelectionResponse)
def set_active_device(
    payload: DeviceSelectionRequest, request: Request
) -> DeviceSelectionResponse:
    registry = request.app.state.device_registry

    try:
        active_device_id = registry.set_active_device(
            telegram_user_id=payload.telegram_user_id,
            device_id=payload.device_id,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error

    return DeviceSelectionResponse(
        telegram_user_id=payload.telegram_user_id,
        active_device_id=active_device_id,
    )


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
