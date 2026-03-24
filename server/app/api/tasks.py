from fastapi import APIRouter, Request, status

from app.models.task import (
    RequiredAuth,
    TaskCreateRequest,
    TaskIntakeResponse,
    TaskListResponse,
    TaskRisk,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


def get_required_auth(risk: TaskRisk) -> RequiredAuth:
    if risk == "medium":
        return "password"

    if risk == "high":
        return "password_and_totp"

    return "none"


def requires_desktop_auth_setup(payload: TaskCreateRequest, request: Request) -> bool:
    challenge_store = request.app.state.challenge_store
    auth_config = challenge_store.get_auth_config(payload.device_id)

    if payload.risk == "medium":
        return not auth_config.password_configured

    if payload.risk == "high":
        return not auth_config.password_configured or not auth_config.totp_configured

    return False


@router.post("", response_model=TaskIntakeResponse, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreateRequest, request: Request) -> TaskIntakeResponse:
    task_store = request.app.state.task_store
    pairing_store = request.app.state.pairing_store
    challenge_store = request.app.state.challenge_store

    if (
        payload.source != "telegram"
        or payload.telegram_user_id is None
        or payload.chat_id is None
    ):
        task = task_store.create_task(payload)
        return TaskIntakeResponse(status="queued", task=task)

    trusted_users = pairing_store.get_trusted_users(payload.device_id)
    if payload.telegram_user_id not in trusted_users:
        return TaskIntakeResponse(status="ignored")

    lock_expires_at = challenge_store.get_lock_expires_at(
        payload.device_id, payload.telegram_user_id, payload.chat_id
    )
    if lock_expires_at is not None:
        return TaskIntakeResponse(status="locked", lock_expires_at=lock_expires_at)

    if requires_desktop_auth_setup(payload, request):
        return TaskIntakeResponse(
            status="setup_required",
            message="Настрой пароль и TOTP в GUI Karpik на ПК.",
        )

    required_auth = get_required_auth(payload.risk)

    if payload.risk == "low":
        task = task_store.create_task(payload, required_auth=required_auth)
        return TaskIntakeResponse(status="queued", task=task)

    if challenge_store.has_trust_window(
        payload.device_id, payload.telegram_user_id, payload.chat_id, payload.risk
    ):
        if payload.risk == "medium":
            task = task_store.create_task(payload, required_auth=required_auth)
            return TaskIntakeResponse(status="queued", task=task)

        task = task_store.create_task(
            payload,
            status="awaiting_auth",
            required_auth=required_auth,
        )
        challenge = challenge_store.create_challenge(task, step="confirm")
        return TaskIntakeResponse(
            status="awaiting_auth",
            task=task.model_copy(),
            challenge_id=challenge.challenge_id,
            challenge_step=challenge.step,
        )

    task = task_store.create_task(
        payload,
        status="awaiting_auth",
        required_auth=required_auth,
    )
    challenge = challenge_store.create_challenge(task, step="password")
    return TaskIntakeResponse(
        status="awaiting_auth",
        task=task.model_copy(),
        challenge_id=challenge.challenge_id,
        challenge_step=challenge.step,
    )


@router.get("", response_model=TaskListResponse)
def list_tasks(device_id: str, request: Request) -> TaskListResponse:
    return TaskListResponse(items=request.app.state.task_store.list_queued_tasks(device_id))
