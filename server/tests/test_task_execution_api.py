from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def setup_function() -> None:
    app.state.pairing_store.reset()
    app.state.task_store.reset()
    app.state.challenge_store.reset()


def trust_telegram_user(
    *, device_id: str = "desktop-local", telegram_user_id: int = 101, chat_id: int = 5001
) -> None:
    client.post(
        "/api/pairing/open",
        json={
            "device_id": device_id,
            "code": "ABC123",
            "expires_at": "2030-03-24T01:45:00Z",
        },
    )
    pair_response = client.post(
        "/api/bot/pair-attempt",
        json={
            "device_id": device_id,
            "telegram_user_id": telegram_user_id,
            "chat_id": chat_id,
            "code": "ABC123",
            "wait_seconds": 0,
        },
    )
    assert pair_response.status_code == 200
    assert pair_response.json()["status"] == "paired"


def create_low_risk_telegram_task(
    *, device_id: str = "desktop-local", telegram_user_id: int = 101, chat_id: int = 5001
) -> str:
    trust_telegram_user(
        device_id=device_id,
        telegram_user_id=telegram_user_id,
        chat_id=chat_id,
    )
    response = client.post(
        "/api/tasks",
        json={
            "device_id": device_id,
            "intent": "status",
            "source": "telegram",
            "risk": "low",
            "telegram_user_id": telegram_user_id,
            "chat_id": chat_id,
        },
    )
    return response.json()["task"]["task_id"]


def test_task_detail_exposes_execution_fields() -> None:
    task_id = create_low_risk_telegram_task()

    response = client.get(f"/api/tasks/{task_id}")

    assert response.status_code == 200
    assert response.json()["task_id"] == task_id
    assert response.json()["telegram_user_id"] == 101
    assert response.json()["chat_id"] == 5001
    assert response.json()["status"] == "queued"
    assert response.json()["result_text"] is None
    assert response.json()["error_text"] is None
    assert response.json()["started_at"] is None
    assert response.json()["finished_at"] is None
    assert response.json()["attempt_count"] == 0


def test_desktop_can_start_and_complete_task() -> None:
    task_id = create_low_risk_telegram_task()

    start_response = client.post(f"/api/tasks/{task_id}/start")
    complete_response = client.post(
        f"/api/tasks/{task_id}/complete",
        json={"result_text": "desktop-local is online"},
    )

    assert start_response.status_code == 200
    assert start_response.json()["status"] == "running"
    assert start_response.json()["started_at"] is not None
    assert start_response.json()["attempt_count"] == 1

    assert complete_response.status_code == 200
    assert complete_response.json()["status"] == "done"
    assert complete_response.json()["result_text"] == "desktop-local is online"
    assert complete_response.json()["error_text"] is None
    assert complete_response.json()["finished_at"] is not None


def test_desktop_can_fail_task_with_error_text() -> None:
    task_id = create_low_risk_telegram_task()

    client.post(f"/api/tasks/{task_id}/start")
    fail_response = client.post(
        f"/api/tasks/{task_id}/fail",
        json={"error_text": "unsupported task intent"},
    )

    assert fail_response.status_code == 200
    assert fail_response.json()["status"] == "failed"
    assert fail_response.json()["result_text"] is None
    assert fail_response.json()["error_text"] == "unsupported task intent"
    assert fail_response.json()["finished_at"] is not None


def test_desktop_can_retry_failed_task() -> None:
    task_id = create_low_risk_telegram_task()

    client.post(f"/api/tasks/{task_id}/start")
    client.post(
        f"/api/tasks/{task_id}/fail",
        json={"error_text": "unsupported task intent"},
    )

    retry_response = client.post(f"/api/tasks/{task_id}/retry")
    second_start_response = client.post(f"/api/tasks/{task_id}/start")

    assert retry_response.status_code == 200
    assert retry_response.json()["status"] == "queued"
    assert retry_response.json()["result_text"] is None
    assert retry_response.json()["error_text"] is None
    assert retry_response.json()["started_at"] is None
    assert retry_response.json()["finished_at"] is None
    assert retry_response.json()["attempt_count"] == 1

    assert second_start_response.status_code == 200
    assert second_start_response.json()["status"] == "running"
    assert second_start_response.json()["attempt_count"] == 2


