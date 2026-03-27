# Chat Continuation Design

## Goal

Turn `Чаты` and `Чаты Telegram` into the first usable conversation surfaces by
adding persistent local chats and a `Продолжить чат` flow from Telegram into a
local desktop chat.

## Scope

This slice adds:

- a local persistent chat store on the desktop
- local desktop chats visible only in `Чаты`
- local continuation chats created from `Чаты Telegram`
- a `Ссылается на ...` marker for continuation chats
- a minimal desktop chat list with titles, source, workspace, and counters

This slice does not add:

- full message history inside chats
- prompt input and local chat execution from GUI
- server-side chat persistence
- Telegram-side awareness of local continuation chats

## Current Gap

The design already requires:

- `Чаты` shows only local chats
- `Чаты Telegram` shows Telegram-origin conversations
- clicking `Продолжить чат` creates a local chat that references the Telegram
  chat

Right now:

- `Чаты` is only a placeholder
- `Чаты Telegram` only shows task snapshots and workspace bindings
- there is no local chat model at all

## Chosen Approach

Local chats stay fully desktop-owned and live in local runtime state.

The server keeps task and delivery state only. It does not need to know about
local continuation chats, because they are GUI context objects for the desktop.

The desktop stores two local chat kinds:

- `desktop_chat`
- `local_continuation_chat`

Both kinds appear in `Чаты`. Telegram chats themselves still appear only in
`Чаты Telegram`.

## Local Chat Model

Persisted fields:

- `chatId`
- `source`
- `title`
- `createdAt`
- `updatedAt`
- `messageCount`
- `referenceLabel`
- `telegramChatId`
- `workspaceId`

Rules:

- `desktop_chat` has no Telegram reference
- `local_continuation_chat` always has `telegramChatId`
- continuation chat `referenceLabel` is formatted as `Ссылается на Telegram chat <id>`
- chats are listed newest first by `updatedAt`

## Desktop UX

### Чаты

The page becomes a local chat list:

- show local desktop chats and continuation chats
- show source label
- show `Ссылается на ...` for continuation chats
- show workspace binding when present
- show an empty state if there are no local chats yet

The page also gets a minimal `Новый локальный чат` action so the section is no
longer Telegram-only.

### Чаты Telegram

For each Telegram chat group:

- keep the workspace selector
- keep task snapshot visibility
- add `Продолжить чат`

When clicked:

1. desktop creates a local continuation chat
2. the app switches to `Чаты`
3. the new local chat is visible there with the Telegram reference marker

## Workspace Behavior

Continuation chats carry the currently selected or bound workspace id from the
Telegram chat page. This does not yet execute local chat requests, but it
preserves the future execution context now instead of reconstructing it later.

## Persistence

The store lives under desktop runtime `state/`, next to other local runtime
stores. A desktop restart must keep local chats intact.

## Testing

- store tests for desktop chat creation, Telegram continuation creation, and reload
- UI tests for `Продолжить чат`
- UI tests for local chat list visibility in `Чаты`

## Follow-Up

Later slices can add:

- chat detail view
- local message history
- quick popup sending into the last active local chat
- GUI-origin task execution inside a selected local chat
