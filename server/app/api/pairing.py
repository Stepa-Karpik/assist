from fastapi import APIRouter, Request

from app.models.pairing import PairingCloseRequest, PairingOpenRequest, PairingSession

router = APIRouter(prefix="/pairing", tags=["pairing"])


@router.post("/open", response_model=PairingSession)
def open_pairing_session(payload: PairingOpenRequest, request: Request) -> PairingSession:
    session = PairingSession(
        device_id=payload.device_id,
        status="active",
        expires_at=payload.expires_at,
    )
    return request.app.state.pairing_store.open_session(session)


@router.post("/close", response_model=PairingSession | None)
def close_pairing_session(payload: PairingCloseRequest, request: Request) -> PairingSession | None:
    return request.app.state.pairing_store.close_session(payload.device_id)
