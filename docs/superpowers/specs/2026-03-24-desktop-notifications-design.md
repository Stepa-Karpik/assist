# Desktop Notifications Design

## Goal

Add local desktop notifications for the most important remote task transitions so the tray-first desktop app stays usable without keeping the main window open.

## Scope

Desktop-only slice:

- one new app preference: `notificationsEnabled`
- one notification builder for task transitions
- wiring in `main.ts` when task snapshot changes

Out of scope:

- notification history UI
- notification actions/buttons
- sound/badge customization
- local chat notifications

## When to Notify

Only notify on high-signal transitions:

- `awaiting_local_approval`
- `done`
- `failed`
- `blocked`

Do not notify for:

- `queued`
- `running`
- `awaiting_auth`
- unchanged task snapshots

## Preference

Extend app preferences with:

- `notificationsEnabled`

Default: `true`

## Notification Content

Use short Electron notifications:

- title describes state
- body contains `intent` plus result/error summary when available

Examples:

- `Local approval required`
- `Task completed`
- `Task failed`
- `Task blocked`

## Testing

- store tests for the new default/persistence field
- unit tests for notification builder behavior
- renderer settings test for saving the new checkbox
