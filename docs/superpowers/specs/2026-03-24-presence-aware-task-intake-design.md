# Presence-Aware Task Intake

## Goal

Make Telegram task intake more truthful when the desktop is offline, and harden
state persistence on Windows where atomic file replacement can fail
transiently.

## Scope

- Include `device_online` in task intake responses that can still surface a
  user-visible outcome.
- Keep the existing `ignored` behavior silent.
- Reuse the desktop heartbeat presence state that already exists on the server.
- Make JSON state writes retry transient `PermissionError` during atomic
  replace.

## Intended Behavior

### Task intake

- `queued`, `awaiting_auth`, `locked`, and `setup_required` responses include
  `device_online`.
- Bot copy may append an offline note when the server says the device is
  currently offline.
- `ignored` remains silent and does not need presence metadata.

### State persistence

- JSON state writes continue using temp-file then replace.
- On transient Windows file-lock races, retry replace a few times before
  failing.
- This should not change the stored payload format.

## Non-Goals

- No new polling channel from bot to desktop.
- No automatic wake-up or push notification path for offline devices.
- No durable database migration in this slice.
