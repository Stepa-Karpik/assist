# Server Deploy Runbook

## Purpose

Deploy the Karpik control plane independently from the Windows desktop app.

## Components

- `server/` FastAPI application
- `bot/` Telegram ingress service
- PostgreSQL
- nginx as reverse proxy

## High-level flow

1. provision PostgreSQL
2. deploy the FastAPI service from `server/`
3. deploy the Telegram bot from `bot/`
4. configure nginx to expose the control-plane API
5. set environment variables for API URL, bot token, and other secrets

## Required secrets

- Telegram bot token
- database connection string
- future device/session secrets once pairing is wired end-to-end

## Post-deploy checks

- `GET /health` returns `200`
- device online endpoint accepts a placeholder online event
- bot can answer `/start`

## Operational notes

- the server is a control plane only and must not execute local Codex tasks
- queued tasks must remain durable while desktop devices are offline
