from datetime import datetime
from typing import Literal

from pydantic import BaseModel

DeviceStatus = Literal["online"]


class DevicePresenceRecord(BaseModel):
    device_id: str
    status: DeviceStatus = "online"
    last_seen_at: datetime
    is_online: bool


class DeviceOnlineResponse(DevicePresenceRecord):
    acknowledged: bool = True
