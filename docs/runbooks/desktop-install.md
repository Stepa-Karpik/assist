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
- optionally `npm run make` when installer artifacts are needed

## Install flow

1. install the generated `KarpikSetup.exe`
2. launch the app
3. allow it to create its local runtime folders under the Karpik app data root
4. open `Настройки`
5. configure the server URL
6. configure allowed Telegram IDs and pairing data once that flow is available

## Expected behavior after install

- app starts into tray mode
- main window and quick popup open correctly
- the desktop client can announce itself online to the server

## Support notes

- runtime data must stay outside the git repository
- secrets must not be stored in markdown files inside the repo
