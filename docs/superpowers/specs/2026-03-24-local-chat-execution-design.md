# Local Chat Execution Design

## Goal

Turn `Чаты` from a list of local chat cards into the first real local work
surface by adding:

- chat detail
- persistent message history
- local text input
- direct GUI-origin task execution on the PC

## Scope

This slice adds:

- persisted local chat messages
- local chat detail loading
- local input field in `Чаты`
- direct desktop execution using the existing task executor
- workspace-aware local chat execution

This slice does not add:

- server-side storage for local chats
- Telegram awareness of local chat history
- rich markdown rendering
- multi-step chat planning

## Chosen Approach

Local chats remain a desktop-only concern.

The desktop already has:

- `LocalChatStore` for chat summaries
- `taskExecutor` for local execution
- `LocalApprovalStore` for `codex-write` preview approval

This slice connects those pieces with one desktop-only runtime:

- append user message
- execute locally
- append assistant or system reply
- if execution needs local approval, save the draft and append a waiting message

## Local Chat Model

Each local chat gains a persisted message list.

Message fields:

- `messageId`
- `role`: `user`, `assistant`, `system`
- `text`
- `createdAt`

Chat summary fields stay as they are, but `messageCount` now reflects real
stored messages.

## Local Execution Rules

`Чаты` sends raw local intent text into the existing task executor.

This means the first supported local commands are the same ones already
supported by the executor:

- `status`
- `read ...`
- `list ...`
- `write-note ...`
- `codex ...`
- `codex-write ...`

Differences from Telegram:

- no remote auth is required
- no server queue is involved
- execution starts immediately on the desktop

## Workspace Rules

Local chat execution uses workspace context in this order:

1. chat-specific `workspaceId`
2. desktop default workspace

Continuation chats already carry workspace context from Telegram, so they
naturally reuse it here.

## Local Approval

If local execution returns `requiresLocalApproval`:

- save the preview in `LocalApprovalStore`
- append a `system` message with the waiting text
- keep the review flow in `Невыполненное`

This slice does not yet back-propagate approve/reject results into the local
chat history automatically.

## Desktop UI

`Чаты` becomes a two-part page:

- chat list
- selected chat detail

The selected chat detail shows:

- title
- reference marker if it is a continuation
- workspace badge if present
- message history
- local input box and send action

## Testing

- store tests for message persistence and detail retrieval
- runtime tests for success, error, and local-approval execution paths
- renderer tests for chat detail rendering and send flow

## Follow-Up

Later slices can add:

- message streaming for `codex`
- showing local approval completion back in the chat
- quick popup sending into the selected or last active local chat
- richer local chat metadata and grouping
