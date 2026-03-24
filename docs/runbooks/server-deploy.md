# Server Deploy Runbook

## Purpose

Deploy the Karpik control plane independently from the Windows desktop app.

## Components

- `server/` FastAPI application
- `bot/` Telegram ingress service
- PostgreSQL
- nginx as reverse proxy
- static desktop update feed for Windows builds

## High-level flow

1. copy `.env.example` to `.env`
2. publish desktop update artifacts from `desktop/out/make/squirrel.windows/x64`
   under the host path pointed to by `KARPIK_UPDATE_FEED_HOST_PATH`
3. start the base stack with `docker compose up -d --build`
4. if Telegram ingress is needed, set `KARPIK_TELEGRAM_TOKEN` and run
   `docker compose --profile telegram up -d --build`
5. run `powershell -ExecutionPolicy Bypass -File infra/scripts/server-smoke.ps1`
   to verify the published health endpoints

## Required secrets

- Telegram bot token for the optional `telegram` compose profile
- desktop client `KARPIK_UPDATE_FEED_URL` for installed desktop clients

## Post-deploy checks

- `GET /health` returns `200`
- `GET /api/health` through nginx returns `200`
- `GET /api/health` is a compatibility alias of `GET /health`
- `https://<host>/desktop-updates/win32/x64/RELEASES` is reachable
- if the `telegram` profile is enabled, bot can answer `/start`

## Backup and restore

- create a backup:
  `powershell -ExecutionPolicy Bypass -File infra/scripts/postgres-backup.ps1`
- restore a backup:
  `powershell -ExecutionPolicy Bypass -File infra/scripts/postgres-restore.ps1 -BackupFile <path-to-dump>`
- default backup output lives under `infra/backups/`

## Operational notes

- the server is a control plane only and must not execute local Codex tasks
- queued tasks must remain durable while desktop devices are offline
- nginx sample config lives in `infra/nginx/karpik.conf`
- PostgreSQL is the default server durability backend in Docker deployment
