# Task Contract

## Purpose

Defines the normalized task shape shared by the desktop app, server, and bot.

## Core identifiers

- `task_id`: unique identifier for one task execution attempt
- `conversation_id`: stable conversation identifier for the source chat or local thread
- `task_group_id`: optional identifier for composite tasks approved and tracked together

## Task fields

- `intent`: high-level user goal in human-readable form
- `type`: structured task kind such as `chat`, `file_export`, `screenshot`, `system_action`
- `target`: the main target object, path, app, or destination
- `scope`: the allowed search or action boundary
- `constraints`: extra limits such as location restrictions, filename hints, or output format
- `risk`: one of `low`, `medium`, `high`, `absolute_forbidden_remote`
- `required_auth`: one of `none`, `password`, `password_and_totp`, `local_only`
- `status`: lifecycle status
- `source`: one of `desktop`, `telegram`

## Lifecycle statuses

- `queued`
- `awaiting_auth`
- `awaiting_local_approval`
- `blocked`
- `running`
- `done`
- `failed`
- `stalled`

## Rules

- A `retry` creates a new `task_id` and keeps the previous task in history.
- Tasks from the same chat execute sequentially.
- Up to two chat streams may run in parallel across different chats.
- The effective risk of a composite task is the highest risk among its substeps.
- If a Telegram request is ambiguous, the bot must clarify it before creating a runnable task.

## Logging requirements

For every task, logs should preserve:

- original task text
- time received
- final executed task text if the task was edited locally
- execution time
- result summary

Secrets and challenge values must never be written into task logs.
