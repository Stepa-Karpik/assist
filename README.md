# Karpik

`Karpik` is a Windows desktop assistant built around the local `codex` CLI.

The product is split into separate deployable areas:

- `desktop/` - Electron app, installer, tray UI, and local execution plane
- `server/` - FastAPI control plane
- `bot/` - aiogram Telegram bot
- `infra/` - deployment and reverse proxy assets
- `docs/` - specifications, plans, contracts, and project documentation

## Important Rule

Repository source code and installed runtime data are separate concerns.

Application runtime data should live outside the repository, under the installed
app data root for `Karpik`. Human-readable user data can be organized under
`docs/user` inside that runtime data root, but not inside this git repository.

## Current Status

This repository is in the bootstrap phase. The initial implementation plan lives
under `docs/superpowers/plans/`.

