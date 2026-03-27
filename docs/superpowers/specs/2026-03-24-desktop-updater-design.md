# Desktop Updater

## Goal

Allow the installed Windows desktop app to check for and install new releases
without manual reinstall, using a server-hosted Squirrel update feed.

## Intended Behavior

- Desktop shows updater state in the GUI.
- Operator can click `Проверить обновления`.
- If a newer release is found, the app downloads it and exposes
  `Установить обновление`.
- Installing the update hands off to the Windows updater flow.

## Desktop Rules

- Updater is enabled only when all of these are true:
  - Windows platform
  - packaged app
  - `KARPIK_UPDATE_FEED_URL` is configured
- Unsupported environments show a clear disabled reason instead of a broken UI.
- The updater state machine is explicit: `disabled`, `idle`, `checking`,
  `downloading`, `downloaded`, `error`.

## Infra Rules

- Release artifacts are produced from `desktop/` with Electron Forge `make`.
- The update feed is a static HTTP directory containing Squirrel artifacts.
- nginx serves both:
  - `/api/` for the control plane
  - `/desktop-updates/` for desktop release artifacts

## Non-Goals

- No Linux/macOS auto-update path.
- No delta rollout policy or staged rollout.
- No in-app release notes browser in this slice.
