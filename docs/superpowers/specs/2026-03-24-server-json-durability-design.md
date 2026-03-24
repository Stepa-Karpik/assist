# Server JSON Durability Design

Date: 2026-03-24

## Goal

Persist the most valuable server state across restarts without introducing an
external database dependency yet.

## Chosen Approach

Use one JSON state file shared by the in-memory stores.

Rejected alternatives:

- Postgres immediately: correct long-term direction, but not the fastest route
  to a durable working project in the current environment
- leaving everything in memory until the database layer exists: loses trusted
  users, task history, auth capability flags, and pending Telegram delivery

## Persisted State

- trusted Telegram users per device
- auth capability flags per device
- task history
- bot delivery outbox

## Non-Persisted State

- active pairing sessions
- pending pairing attempts
- pending auth input waiters
- trust-window timers
- lockout timers
- active challenge waiters

Those are intentionally ephemeral in this slice because they are tied to
in-process timing and waiter objects.

## Architecture

### Shared JSON backend

- one backend owns the file path
- stores read their section on startup
- stores write their section after each durable mutation

### Store boundaries

- task store persists the full task list
- pairing store persists only trusted users
- challenge store persists only auth config flags
- delivery store persists outbox items

## File Location

Default path:

- `server/.tmp/runtime-state.json`

Override:

- `KARPIK_STATE_FILE`

## Safety Rules

- writes are atomic enough for this slice: write full JSON snapshot per mutation
- missing file means empty state
- invalid JSON falls back to empty state instead of crashing the server

## Testing Strategy

- direct persistence tests for stores through a temp state file
- full API regression after wiring the backend into `create_app()`

## Non-Goals

- schema migrations
- record-level locking
- concurrent multi-process writers
- Postgres replacement
