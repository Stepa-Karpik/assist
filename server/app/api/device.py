from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from app.models.device import (
    DeviceOnboardingStatusResponse,
    DeviceOnboardingTokenResponse,
    DeviceOnlineResponse,
    DeviceRegistrationRequest,
    DeviceRegistrationResponse,
    DeviceSelectionRequest,
    DeviceSelectionResponse,
    TrustedDeviceItem,
    TrustedDeviceListResponse,
)

router = APIRouter(prefix="/devices", tags=["devices"])


class DeviceOnlinePayload(BaseModel):
    device_id: str
    status: str


def _is_owner_profile_complete(profile) -> bool:
    return bool(profile.full_name and profile.gender and profile.age is not None)


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


@router.post("/register", response_model=DeviceRegistrationResponse)
def register_device(
    payload: DeviceRegistrationRequest, request: Request
) -> DeviceRegistrationResponse:
    device = request.app.state.device_registry.register_device(
        device_id=payload.device_id,
        device_label=payload.device_label,
        owner_label=payload.owner_label,
    )
    return DeviceRegistrationResponse(**device.model_dump(mode="python"))


@router.get("/{device_id}/onboarding", response_model=DeviceOnboardingStatusResponse)
def get_device_onboarding_status(
    device_id: str, request: Request
) -> DeviceOnboardingStatusResponse:
    registry = request.app.state.device_registry
    device = registry.get_device(device_id)
    auth_config = request.app.state.challenge_store.get_auth_config(device_id)
    profile = request.app.state.owner_profile_store.get_profile(device_id)
    trusted_telegram_user_count = len(registry.get_trusted_users(device_id))
    owner_profile_complete = _is_owner_profile_complete(profile)
    device_registered = device is not None

    return DeviceOnboardingStatusResponse(
        device_id=device_id,
        device_registered=device_registered,
        trusted_telegram_user_count=trusted_telegram_user_count,
        owner_profile_complete=owner_profile_complete,
        password_configured=auth_config.password_configured,
        totp_configured=auth_config.totp_configured,
        completed=(
            device_registered
            and trusted_telegram_user_count > 0
            and owner_profile_complete
            and auth_config.password_configured
            and auth_config.totp_configured
        ),
    )


@router.post("/{device_id}/onboarding-token", response_model=DeviceOnboardingTokenResponse)
def create_device_onboarding_token(
    device_id: str, request: Request
) -> DeviceOnboardingTokenResponse:
    registry = request.app.state.device_registry
    device = registry.get_device(device_id)

    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    issued = request.app.state.onboarding_token_store.issue_token(device_id=device_id)
    bot_name = request.app.state.settings.telegram_bot_name

    return DeviceOnboardingTokenResponse(
        device_id=device_id,
        token=issued.token,
        expires_at=issued.expires_at,
        start_link=f"https://t.me/{bot_name}?start=pair_{issued.token}",
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
