# Conversational Chat Streaming And Memory Promotion Design

## Context

The current conversational path is improved compared to raw task execution, but it still has three major product problems:

1. Some ordinary user messages still fall through to `codex exec`, producing CLI-style errors like `argument ... not found`.
2. The desktop chat does not expose a robust run lifecycle, so the user sees an acknowledgment such as `Сейчас посмотрю и отвечу по сути.`, but the final answer may never visibly stream back into the chat.
3. Memory writes are too weakly orchestrated. We already write some facts and preferences, but we need clear rules for temporary observations, durable facts, and silent documentation updates.

This spec extends `2026-03-30-conversational-chat-orchestration-design.md` with a concrete runtime model for:

- human-like conversational replies
- streaming responses in desktop chat
- per-chat stop/cancel support
- strict routing between conversation and task/codex execution
- silent memory promotion into the knowledge vault

## Goals

- Make local desktop chat feel like a real conversation rather than a task console.
- Remove CLI/task leakage from normal conversational interactions.
- Allow one active assistant response per chat, with independent runs across chats.
- Keep streaming/generation alive in the main process even when the user switches tabs or minimizes to tray.
- Let the user stop a reply without losing already generated text.
- Persist useful memory quietly into the Obsidian-friendly vault.
- Keep Telegram conversational behavior humanized and free of raw internal task language.

## Non-Goals

- Full token-by-token Telegram streaming. Telegram will use staged replies first.
- Replacing the entire task pipeline. Action tasks still exist and remain separate.
- Surfacing raw internal observations directly in the user-facing knowledge graph.

## Routing Model

All incoming user text must go through a stricter router.

### Conversational Path

Default path for:

- greetings
- questions
- requests for explanations
- stack/documentation questions
- self-description
- article discussion
- follow-up questions

This path uses:

1. local vault retrieval
2. docs/web lookup if local knowledge is insufficient
3. conversational response generation
4. silent memory writes

### Task Path

Used only for explicit actions such as:

- opening a website
- launching an application
- screenshot capture
- file send/read/list
- known operational control actions

### Codex Path

Used only when:

- the user explicitly says `кодекс` / `codex`
- the request is clearly about local project/code/file analysis or modification

Normal conversational text must not fall through to `codex exec`.

## Desktop Chat Run Model

Each local chat owns at most one active assistant run.

### States

- `idle`
- `thinking`
- `streaming`
- `cancelled`
- `failed`
- `completed`

### Lifecycle

When the user sends a message:

1. renderer appends the user message immediately
2. main process creates `runId`
3. main process appends a short acknowledgment message:
   - `Сейчас посмотрю и отвечу по сути.`
4. main process appends a second assistant message in `streaming` form:
   - initial placeholder text such as `Ассистент отвечает...`
5. main process executes the run in the background
6. the streaming message is progressively updated
7. when the run completes:
   - acknowledgment message is deleted
   - streaming message becomes the final assistant reply
8. when the run is cancelled:
   - acknowledgment message is deleted
   - partially generated text remains in place
   - message is marked as cancelled, but kept in history
9. when the run fails:
   - acknowledgment message is deleted
   - streaming message is replaced with a human-readable failure

### UI Rules

- While a run is active, only that chat input is disabled.
- The send arrow becomes a square stop button.
- Other chats remain usable.
- Switching tabs or minimizing to tray must not stop the run.
- Closing the main window to tray must not stop the run.

## Runtime Ownership

The active run must live in desktop main-process state, not in renderer state.

Required components:

- `chatRunStore`
  - `runId`
  - `chatId`
  - `status`
  - `startedAt`
  - `cancelRequested`
  - identifiers for acknowledgment and streaming messages
- IPC methods
  - start run
  - cancel run
  - subscribe/poll run updates

Renderer responsibility is limited to:

- displaying the current chat transcript
- displaying run status
- toggling send/stop button

## Memory Model

Knowledge writes must be divided into durable and temporary layers.

### Durable User-Facing Knowledge

Written into `user/...` when the conversation produces useful reusable material:

- technology summaries
- conceptual explanations
- topic notes
- practical checklists

One topic should map to one canonical file whenever possible. Existing topic files must be updated instead of duplicating them.

### Durable Assistant Memory

Written into `assist/...`:

- `assist/profile/...` for durable personal facts
- `assist/preferences/...` for stable work preferences
- `assist/docs/...` for articles, docs, sites, and trust notes
- `assist/skills/...` for assistant skills, subject to existing local approval flow when the change is significant

### Temporary Observations

Written into `assist/observations/...`:

- repeated emotional patterns
- writing style signals
- probable preferences
- tentative conclusions about communication style

These files:

- are visible in Obsidian
- stay isolated from the main knowledge graph
- do not create backlinks into durable knowledge by default
- may be promoted later if repeatedly confirmed over time

## Memory Promotion Rules

### Promote Immediately

Direct user statements can be promoted quickly:

- full name
- role/job
- explicit tech stack
- explicit preferences

### Promote Only After Repeated Confirmation

Tentative signals require repeated evidence across time:

- literacy level
- emotional tendencies
- preferred explanation depth
- stable habits

Promotion must be performed quietly by background logic.

## Retrieval Order

For conversational questions:

1. `assist/...`
2. relevant `user/...`
3. known documentation/article registry in `assist/docs/...`
4. web/docs lookup
5. response generation

This ensures that the assistant uses its own memory first, then user knowledge, and only then reaches outward.

## Telegram Behavior

Telegram keeps a simpler UX than desktop:

- ordinary conversation uses the conversational router
- raw task/codex language must stay hidden
- initial ack may be shown as:
  - `Сейчас посмотрю и отвечу по сути.`
- the final answer then replaces or follows it in a human way

Telegram does not need full live streaming in this slice. Staged response is sufficient.

The bot should still:

- perform docs lookup when local knowledge for the device is missing
- publish memory events back to the device
- avoid leaking internal task or CLI errors to the user

## Error Handling

Human-readable errors only.

Examples:

- instead of `argument 'статьи' not found`
- show something like:
  - `Не получилось корректно разобрать запрос. Попробую по-другому или уточните, что именно посмотреть.`

The user must never see raw `codex` CLI parsing failures in normal conversational mode.

## Rollout

### Phase 1

- narrow codex routing
- enforce conversation-first default path
- add chat run state machine
- keep one active run per chat

### Phase 2

- add desktop streaming reply updates
- add stop button and cancellation
- keep runs alive in tray/background

### Phase 3

- improve silent memory writes
- add observation layer and promotion rules
- keep docs/source registry updated

### Phase 4

- bring Telegram fully in line with the new conversation routing
- improve staged reply behavior
- remove remaining internal response leakage

## Acceptance Criteria

- Ordinary conversational text no longer falls through to raw `codex exec`.
- Desktop chat no longer freezes while the assistant is working.
- User sees:
  - short acknowledgment
  - then a live assistant reply
  - acknowledgment disappears when the final/partial reply is ready
- Stop button cancels only the active run in that chat.
- Runs continue while switching tabs or minimizing to tray.
- Useful memory is written quietly into `user/`, `assist/`, and `assist/observations/` according to promotion rules.
- Temporary observations stay isolated from the durable graph until promoted.
- Telegram conversational replies no longer expose raw CLI/task language for ordinary questions.
