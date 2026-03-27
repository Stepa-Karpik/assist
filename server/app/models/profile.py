from pydantic import BaseModel


class OwnerProfile(BaseModel):
    full_name: str | None = None
    gender: str | None = None
    age: int | None = None
    city: str | None = None
    timezone: str | None = None
    language: str | None = None
    contacts: str | None = None
    occupation: str | None = None
    bio: str | None = None
    notes: str | None = None


class OwnerProfileSyncRequest(BaseModel):
    device_id: str
    profile: OwnerProfile = OwnerProfile()


class OwnerProfileResponse(BaseModel):
    device_id: str
    profile: OwnerProfile = OwnerProfile()
