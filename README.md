# Karpik

`Karpik` is a Windows desktop assistant built around the local `codex` CLI.

The product is split into separate deployable areas:

- `desktop/` - Electron app, installer, tray UI, local chat UX, updater, and local execution plane
- `server/` - FastAPI control plane
- `bot/` - aiogram Telegram bot
- `infra/` - deployment, update feed, and reverse proxy assets
- `docs/` - specifications, plans, contracts, and project documentation

## Important Rule

Repository source code and installed runtime data are separate concerns.

Application runtime data should live outside the repository, under the installed
app data root for `Karpik`. Human-readable user data can be organized under
`docs/user` inside that runtime data root, but not inside this git repository.

## Current Status

This repository is no longer in the bootstrap phase.

Current state:

- working Windows desktop runtime with tray UI, quick popup, local chats, and guarded `codex` execution
- FastAPI control plane and Telegram bot wired end-to-end
- pairing, auth challenge, task queue, screenshot delivery, and local approval flows
- desktop updater support for installed Windows builds through a Squirrel feed

Operational entry points:

- desktop install: `docs/runbooks/desktop-install.md`
- desktop release and update feed publication: `docs/runbooks/desktop-release.md`
- local development: `docs/runbooks/local-dev.md`
- server deployment: `docs/runbooks/server-deploy.md`
