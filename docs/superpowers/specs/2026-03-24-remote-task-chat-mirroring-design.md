# Remote Task Chat Mirroring

## Goal

Keep a local continuation chat useful after it has been created by mirroring
important remote task updates from the linked Telegram chat into the local chat
history.

## Intended Behavior

- When a task update arrives for a Telegram chat that already has a local
  continuation chat, append a local system message describing the update.
- Mirror only high-signal states:
  - `awaiting_auth`
  - `awaiting_local_approval`
  - `blocked`
  - `failed`
  - `stalled`
  - `done`
- Preserve image artifacts when present so screenshot results also appear in the
  local continuation chat.
- Deduplicate by task signature so polling the same unchanged snapshot does not
  spam the local chat.

## Non-Goals

- No mirroring for chats that do not yet have a continuation.
- No backfill of all historical Telegram tasks into old chats.
- No sync from local chats back into Telegram in this slice.
