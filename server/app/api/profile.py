from fastapi import APIRouter, Request

from app.models.profile import OwnerProfileResponse, OwnerProfileSyncRequest

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=OwnerProfileResponse)
def get_owner_profile(device_id: str, request: Request) -> OwnerProfileResponse:
    profile = request.app.state.owner_profile_store.get_profile(device_id)
    return OwnerProfileResponse(device_id=device_id, profile=profile)


@router.post("", response_model=OwnerProfileResponse)
def sync_owner_profile(
    payload: OwnerProfileSyncRequest, request: Request
) -> OwnerProfileResponse:
    profile = request.app.state.owner_profile_store.save_profile(
        payload.device_id, payload.profile
    )
    return OwnerProfileResponse(device_id=payload.device_id, profile=profile)