def test_desktop_cannot_retry_done_task() -> None:
    task_id = create_low_risk_telegram_task()

    client.post(f"/api/tasks/{task_id}/start")
    client.post(
        f"/api/tasks/{task_id}/complete",
        json={"result_text": "desktop-local is online"},
    )

    retry_response = client.post(f"/api/tasks/{task_id}/retry")

    assert retry_response.status_code == 409
    assert retry_response.json()["detail"] == "Task cannot be retried"


def test_desktop_can_publish_local_approval_wait_state() -> None:
    task_id = create_low_risk_telegram_task()

    client.post(f"/api/tasks/{task_id}/start")
    approval_response = client.post(
        f"/api/tasks/{task_id}/awaiting-local-approval",
        json={"result_text": "Waiting for local review. Files: README.md"},
    )

    assert approval_response.status_code == 200
    assert approval_response.json()["status"] == "awaiting_local_approval"
    assert approval_response.json()["result_text"] == "Waiting for local review. Files: README.md"
    assert approval_response.json()["error_text"] is None


def test_task_can_complete_after_local_approval() -> None:
    task_id = create_low_risk_telegram_task()

    client.post(f"/api/tasks/{task_id}/start")
    client.post(
        f"/api/tasks/{task_id}/awaiting-local-approval",
        json={"result_text": "Waiting for local review. Files: README.md"},
    )
    complete_response = client.post(
        f"/api/tasks/{task_id}/complete",
        json={"result_text": "Applied locally. Updated README.md"},
    )

    assert complete_response.status_code == 200
    assert complete_response.json()["status"] == "done"
    assert complete_response.json()["result_text"] == "Applied locally. Updated README.md"
    assert complete_response.json()["finished_at"] is not None


def test_task_can_be_blocked_after_local_reject() -> None:
    task_id = create_low_risk_telegram_task()

    client.post(f"/api/tasks/{task_id}/start")
    client.post(
        f"/api/tasks/{task_id}/awaiting-local-approval",
        json={"result_text": "Waiting for local review. Files: README.md"},
    )
    block_response = client.post(
        f"/api/tasks/{task_id}/block",
        json={"error_text": "Rejected locally."},
    )

    assert block_response.status_code == 200
    assert block_response.json()["status"] == "blocked"
    assert block_response.json()["result_text"] is None
    assert block_response.json()["error_text"] == "Rejected locally."
    assert block_response.json()["finished_at"] is not None


def test_task_history_returns_recent_items_and_chat_filtered_view() -> None:
    first_task_id = create_low_risk_telegram_task(chat_id=5001)
    second_task_id = create_low_risk_telegram_task(chat_id=6001)

    client.post(f"/api/tasks/{first_task_id}/start")
    client.post(
        f"/api/tasks/{first_task_id}/complete",
        json={"result_text": "desktop-local is online"},
    )

    history_response = client.get(
        "/api/tasks",
        params={"device_id": "desktop-local", "include_history": "true"},
    )
    chat_response = client.get(
        "/api/tasks",
        params={
            "device_id": "desktop-local",
            "include_history": "true",
            "chat_id": 5001,
        },
    )

    assert history_response.status_code == 200
    assert [item["task_id"] for item in history_response.json()["items"]] == [
        second_task_id,
        first_task_id,
    ]
    assert history_response.json()["items"][0]["status"] == "queued"
    assert history_response.json()["items"][1]["status"] == "done"

    assert chat_response.status_code == 200
    assert [item["task_id"] for item in chat_response.json()["items"]] == [first_task_id]
    assert chat_response.json()["items"][0]["result_text"] == "desktop-local is online"


