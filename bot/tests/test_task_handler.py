from app.handlers.task import (
    get_auth_password_prompt_text,
    get_auth_success_text,
    get_cancel_requested_task_text,
    get_cancelled_task_text,
    get_confirm_prompt_text,
    get_decline_text,
    get_device_status_text,
    get_done_task_text,
    get_failed_task_text,
    get_invalid_password_text,
    get_locked_text,
    get_queue_summary_text,
    get_recent_commands_text,
    get_queued_task_text,
    get_running_task_text,
    get_setup_required_text,
    get_task_not_found_text,
    resolve_auth_command,
    resolve_cancel_command,
    resolve_confirm_command,
    resolve_decline_command,
    resolve_device_command,
    resolve_last_command,
    resolve_queue_command,
    resolve_status_command,
    resolve_task_command,
)
from app.task_client import (
    DeviceStatusResult,
    TaskStatusResult,
    TaskSummaryResult,
    TaskWorkflowResult,
)


class FakeTaskClient:
    def __init__(
        self,
        *,
        task_result: TaskWorkflowResult | None = None,
        auth_result: TaskWorkflowResult | None = None,
        decision_result: TaskWorkflowResult | None = None,
        task_status_result: TaskStatusResult | None = None,
        latest_task_result: TaskStatusResult | None = None,
        device_status_result: DeviceStatusResult | None = None,
        queue_result: list[TaskSummaryResult] | None = None,
        recent_result: list[TaskSummaryResult] | None = None,
        cancel_result: TaskStatusResult | None = None,
    ) -> None:
        self.task_result = task_result or TaskWorkflowResult(status="ignored")
        self.auth_result = auth_result or TaskWorkflowResult(status="ignored")
        self.decision_result = decision_result or TaskWorkflowResult(status="ignored")
        self.task_status_result = task_status_result or TaskStatusResult(found=False)
        self.latest_task_result = latest_task_result or TaskStatusResult(found=False)
        self.device_status_result = device_status_result or DeviceStatusResult(found=False)
        self.queue_result = queue_result or []
        self.recent_result = recent_result or []
        self.cancel_result = cancel_result or TaskStatusResult(found=False)

    def create_task(
        self, telegram_user_id: int, chat_id: int, risk: str, intent: str
    ) -> TaskWorkflowResult:
        del telegram_user_id, chat_id, risk, intent
        return self.task_result

    def submit_auth_input(
        self,
        telegram_user_id: int,
        chat_id: int,
        value: str,
        challenge_id: str | None = None,
    ) -> TaskWorkflowResult:
        del telegram_user_id, chat_id, value, challenge_id
        return self.auth_result

    def submit_decision(
        self,
        telegram_user_id: int,
        chat_id: int,
        decision: str,
        challenge_id: str | None = None,
    ) -> TaskWorkflowResult:
        del telegram_user_id, chat_id, decision, challenge_id
        return self.decision_result

    def fetch_task(self, task_id: str) -> TaskStatusResult:
        del task_id
        return self.task_status_result

    def fetch_latest_task(self, chat_id: int) -> TaskStatusResult:
        del chat_id
        return self.latest_task_result

    def fetch_device_status(self) -> DeviceStatusResult:
        return self.device_status_result

    def fetch_active_queue(self) -> list[TaskSummaryResult]:
        return self.queue_result

    def fetch_recent_commands(self, limit: int = 5) -> list[TaskSummaryResult]:
        del limit
        return self.recent_result

    def cancel_task(self, task_id: str) -> TaskStatusResult:
        del task_id
        return self.cancel_result


def test_untrusted_task_stays_silent() -> None:
    task_client = FakeTaskClient(task_result=TaskWorkflowResult(status="ignored"))

    response = resolve_task_command(
        "/task low send status",
        telegram_user_id=42,
        chat_id=1001,
        task_client=task_client,
    )

    assert response is None


