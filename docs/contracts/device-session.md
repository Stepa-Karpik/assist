# Device Session Contract

## Purpose

Defines how the desktop execution plane appears online to the server and how it
recovers queued work.

## Session states

- `offline`
- `online`
- `degraded`

## Session fields

- `device_id`: stable identifier of the desktop installation
- `status`: current device state
- `last_seen_at`: most recent heartbeat or online event timestamp
- `connected_at`: timestamp for the current online session
- `server_url`: control-plane endpoint used by the desktop app
- `queue_depth`: count of queued tasks known for the device

## Online flow

When the desktop app starts:

1. bootstrap local runtime folders
2. enter tray mode
3. connect to the server
4. announce `online`
5. pull queued tasks

## Offline behavior

- If the PC is offline, the server keeps tasks in the queue.
- The bot should immediately tell the user that the PC is unavailable.
- When the PC reconnects, the server resumes queue delivery.

## Heartbeat and reconnection semantics

- the desktop should refresh its session with periodic heartbeats
- if the server becomes unavailable, the desktop keeps retrying in the background
- when connectivity returns, the desktop announces `online` again and resumes queue polling
- reconnecting must not delete queued tasks that were created while the PC was offline

## Queue pull rules

- after reconnecting, the server should first report the count of queued tasks
- then queued tasks may begin normal execution flow
- retries and restarts create new task attempts, not in-place mutation of old task history
