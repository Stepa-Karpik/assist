from pydantic import BaseModel, Field


class ConversationReplyRequest(BaseModel):
    device_id: str
    prompt: str
    knowledge_context: str | None = None
    history_context: str | None = None
    include_external_docs: bool = True


class ConversationReplyResponse(BaseModel):
    text: str
    source_urls: list[str] = Field(default_factory=list)