def test_task_history_omits_artifact_payload_but_task_detail_keeps_it() -> None:
    task_id = create_low_risk_telegram_task(chat_id=5001)

    client.post(f"/api/tasks/{task_id}/start")
    client.post(
        f"/api/tasks/{task_id}/complete",
        json={
            "result_text": "Screenshot captured.",
            "artifact": {
                "kind": "image_base64",
                "mime_type": "image/png",
                "file_name": "screen.png",
                "content_base64": "c2NyZWVuc2hvdA==",
            },
        },
    )

    history_response = client.get(
        "/api/tasks",
        params={"device_id": "desktop-local", "include_history": "true"},
    )
    detail_response = client.get(f"/api/tasks/{task_id}")

    assert history_response.status_code == 200
    assert history_response.json()["items"][0]["artifact_kind"] == "image_base64"
    assert history_response.json()["items"][0]["artifact_file_name"] == "screen.png"
    assert history_response.json()["items"][0]["artifact_base64"] is None

    assert detail_response.status_code == 200
    assert detail_response.json()["artifact_kind"] == "image_base64"
    assert detail_response.json()["artifact_file_name"] == "screen.png"
    assert detail_response.json()["artifact_base64"] == "c2NyZWVuc2hvdA=="


def test_task_history_supports_limit_for_lightweight_snapshot_polls() -> None:
    first_task_id = create_low_risk_telegram_task(chat_id=5001)
    second_task_id = create_low_risk_telegram_task(chat_id=5001)

    limited_response = client.get(
        "/api/tasks",
        params={
            "device_id": "desktop-local",
            "include_history": "true",
            "limit": 1,
        },
    )

    assert limited_response.status_code == 200
    assert [item["task_id"] for item in limited_response.json()["items"]] == [second_task_id]


def test_queued_task_can_be_cancelled_immediately() -> None:
    task_id = create_low_risk_telegram_task()

    cancel_response = client.post(f"/api/tasks/{task_id}/cancel")
    detail_response = client.get(f"/api/tasks/{task_id}")

    assert cancel_response.status_code == 200
    assert cancel_response.json()["status"] == "cancelled"
    assert cancel_response.json()["error_text"] == "Cancelled by operator."
    assert cancel_response.json()["finished_at"] is not None

    assert detail_response.status_code == 200
    assert detail_response.json()["status"] == "cancelled"


def test_running_task_moves_to_cancel_requested_before_desktop_confirms_stop() -> None:
    task_id = create_low_risk_telegram_task()

    client.post(f"/api/tasks/{task_id}/start")
    cancel_response = client.post(f"/api/tasks/{task_id}/cancel")
    detail_response = client.get(f"/api/tasks/{task_id}")

    assert cancel_response.status_code == 200
    assert cancel_response.json()["status"] == "cancel_requested"
    assert cancel_response.json()["finished_at"] is None

    assert detail_response.status_code == 200
    assert detail_response.json()["status"] == "cancel_requested"


def test_cancel_requested_task_can_be_finalized_as_cancelled() -> None:
    task_id = create_low_risk_telegram_task()

    client.post(f"/api/tasks/{task_id}/start")
    client.post(f"/api/tasks/{task_id}/cancel")
    cancel_response = client.post(
        f"/api/tasks/{task_id}/cancel",
        json={"error_text": "Cancelled after stop request."},
    )
    detail_response = client.get(f"/api/tasks/{task_id}")

    assert cancel_response.status_code == 200
    assert cancel_response.json()["status"] == "cancelled"
    assert cancel_response.json()["error_text"] == "Cancelled after stop request."
    assert cancel_response.json()["finished_at"] is not None

    assert detail_response.status_code == 200
    assert detail_response.json()["status"] == "cancelled"


def test_done_task_cannot_be_cancelled() -> None:
    task_id = create_low_risk_telegram_task()

    client.post(f"/api/tasks/{task_id}/start")
    client.post(
        f"/api/tasks/{task_id}/complete",
        json={"result_text": "desktop-local is online"},
    )

    cancel_response = client.post(f"/api/tasks/{task_id}/cancel")

    assert cancel_response.status_code == 409
    assert cancel_response.json()["detail"] == "Task cannot be cancelled"