def test_low_risk_task_queues_immediately() -> None:
    task_client = FakeTaskClient(
        task_result=TaskWorkflowResult(status="queued", task_id="task-1")
    )

    response = resolve_task_command(
        "/task low send status",
        telegram_user_id=42,
        chat_id=1001,
        task_client=task_client,
    )

    assert response == get_queued_task_text("task-1")


def test_low_risk_task_reports_offline_queue_state() -> None:
    task_client = FakeTaskClient(
        task_result=TaskWorkflowResult(
            status="queued",
            task_id="task-1",
            device_online=False,
        )
    )

    response = resolve_task_command(
        "/task low send status",
        telegram_user_id=42,
        chat_id=1001,
        task_client=task_client,
    )

    assert response == "Задача task-1 поставлена в очередь. ПК сейчас офлайн."


def test_medium_risk_task_prompts_for_password() -> None:
    task_client = FakeTaskClient(
        task_result=TaskWorkflowResult(status="awaiting_auth", challenge_step="password")
    )

    response = resolve_task_command(
        "/task medium export logs",
        telegram_user_id=42,
        chat_id=1001,
        task_client=task_client,
    )

    assert response == get_auth_password_prompt_text()


def test_auth_command_transitions_to_totp_and_confirm() -> None:
    totp_client = FakeTaskClient(auth_result=TaskWorkflowResult(status="totp_required"))
    confirm_client = FakeTaskClient(
        auth_result=TaskWorkflowResult(status="confirm_required")
    )

    totp_response = resolve_auth_command(
        "/auth secret-password",
        telegram_user_id=42,
        chat_id=1001,
        task_client=totp_client,
    )
    confirm_response = resolve_auth_command(
        "/auth 123456",
        telegram_user_id=42,
        chat_id=1001,
        task_client=confirm_client,
    )

    assert totp_response == "Пароль принят. Введите код из приложения-аутентификатора."
    assert confirm_response == get_confirm_prompt_text()


def test_confirm_queues_the_task() -> None:
    task_client = FakeTaskClient(
        decision_result=TaskWorkflowResult(status="task_queued", task_id="task-7")
    )

    response = resolve_confirm_command(
        "/confirm",
        telegram_user_id=42,
        chat_id=1001,
        task_client=task_client,
    )

    assert response == get_queued_task_text("task-7")


def test_decline_cancels_the_task() -> None:
    task_client = FakeTaskClient(decision_result=TaskWorkflowResult(status="declined"))

    response = resolve_decline_command(
        "/decline",
        telegram_user_id=42,
        chat_id=1001,
        task_client=task_client,
    )

    assert response == get_decline_text()


def test_lockout_and_setup_required_are_reported() -> None:
    locked_client = FakeTaskClient(auth_result=TaskWorkflowResult(status="locked"))
    setup_client = FakeTaskClient(
        task_result=TaskWorkflowResult(
            status="setup_required",
            message="Сначала настрой пароль и TOTP в GUI Karpik на ПК.",
        )
    )

    locked_response = resolve_auth_command(
        "/auth wrong",
        telegram_user_id=42,
        chat_id=1001,
        task_client=locked_client,
    )
    setup_response = resolve_task_command(
        "/task medium export logs",
        telegram_user_id=42,
        chat_id=1001,
        task_client=setup_client,
    )

    assert locked_response == get_locked_text()
    assert setup_response == get_setup_required_text()


def test_invalid_password_is_reported() -> None:
    task_client = FakeTaskClient(
        auth_result=TaskWorkflowResult(status="invalid_password")
    )

    response = resolve_auth_command(
        "/auth wrong",
        telegram_user_id=42,
        chat_id=1001,
        task_client=task_client,
    )

    assert response == get_invalid_password_text()
    assert get_auth_success_text() == "Авторизация пройдена. Задача поставлена в очередь."


