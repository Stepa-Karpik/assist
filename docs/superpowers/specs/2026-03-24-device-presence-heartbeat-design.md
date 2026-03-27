# Device Presence Heartbeat Design

## Goal

Replace the one-shot `device online` placeholder with real heartbeat-backed
device presence.

## Scope

- persistent server-side device presence store
- `POST /api/devices/online` updates `last_seen_at`
- `GET /api/devices/{device_id}` returns presence
- desktop main process sends periodic heartbeats
- `Services` page shows heartbeat reachability and last successful heartbeat

## Presence model

- `last_seen_at`: ISO timestamp of the last acknowledged heartbeat
- `is_online`: `true` when `now - last_seen_at <= timeout`
- timeout: 30 seconds by default

## Desktop behavior

- send heartbeat immediately on startup
- repeat every 15 seconds
- cache last successful response locally
- mark heartbeat as unreachable when the request fails

## Non-goals

- no task gating by device presence in this slice
- no multi-device dashboard UI
