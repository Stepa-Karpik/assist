# Server

This folder contains the FastAPI control plane for `Karpik`.

Responsibilities:

- device session handling
- task intake and queueing
- policy and risk evaluation
- remote auth challenge lifecycle
- APIs used by the desktop client and Telegram bot

This folder is deployable independently to the server environment.

Primary deployment path:

- local/dev fallback: run the app directly with JSON durability
- production/default server path: `docker compose up -d --build`

In Docker deployment the server uses PostgreSQL-backed state via
`KARPIK_DATABASE_URL`.

