# Desktop Notifications Implementation Plan

> **Goal:** make tray-first usage practical by surfacing important remote task transitions as local desktop notifications.

## Task 1: Add RED tests

Files:
- `desktop/src/main/appPreferencesStore.test.ts`
- `desktop/src/main/taskNotifications.test.ts`
- `desktop/src/renderer/App.test.tsx`

- [ ] Extend app preferences tests for `notificationsEnabled`.
- [ ] Add notification builder tests for `awaiting_local_approval`, `done`, `failed`, and ignored states.
- [ ] Extend settings UI test to save the notifications checkbox.
- [ ] Run desktop RED and confirm failures are caused by missing notification support.

## Task 2: Add notification builder

Files:
- `desktop/src/main/taskNotifications.ts`

- [ ] Implement focused notification-title/body mapping from task snapshot items.

## Task 3: Wire notifications into main runtime

Files:
- `desktop/src/main/main.ts`
- `desktop/src/main/appPreferencesStore.ts`

- [ ] Extend app preferences state.
- [ ] Show Electron notifications only when enabled.
- [ ] Reuse existing task snapshot change detection.

## Task 4: Expose and edit the preference

Files:
- `desktop/src/renderer/pages/SettingsPage.tsx`
- `desktop/src/renderer/window.d.ts`
- `desktop/src/preload/index.ts`

- [ ] Add the checkbox to desktop behavior settings.
- [ ] Save the new flag with the existing preferences flow.

## Task 5: Verify

- [ ] Run desktop tests.
- [ ] Run desktop typecheck.
- [ ] Run desktop package.
