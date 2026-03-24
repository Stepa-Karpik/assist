from app.models.task import TaskCreateRequest, TaskRisk


def risk_rank(risk: TaskRisk) -> int:
    return {"low": 0, "medium": 1, "high": 2}[risk]


def get_minimum_risk(intent: str) -> TaskRisk:
    normalized = intent.strip().lower()

    if normalized == "status" or "status" in normalized:
        return "low"

    if normalized.startswith("read "):
        return "low"

    if normalized.startswith("list "):
        return "low"

    if normalized.startswith("write-note "):
        return "medium"

    return "high"


def is_force_high_intent(intent: str) -> bool:
    normalized = intent.strip().lower()
    return normalized == "codex" or normalized.startswith("codex ")


def apply_task_policy(payload: TaskCreateRequest) -> TaskCreateRequest:
    normalized_intent = payload.intent.strip()
    minimum_risk = get_minimum_risk(normalized_intent)
    effective_risk = payload.risk

    should_escalate = (
        minimum_risk != "high" or payload.risk == "low" or is_force_high_intent(normalized_intent)
    )

    if should_escalate and risk_rank(minimum_risk) > risk_rank(effective_risk):
        effective_risk = minimum_risk

    return payload.model_copy(
        update={
            "intent": normalized_intent,
            "risk": effective_risk,
        }
    )
