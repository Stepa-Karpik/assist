from __future__ import annotations

from fastapi import APIRouter, Request

from app.models.chat import ConversationReplyRequest, ConversationReplyResponse
from app.models.profile import OwnerProfile
from app.services.chat_knowledge_lookup import lookup_external_docs

router = APIRouter(prefix="/chat", tags=["chat"])


def build_owner_profile_context(profile: OwnerProfile) -> str | None:
    lines: list[str] = []

    if profile.full_name:
        lines.append(f"ФИО: {profile.full_name}")
    if profile.occupation:
        lines.append(f"Роль: {profile.occupation}")
    if profile.city:
        lines.append(f"Город: {profile.city}")
    if profile.age is not None:
        lines.append(f"Возраст: {profile.age}")
    if profile.gender:
        lines.append(f"Пол: {profile.gender}")
    if profile.language:
        lines.append(f"Язык: {profile.language}")
    if profile.notes:
        lines.append(f"Заметки: {profile.notes}")

    return "\n".join(lines) if lines else None


def unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(values))


@router.post("/respond", response_model=ConversationReplyResponse)
def respond_to_conversation(
    payload: ConversationReplyRequest, request: Request
) -> ConversationReplyResponse:
    profile = request.app.state.owner_profile_store.get_profile(payload.device_id)
    profile_context = build_owner_profile_context(profile)
    lookup = (
        lookup_external_docs(payload.prompt) if payload.include_external_docs else None
    )
    knowledge_parts = [
        part
        for part in [
            payload.knowledge_context.strip() if payload.knowledge_context else None,
            lookup.context if lookup is not None else None,
        ]
        if part
    ]
    responder = request.app.state.chat_responder
    response_text = responder.reply(
        payload.prompt,
        owner_profile_context=profile_context,
        knowledge_context="\n\n".join(knowledge_parts) if knowledge_parts else None,
    )
    source_urls = unique(lookup.source_urls if lookup is not None else [])
    return ConversationReplyResponse(text=response_text, source_urls=source_urls)
