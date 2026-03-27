# Telegram Task Delivery Design

Date: 2026-03-24

## Goal

Add automatic Telegram delivery for terminal task results so the user does not
need to poll `/status` after every remote action.

This slice builds on the existing task execution flow:

- Telegram creates a task through the bot
- server applies pairing/auth policy
- desktop executes the task and reports `done|failed`
- bot automatically delivers the terminal result back to the originating chat

## Chosen Approach

Use a server-owned bot outbox with bot-side polling and acknowledgements.

Rejected alternatives:

- blocking `/task` until execution finishes: too fragile for long-running tasks
- desktop sending directly to Telegram: breaks the separation between execution
  plane and bot/control-plane credentials

## Core Rules

- only Telegram-origin tasks produce delivery events
- only terminal states produce delivery events in this slice: `done` and `failed`
- outbox items are structured payloads, not pre-rendered server strings
- the bot is responsible for final user-facing Telegram text
- delivery is at-least-once until ack; duplicate delivery risk is acceptable in
  this slice and can be refined later

## Architecture

### Server responsibilities

- create an outbox event when a Telegram task transitions to `done` or `failed`
- expose pending delivery events per device
- accept delivery acknowledgements from the bot
- avoid emitting outbox events for desktop-origin tasks

### Bot responsibilities

- poll the server outbox on a short interval
- render a user-facing Telegram message from the structured event payload
- send the message to the original `chat_id`
- ack the outbox item only after Telegram send succeeds

### Desktop responsibilities

- no new delivery logic in this slice
- continue reporting `complete` and `fail` transitions to the server

## Data Model

### Delivery event

- `event_id`
- `device_id`
- `task_id`
- `chat_id`
- `telegram_user_id`
- `kind`: `task_done | task_failed`
- `status`: `pending | delivered`
- `intent`
- `result_text`
- `error_text`
- `created_at`

This is a server relay model. It should stay lightweight and easy to persist later.

## API Shape

### Server -> Bot polling

- `GET /api/bot/outbox?device_id=...`
- `POST /api/bot/outbox/{event_id}/ack`

The payload is device-scoped because one bot instance can serve one logical
desktop deployment at a time in the current architecture.

## Message Format

### Successful task

`Готово: <task_id>`

followed by:

- original intent
- short result text

### Failed task

`Ошибка: <task_id>`

followed by:

- original intent
- short error text

The bot keeps `/status` for manual lookup, but the outbox becomes the default
delivery path for terminal results.

## Error Handling

- if Telegram send fails, the bot does not ack the event
- if ack fails after send succeeds, duplicate delivery is possible after restart
- if the server is unavailable, the bot keeps polling on the next interval
- if the outbox is empty, polling is a no-op

This slice explicitly prefers simple at-least-once delivery over premature
deduplication complexity.

## Testing Strategy

- server tests for outbox creation and ack behavior
- bot tests for delivery text rendering
- bot tests for one polling cycle with fake server client and fake Telegram sender
- full regression run for desktop, server, and bot suites

## Non-Goals

- persistent outbox storage in Postgres
- attachment delivery
- screenshot transport
- delivery deduplication across process restarts
- deletion of `/auth` or TOTP messages
