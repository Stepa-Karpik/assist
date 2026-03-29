from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

DeviceStatus = Literal["online"]


class DevicePresenceRecord(BaseModel):
    device_id: str
    status: DeviceStatus = "online"
    last_seen_at: datetime
    is_online: bool


class DeviceOnlineResponse(DevicePresenceRecord):
    acknowledged: bool = True


class TrustedDeviceItem(BaseModel):
    device_id: str
    device_label: str
    owner_label: str | None = None
    status: str
    last_seen_at: datetime | None = None
    is_active: bool = False


class TrustedDeviceListResponse(BaseModel):
    telegram_user_id: int
    active_device_id: str | None = None
    items: list[TrustedDeviceItem] = Field(default_factory=list)


class DeviceSelectionRequest(BaseModel):
    telegram_user_id: int
    device_id: str


class DeviceSelectionResponse(BaseModel):
    telegram_user_id: int
    active_device_id: str
