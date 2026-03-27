from fastapi import APIRouter, Request

from app.models.app_catalog import AppCatalogResponse, AppCatalogSyncRequest

router = APIRouter(prefix="/apps", tags=["apps"])


@router.get("", response_model=AppCatalogResponse)
def get_app_catalog(device_id: str, request: Request) -> AppCatalogResponse:
    items = request.app.state.app_catalog_store.get_catalog(device_id)
    return AppCatalogResponse(device_id=device_id, items=items)


@router.post("/catalog", response_model=AppCatalogResponse)
def sync_app_catalog(
    payload: AppCatalogSyncRequest, request: Request
) -> AppCatalogResponse:
    items = request.app.state.app_catalog_store.update_catalog(
        payload.device_id, payload.items
    )
    return AppCatalogResponse(device_id=payload.device_id, items=items)
