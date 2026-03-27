# Desktop Release Runbook

## Goal

Produce a Windows desktop release, publish a Squirrel update feed, and let
installed `Karpik` clients update in-place from the GUI.

## Preconditions

- desktop tests and typecheck are green
- the control-plane host is already deployed
- a static directory exists for the update feed, for example
  `/srv/karpik/desktop-updates/win32/x64/`
- installed desktop clients have `KARPIK_UPDATE_FEED_URL` set to the published
  feed URL

## Build

From `desktop/` run:

- `npm run test`
- `npm run typecheck`
- `npm run make`

Expected release artifacts:

- `out/make/squirrel.windows/x64/RELEASES`
- `out/make/squirrel.windows/x64/KarpikSetup.exe`
- `out/make/squirrel.windows/x64/karpik-<version>-full.nupkg`
- `out/make/zip/win32/x64/Karpik-win32-x64-<version>.zip`

## Publish

1. copy `RELEASES`, `KarpikSetup.exe`, and `karpik-<version>-full.nupkg` into
   the static feed directory
2. keep older `.nupkg` files if you want Squirrel to support stepping through
   versions
3. make sure `RELEASES` is published together with the matching package files
4. verify the feed URL from a browser:
   - `https://<host>/desktop-updates/win32/x64/RELEASES`

## Client update flow

1. open `Сервисы`
2. confirm the `Desktop updates` card shows `Updater enabled: yes`
3. click `Проверить обновления`
4. wait until the phase becomes `downloaded`
5. click `Установить обновление`
6. let Windows updater restart the desktop app

## Rollback

- republish the previous `RELEASES` file and matching `.nupkg` set
- if the latest build is bad, remove it from the feed before clients download it
- keep the previous installer available for clean reinstall if needed
