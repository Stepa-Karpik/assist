# 2026-03-24 Local Task Retry Design

## Goal

Let the desktop operator retry failed, blocked, or stalled tasks directly from
the `Невыполненное` page without reopening Telegram auth flow.

## Scope

- add a server endpoint to requeue an existing task
- expose retry through the desktop sync client and IPC bridge
- show a `Retry` action for retryable tasks in the blocked tasks page

## Rules

- retry stays local-only in this slice
- only `failed`, `blocked`, and `stalled` tasks are retryable
- retry reuses the same `task_id`
- retry clears runtime outcome fields and puts the task back into `queued`
- retry does not touch `attempt_count`; the next `/start` increments it

## Out of Scope

- Telegram `/retry`
- re-running auth challenge steps
- cloning tasks into new task IDs
