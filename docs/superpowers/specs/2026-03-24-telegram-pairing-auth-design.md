# Telegram Pairing And Auth Design

Date: 2026-03-24

## Goal

Add a real Telegram pairing flow for `Karpik` and define the remote
authentication model around password, TOTP, and trust windows.

This design intentionally splits the work into two stages:

1. implement end-to-end Telegram pairing first
2. implement password/TOTP/trust-window challenges on the same transport later

## Core Trust Model

- the local Windows desktop app is the only authority for pairing and secret validation
- the server is a relay and state coordinator, not a validator of secrets
- the bot only talks to the server
- pairing and auth secrets never become server-owned state

## Pairing Rules

- pairing is initiated only from the local GUI
- the desktop generates exactly one active one-time `pair code`
- the code TTL is `5 minutes`
- generating a new code invalidates the previous code immediately
- pairing is meaningful only while the PC is online and the pairing window is open
- `/pair` is not queued for later processing
- on success, the Telegram user is added immediately to the trusted allowlist
- allowlist changes are possible only from the GUI
- the bot confirms success with a short message: `Устройство привязано`
- untrusted users outside the pairing flow are silently ignored

## Password / TOTP / Trust Window Model

- password and TOTP are global for the device, not per Telegram user
- secrets are configured and stored only on the desktop side
- the server stores only pending challenge state and outcomes
- `medium` risk requires password
- `high` risk requires password, then TOTP, then explicit `confirm`
- trust window duration is `5 minutes`
- trust window is scoped to one Telegram chat
- trust window applies only to the same or lower risk
- `high` risk still requires final `confirm/decline`
- repeated failures lock the chat for `3 minutes`
- if password or TOTP are not configured, `medium/high` remote tasks are rejected with a GUI-setup message

## Architecture

### Desktop responsibilities

- generate and rotate the one-time pairing code
- keep local allowlist state
- validate incoming pair attempts against the active code
- later validate password and TOTP locally
- return only success/failure/next-step state back to the server

### Server responsibilities

- keep lightweight pairing metadata for each device
- accept Telegram pair attempts from the bot
- expose pending events for the desktop app
- store trusted Telegram user mappings replicated from the desktop
- later coordinate auth challenge state without owning the secrets

### Bot responsibilities

- parse `/pair <code>`
- submit pair attempts to the server
- stay silent when the server reports that no pairing flow is active
- send a short success or invalid-code message when the desktop resolves the attempt

## State Model

### Pairing session

- `device_id`
- `status`: `inactive | active | consumed | expired | cancelled`
- `expires_at`
- `attempt_count`

The server does not store the real `pair code`.

### Pair attempt event

- `event_id`
- `device_id`
- `telegram_user_id`
- `chat_id`
- `code`
- `status`: `pending | resolved | expired`
- `result`: `paired | invalid_code | ignored`

### Future auth challenge

- `challenge_id`
- `device_id`
- `task_id`
- `telegram_user_id`
- `chat_id`
- `risk`
- `step`: `password | totp | confirm`
- `status`: `pending | passed | failed | expired | locked | cancelled`
- `expires_at`
- `trust_window_expires_at`

## API Shape For The First Slice

### Desktop -> Server

- `POST /api/pairing/open`
- `POST /api/pairing/close`
- `GET /api/events?device_id=...`
- `POST /api/events/{event_id}/resolve`

### Bot -> Server

- `POST /api/bot/pair-attempt`

The `pair-attempt` endpoint may wait briefly for desktop resolution so the bot
can answer immediately on the happy path.

## UX Notes

- pairing UI lives in desktop settings
- the GUI shows the active code and its expiry
- a new code invalidates the old code without prompting
- invalid or expired codes should produce a generic `Код недействителен`
- if no pairing window is active, the bot says nothing

## First Implementation Slice

The first implementation slice is:

- desktop-generated one-time pair code
- pairing session open/close sync to the server
- bot `/pair` request forwarded to the server
- desktop polling pending events and resolving pair attempts
- server replication of trusted Telegram users after a successful local validation

This slice does not yet include:

- password verification
- TOTP verification
- trust-window execution shortcuts
- remote auth challenge UX beyond pairing

## Testing Strategy

- server tests for pairing-session lifecycle and pair-attempt resolution
- desktop tests for pair-code lifecycle and local allowlist updates
- bot tests for `/pair` success, invalid-code, and silent-ignore behavior
- after the transport is stable, add a second implementation plan for auth challenges
