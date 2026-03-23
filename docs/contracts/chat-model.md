# Chat Model Contract

## Purpose

Defines the chat entities shown in the desktop UI and how Telegram history is
linked into local work.

## Chat types

- `desktop_chat`: a local GUI-native chat created and executed on the PC
- `telegram_chat`: a remote Telegram conversation shown in the `Чаты Telegram` section
- `local_continuation_chat`: a local chat created from a Telegram chat by clicking `Продолжить чат`

## Shared fields

- `chat_id`: stable chat identifier
- `source`: `desktop` or `telegram`
- `title`: user-facing label
- `created_at`
- `updated_at`
- `message_count`

## Telegram chat rules

- Telegram chats appear only in `Чаты Telegram`
- they must not be duplicated into `Чаты`
- each Telegram chat should retain the source Telegram account context

## Local continuation rules

- a continuation chat is created only from `Чаты Telegram`
- it becomes a new local chat visible in `Чаты`
- it must carry a marker formatted as `Ссылается на ...`
- the linked Telegram history should remain visible to the assistant in that continuation context

## Local chat rules

- `Чаты` shows only local desktop chats, including local continuation chats
- local chats can continue working without server connectivity
- GUI-started tasks in local chats do not require remote password or TOTP confirmation
