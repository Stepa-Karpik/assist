# Pairing Persistence and Reinstall Onboarding Design

## Goal

Make Telegram pairing durable for a specific PC even across reinstall, while showing the first-run onboarding flow again after reinstall without breaking the existing Telegram-to-PC trust.

## Problem

The current desktop pairing flow is split across two sources of truth:

- the desktop `PairingStore` generates and validates the pairing code locally
- the server `pairing_store` only tracks an active session shell and trusted Telegram IDs

That design is fragile. The UI can show an active session that the server cannot validate on its own, and reinstall behavior is coupled to runtime files in a way that can accidentally reset the PC identity. The current desktop bootstrap path also still falls back to `desktop-local`, which is incompatible with durable device ownership.

## Design Summary

### 1. Durable Device Identity

Desktop gets a dedicated `deviceIdentityStore`.

- It generates a stable `device_id` on first launch.
- It persists the ID under the existing `AppData/Karpik` root, separate from ordinary runtime caches.
- It is read before sync, pairing, task execution, auth sync, and profile sync start.
- `KARPIK_DEVICE_ID` stops being the normal runtime source. It may remain as an emergency override only.

This makes the PC identity survive process restarts and reinstalls as long as the app data root survives.

### 2. Server-Owned Pairing

Pairing becomes fully server-owned.

- Desktop still generates the pairing code locally.
- When the user opens pairing, desktop sends `{ device_id, code, expires_at }` to the server.
- The server persists the full active session, including the code.
- Bot `/pair <code>` resolves entirely against server state.
- Desktop no longer decides pairing success by comparing codes in local memory.

Desktop keeps only a display cache of pairing state for the UI.

### 3. Durable Trusted Mapping

Trusted Telegram users remain attached to the server-side `device_id`.

- Reinstall does not reset trust.
- Restart does not reset trust.
- Desktop reads trusted-user count and current active pairing session from the server.

### 4. Reinstall Onboarding Gate

The app gets a separate onboarding gate store.

- `device identity` is durable and should survive reinstall.
- `onboarding completion` is separate and may be considered incomplete again after reinstall or fresh install.
- On app startup, if onboarding is not complete for this installation, desktop shows the onboarding flow before the main shell.
- The onboarding flow collects owner profile fields and optional password/TOTP settings.
- Telegram pairing is shown inside onboarding with:
  - preferred path: `/start pair_<token>` deep-link
  - fallback path: `/pair <code>`

If the device is already paired, onboarding must clearly say so and allow the user to continue without losing that pairing.

## Detailed Behavior

### Pairing UX

- `Settings -> Открыть pairing` opens a server-backed session and shows the code.
- The same pairing state is visible after a desktop restart.
- If a pairing session expires, server and desktop both show it as expired/inactive.
- Trusted Telegram IDs shown in the UI come from the server response, not from a local set.

### Reinstall UX

- After reinstall, the app reads the existing durable `device_id`.
- The user sees onboarding again.
- If the device is already trusted, onboarding shows that the PC is already linked and offers:
  - continue
  - open a new pairing session if the user wants to link another Telegram user

### Backward Compatibility

- Existing trusted device mappings on the server remain valid.
- Existing local runtime folders remain valid.
- If no durable device identity file exists but old runtime data exists, desktop creates a new durable identity once and then uses it consistently going forward.

## Files and Responsibilities

### Desktop

- `desktop/src/main/deviceIdentityStore.ts`
  - create/load durable `device_id`
- `desktop/src/main/onboardingStateStore.ts`
  - track whether onboarding must be shown for the current installation
- `desktop/src/main/pairingStore.ts`
  - becomes a lightweight server-state cache, not the source of truth for trust
- `desktop/src/main/main.ts`
  - bootstrap identity early, use it everywhere, expose onboarding state to renderer
- `desktop/src/renderer/App.tsx`
  - route between onboarding gate and main shell
- `desktop/src/renderer/pages/SettingsPage.tsx`
  - read and display server-backed pairing state

### Server

- `server/app/models/pairing.py`
  - pairing open payload includes `code`
  - session model includes `code`
- `server/app/api/pairing.py`
  - add read endpoint for current pairing state by `device_id`
- `server/app/services/pairing_store.py`
  - store active code, trusted users, and durable session state

### Bot

- `bot/app/pairing_client.py`
  - support `/start pair_<token>` or server-backed pair lookup if needed
- `bot/app/handlers/pair.py`
  - continue to support `/pair <code>` against server state only
- `bot/app/handlers/start.py`
  - support pairing deep-link start payload

## Error Handling

- If server pairing open fails, desktop shows a local error and does not report an active session.
- If server state is unreachable, desktop shows the last known display state as stale and does not claim pairing is active unless confirmed from the server.
- If onboarding cannot sync owner profile, the user stays in onboarding until required local state is saved; server sync can retry in background.

## Testing Requirements

### Desktop

- durable device identity persists across store reloads
- pairing state survives main-process reload because source of truth is server-backed
- onboarding gate appears when installation state is incomplete
- onboarding gate does not delete or reset existing pairing

### Server

- pairing open stores code and expiry
- `/pair` resolves correctly against stored code
- trusted-user list persists across store reloads
- pairing state read endpoint returns current session and trust information

### Bot

- `/pair <code>` still works
- `/start pair_<token>` routes into the same device pairing flow

## Acceptance Criteria

1. `/pair` from Settings works in the regular desktop app.
2. A trusted Telegram-to-PC link survives app restart.
3. The same trusted link survives app reinstall.
4. Reinstall shows onboarding again, but the PC identity remains the same.
5. No normal runtime path depends on `desktop-local`.
