# Continuation Chat Reuse

## Goal

Reuse one local continuation chat per Telegram chat instead of creating a new
local thread every time the operator clicks "Продолжить чат".

## Intended Behavior

- If a continuation chat for the same `telegramChatId` already exists, return
  that chat instead of creating a duplicate.
- Refresh its `updatedAt` so it moves to the top of the local chat list.
- Preserve existing messages and `createdAt`.
- Allow workspace/title metadata to refresh from the latest operator choice.

## Non-Goals

- No merge of different Telegram chats.
- No automatic deduplication of previously created duplicate records in this
  slice.
