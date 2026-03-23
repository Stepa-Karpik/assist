from fastapi import APIRouter

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/status")
def task_status() -> dict[str, str]:
    return {"status": "pending-bootstrap"}
