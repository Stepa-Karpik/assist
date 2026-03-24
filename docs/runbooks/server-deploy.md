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

1. provision PostgreSQL
2. deploy the FastAPI service from `server/`
3. deploy the Telegram bot from `bot/`
4. publish desktop update artifacts from `desktop/out/make/squirrel.windows/x64`
   under `/desktop-updates/win32/x64/`
5. configure nginx to expose both the control-plane API and desktop update feed
6. set environment variables for API URL, bot token, and other secrets

## Required secrets

- Telegram bot token
- database connection string
- future device/session secrets once pairing is wired end-to-end
- optional `KARPIK_UPDATE_FEED_URL` for installed desktop clients

## Post-deploy checks

- `GET /health` returns `200`
- device online endpoint accepts a placeholder online event
- bot can answer `/start`
- `https://<host>/desktop-updates/win32/x64/RELEASES` is reachable

## Operational notes

- the server is a control plane only and must not execute local Codex tasks
- queued tasks must remain durable while desktop devices are offline
- nginx sample config lives in `infra/nginx/karpik.conf`
