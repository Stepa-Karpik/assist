# Local Development Runbook

## Desktop

Working directory:

- `desktop/`

Typical commands:

- `npm run start`
- `npm run test`
- `npm run typecheck`

Notes:

- the desktop app stores runtime data outside the repository under the Karpik
  app data root
- during work in a git worktree, `desktop/node_modules` may be linked to an
  existing install to avoid reinstalling dependencies
- desktop updater testing needs `KARPIK_UPDATE_FEED_URL` pointing to a reachable
  Squirrel feed; unpackaged `npm run start` keeps updater disabled by design

## Server

Working directory:

- `server/`

Typical commands:

- `python -m venv .venv`
- `.venv\Scripts\python.exe -m pip install -e .[dev]`
- `.venv\Scripts\python.exe -m pytest tests -v`

## Bot

Working directory:

- `bot/`

Typical commands:

- `python -m venv .venv`
- `.venv\Scripts\python.exe -m pip install -e .[dev]`
- `.venv\Scripts\python.exe -m pytest tests -v`

## Expected local stack

- desktop app on Windows
- FastAPI control plane reachable at `http://127.0.0.1:8000`
- Telegram bot token configured through environment variables or local secrets
- optional desktop update feed published under
  `https://<host>/desktop-updates/win32/x64`
