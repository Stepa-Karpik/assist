# Karpik Design

Date: 2026-03-23

## Goal

Build a Windows desktop assistant named `Karpik` around the local `codex` CLI.
The app must provide a full GUI, tray access, local chats, Telegram task intake,
remote confirmations, local execution on the PC, and a clean separation between
desktop code and server code.

## Chosen Stack

### Desktop

- Electron
- React
- TypeScript

### Server

- FastAPI
- PostgreSQL
- nginx

### Telegram

- aiogram

## Repository Structure

The repository keeps source code separated by deployment target:

- `desktop/`
- `server/`
- `bot/`
- `infra/`
- `docs/`

The repository must not mix deployable server code with installed desktop user
data.

## Runtime Data

The installed app creates and uses a user data root outside the repo.

Current working assumption:

- `%APPDATA%\Karpik\docs\user\...`

Secrets must live in a protected encrypted store, not in markdown.

## Desktop Responsibilities

- main GUI window
- tray icon and quick popup
- local chats
- Telegram chat viewing and continuation into local chats
- blocked tasks / `Невыполненное`
- local task execution through typed actions and `codex`
- local knowledge and logs
- startup with Windows
- notifications for connection changes and stalled tasks

## Server Responsibilities

- Telegram ingress
- task parsing and normalization
- policy and risk evaluation
- queueing while PC is offline
- pairing and remote auth challenge flow
- state delivery back to Telegram
- online/offline device session handling

## Telegram Model

- private chats only
- allowlist by Telegram user ID
- pairing through `/pair <code>`
- ambiguous requests must be clarified in Telegram
- medium risk requires password
- high risk requires password, then TOTP, then explicit summary confirmation
- trust window: 5 minutes, same chat only
- lockout after repeated failures: 3 minutes

## GUI Model

Required sections:

- `Чаты`
- `Чаты Telegram`
- `Невыполненное`
- `Knowledge / Review`
- `Логи`
- `Сервисы`
- `Настройки`

`Чаты` shows only local chats.

`Чаты Telegram` shows Telegram-origin conversations.

Only when the user clicks `Продолжить чат` in `Чаты Telegram` does the app
create a new local chat that references the Telegram chat and is marked as
`Ссылается на ...`.

## Task Rules

- same chat: sequential execution
- different chats: up to two parallel active chat streams
- third active chat waits in queue
- stalled tasks must be visible in GUI and controllable from Telegram
- GUI-started tasks do not require remote challenge confirmations

## Packaging

The desktop deliverable must be a Windows `exe` installer.

The installer should:

- install `Karpik`
- prepare local app folders
- explain how to connect the server side