def test_status_command_returns_done_and_running_task_states() -> None:
    done_client = FakeTaskClient(
        task_status_result=TaskStatusResult(
            found=True,
            task_id="task-1",
            status="done",
            result_text="desktop-local is online",
        )
    )
    running_client = FakeTaskClient(
        task_status_result=TaskStatusResult(
            found=True,
            task_id="task-2",
            status="running",
        )
    )

    done_response = resolve_status_command(
        "/status task-1",
        telegram_user_id=42,
        chat_id=1001,
        task_client=done_client,
    )
    running_response = resolve_status_command(
        "/status task-2",
        telegram_user_id=42,
        chat_id=1001,
        task_client=running_client,
    )

    assert done_response == get_done_task_text("task-1", "desktop-local is online")
    assert running_response == get_running_task_text("task-2")


def test_status_without_id_returns_latest_chat_task() -> None:
    task_client = FakeTaskClient(
        latest_task_result=TaskStatusResult(
            found=True,
            task_id="task-3",
            status="failed",
            error_text="File not found.",
        )
    )

    response = resolve_status_command(
        "/status",
        telegram_user_id=42,
        chat_id=1001,
        task_client=task_client,
    )

    assert response == get_failed_task_text("task-3", "File not found.")


def test_status_reports_not_found_or_stays_silent_for_ignored_chat() -> None:
    not_found_client = FakeTaskClient(task_status_result=TaskStatusResult(found=False))
    ignored_client = FakeTaskClient(latest_task_result=TaskStatusResult(found=False))

    not_found_response = resolve_status_command(
        "/status task-404",
        telegram_user_id=42,
        chat_id=1001,
        task_client=not_found_client,
    )
    ignored_response = resolve_status_command(
        "/status",
        telegram_user_id=42,
        chat_id=1001,
        task_client=ignored_client,
    )

    assert not_found_response == get_task_not_found_text()
    assert ignored_response is None


def test_device_queue_and_recent_operator_commands_are_reported() -> None:
    task_client = FakeTaskClient(
        device_status_result=DeviceStatusResult(
            found=True,
            device_id="stepa-desktop",
            is_online=True,
            last_seen_at="2026-03-27T10:00:00Z",
            pending_count=2,
            attention_count=1,
        ),
        queue_result=[
            TaskSummaryResult(
                task_id="task-1",
                status="running",
                intent="codex summarize release notes",
            ),
            TaskSummaryResult(
                task_id="task-2",
                status="awaiting_local_approval",
                intent="codex-write update README",
            ),
        ],
        recent_result=[
            TaskSummaryResult(
                task_id="task-3",
                status="done",
                intent="status",
            ),
            TaskSummaryResult(
                task_id="task-2",
                status="awaiting_local_approval",
                intent="codex-write update README",
            ),
        ],
    )

    device_response = resolve_device_command(task_client=task_client)
    queue_response = resolve_queue_command(task_client=task_client)
    last_response = resolve_last_command(task_client=task_client)

    assert device_response == get_device_status_text(
        device_id="stepa-desktop",
        is_online=True,
        last_seen_at="2026-03-27T10:00:00Z",
        pending_count=2,
        attention_count=1,
    )
    assert queue_response == get_queue_summary_text(task_client.queue_result)
    assert last_response == get_recent_commands_text(task_client.recent_result)


def test_cancel_command_reports_cancelled_and_not_found_states() -> None:
    cancelled_client = FakeTaskClient(
        cancel_result=TaskStatusResult(
            found=True,
            task_id="task-9",
            status="cancelled",
        )
    )
    stopping_client = FakeTaskClient(
        cancel_result=TaskStatusResult(
            found=True,
            task_id="task-7",
            status="cancel_requested",
        )
    )
    missing_client = FakeTaskClient(cancel_result=TaskStatusResult(found=False))

    assert (
        resolve_cancel_command("/kill task-9", task_client=cancelled_client)
        == get_cancelled_task_text("task-9")
    )
    assert (
        resolve_cancel_command("/kill task-7", task_client=stopping_client)
        == get_cancel_requested_task_text("task-7")
    )
    assert (
        resolve_cancel_command("/kill task-404", task_client=missing_client)
        == get_task_not_found_text()
    )
