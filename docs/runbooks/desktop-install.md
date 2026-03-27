# Desktop Install Runbook

## Package artifact

The Windows desktop deliverable is an `exe` installer built from `desktop/`
with Electron Forge.

Current artifact naming:

- application name: `Karpik`
- installer name: `KarpikSetup.exe`

## Build

From `desktop/` run:

- `npm run package`
- optionally `npm run make` when installer and update-feed artifacts are needed

## Install flow

1. install the generated `KarpikSetup.exe`
2. launch the app
3. allow it to create its local runtime folders under the Karpik app data root
4. ensure `KARPIK_SERVER_URL` points to the deployed control plane
5. optionally set `KARPIK_UPDATE_FEED_URL` to the published Squirrel feed, for
   example `https://karpik.example.com/desktop-updates/win32/x64`
6. open `Настройки`
7. configure local auth and workspaces
8. open Telegram pairing once and bind the operator account

## Expected behavior after install

- app starts into tray mode
- main window and quick popup open correctly
- the desktop client can announce itself online to the server
- `Сервисы` shows updater state when `KARPIK_UPDATE_FEED_URL` is configured

## Support notes

- runtime data must stay outside the git repository
- secrets must not be stored in markdown files inside the repo
