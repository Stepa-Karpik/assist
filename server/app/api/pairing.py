from fastapi import APIRouter, Request

from app.models.pairing import (
    PairingCloseRequest,
    PairingOpenRequest,
    PairingSession,
    PairingStateResponse,
)

router = APIRouter(prefix="/pairing", tags=["pairing"])


@router.post("/open", response_model=PairingStateResponse)
def open_pairing_session(payload: PairingOpenRequest, request: Request) -> PairingStateResponse:
    session = PairingSession(
        device_id=payload.device_id,
        code=payload.code,
        status="active",
        expires_at=payload.expires_at,
    )
    request.app.state.pairing_store.open_session(session)
    return request.app.state.pairing_store.get_state(payload.device_id)


@router.get("/state", response_model=PairingStateResponse)
def get_pairing_state(device_id: str, request: Request) -> PairingStateResponse:
    return request.app.state.pairing_store.get_state(device_id)


@router.post("/close", response_model=PairingStateResponse)
def close_pairing_session(payload: PairingCloseRequest, request: Request) -> PairingStateResponse:
    return request.app.state.pairing_store.close_session(payload.device_id)
