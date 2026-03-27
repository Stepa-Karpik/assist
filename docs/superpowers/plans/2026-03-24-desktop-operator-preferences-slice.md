# Desktop Operator Preferences Implementation Plan

> **Goal:** make Karpik behave like an always-on tray app by adding persisted operator preferences and wiring them into Electron startup behavior.

## Task 1: Add RED tests

Files:
- `desktop/src/main/appPreferencesStore.test.ts`
- `desktop/src/renderer/App.test.tsx`

- [ ] Add store tests for defaults, persistence, and login item settings payload.
- [ ] Add renderer test for loading and saving operator preferences from settings.
- [ ] Run desktop RED and confirm failures are caused by missing preferences support.

## Task 2: Add main-side preferences store

Files:
- `desktop/src/main/appPreferencesStore.ts`
- `desktop/src/main/main.ts`
- `desktop/src/main/windows.ts`

- [ ] Implement persisted preferences store.
- [ ] Apply login item settings from saved preferences.
- [ ] Respect `--start-hidden` during window creation.
- [ ] Hide to tray on close when configured.

## Task 3: Expose preferences to renderer

Files:
- `desktop/src/preload/index.ts`
- `desktop/src/renderer/window.d.ts`

- [ ] Add `getAppPreferences` and `saveAppPreferences`.

## Task 4: Upgrade settings UI

Files:
- `desktop/src/renderer/pages/SettingsPage.tsx`

- [ ] Add desktop operator preferences card.
- [ ] Load current preferences with the rest of settings.
- [ ] Save preferences through IPC.

## Task 5: Verify

- [ ] Run desktop tests.
- [ ] Run desktop typecheck.
- [ ] Run desktop package.
