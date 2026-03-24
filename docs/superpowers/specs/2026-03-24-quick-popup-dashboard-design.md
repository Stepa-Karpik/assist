# Quick Popup Dashboard Design

## Goal

Turn the quick popup into a real runtime dashboard instead of a decorative shell
with a hard-coded progress bar.

## Scope

- compute progress from real task snapshot data
- show queue health counters in the popup
- render recent runtime activity already available through `quickAccessRuntime`
- keep the popup input flow unchanged

## Non-goals

- no new backend endpoints
- no live subscriptions; reuse existing snapshot fetches
- no per-task detail view inside the popup

## Data model

The popup already has access to:

- `getQuickAccessState()` for target chat and recent activity
- `getTaskSnapshot()` for remote task statuses

The renderer can derive dashboard state locally.

## Progress model

Approximate progress is derived from non-terminal tasks only.

- `queued` -> 10
- `awaiting_auth` -> 25
- `running` -> 70
- `awaiting_local_approval` -> 90
- `stalled` -> 60

Terminal tasks are excluded from the average.

If there are no active tasks, the progress bar shows `100%` and the text says
that there are no active tasks.

## UI changes

The quick popup should show:

1. real progress bar width
2. small queue health summary
3. recent runtime activity list
4. existing target chat and quick request card

## Acceptance

- no hard-coded `28%` remains in the popup
- popup reflects actual task state from `getTaskSnapshot()`
- popup shows recent activity entries when available
- existing quick request flow remains green
