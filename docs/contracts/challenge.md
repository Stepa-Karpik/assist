# Challenge Contract

## Purpose

Defines the remote confirmation flow for Telegram-origin tasks.

## Challenge steps

- `password`
- `totp`
- `summary_confirm`

## Risk mapping

- `low`: no remote challenge
- `medium`: require `password`
- `high`: require `password`, then `totp`, then `summary_confirm`
- `absolute_forbidden_remote`: do not allow remote execution

## Challenge fields

- `challenge_id`: unique identifier for one auth flow
- `task_id`: task being authorized
- `telegram_user_id`: trusted remote user attempting confirmation
- `chat_id`: Telegram chat bound to the challenge
- `current_step`: active step in the flow
- `status`: `pending`, `passed`, `failed`, `expired`, `locked`
- `expires_at`: absolute expiry timestamp for the current challenge
- `trust_window_expires_at`: optional timestamp set after successful auth
- `failure_count`: number of failed attempts in the current window

## Trust window

- duration: `5 minutes`
- scope: one Telegram chat only
- applies only to same or lower risk tasks
- a higher-risk task always requires a fresh challenge
- even inside the trust window, `high` risk still requires explicit summary confirmation

## Lockout behavior

- repeated failures block the chat for `3 minutes`
- blocked chats cannot start a new challenge until the lockout expires
- logs store only step transitions and outcomes, never the password or TOTP values

## UX requirements

- password entry should use a masked inline keypad flow
- TOTP should be submitted as a normal Telegram message and deleted after verification on a best-effort basis
- summary confirmation must present a human-readable action summary with `confirm` and `decline`
