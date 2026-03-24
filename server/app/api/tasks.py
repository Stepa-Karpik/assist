from fastapi import APIRouter, HTTPException, Request, status

from app.models.task import (
    RequiredAuth,
    TaskAwaitingLocalApprovalRequest,
    TaskBlockRequest,
    TaskCompleteRequest,
    TaskCreateRequest,
    TaskFailRequest,
    TaskIntakeResponse,
    TaskRecord,
    TaskListResponse,
    TaskRisk,
)
from app.services.task_policy import apply_task_policy

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
    payload = apply_task_policy(payload)
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
        task_store.persist()
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
    task_store.persist()
    return TaskIntakeResponse(
        status="awaiting_auth",
        task=task.model_copy(),
        challenge_id=challenge.challenge_id,
        challenge_step=challenge.step,
    )


@router.get("", response_model=TaskListResponse)
def list_tasks(
    device_id: str,
    request: Request,
    include_history: bool = False,
    chat_id: int | None = None,
) -> TaskListResponse:
    return TaskListResponse(
        items=request.app.state.task_store.list_tasks(
            device_id,
            include_history=include_history,
            chat_id=chat_id,
        )
    )


@router.get("/{task_id}", response_model=TaskRecord)
def get_task(task_id: str, request: Request) -> TaskRecord:
    task = request.app.state.task_store.get_task(task_id)

    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    return task


@router.post("/{task_id}/start", response_model=TaskRecord)
def start_task(task_id: str, request: Request) -> TaskRecord:
    task = request.app.state.task_store.start_task(task_id)

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Task cannot be started",
        )

    return task


@router.post("/{task_id}/awaiting-local-approval", response_model=TaskRecord)
def await_local_approval(
    task_id: str,
    payload: TaskAwaitingLocalApprovalRequest,
    request: Request,
) -> TaskRecord:
    task = request.app.state.task_store.await_local_approval(task_id, payload.result_text)

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Task cannot wait for local approval",
        )

    return task


@router.post("/{task_id}/complete", response_model=TaskRecord)
def complete_task(
    task_id: str,
    payload: TaskCompleteRequest,
    request: Request,
) -> TaskRecord:
    task = request.app.state.task_store.complete_task(
        task_id, payload.result_text, payload.artifact
    )

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Task cannot be completed",
        )

    request.app.state.delivery_store.create_for_task(task)
    return task


@router.post("/{task_id}/fail", response_model=TaskRecord)
def fail_task(
    task_id: str,
    payload: TaskFailRequest,
    request: Request,
) -> TaskRecord:
    task = request.app.state.task_store.fail_task(task_id, payload.error_text)

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Task cannot be failed",
        )

    request.app.state.delivery_store.create_for_task(task)
    return task


@router.post("/{task_id}/retry", response_model=TaskRecord)
def retry_task(task_id: str, request: Request) -> TaskRecord:
    task = request.app.state.task_store.retry_task(task_id)

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Task cannot be retried",
        )

    return task


@router.post("/{task_id}/block", response_model=TaskRecord)
def block_task(
    task_id: str,
    payload: TaskBlockRequest,
    request: Request,
) -> TaskRecord:
    task = request.app.state.task_store.block_task(task_id, payload.error_text)

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Task cannot be blocked",
        )

    request.app.state.delivery_store.create_for_task(task)
    return task
