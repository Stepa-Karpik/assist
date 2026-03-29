# Self-Serve Device Onboarding Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:test-driven-development and superpowers:executing-plans when implementing this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shared server/shared bot architecture truly self-serve for unrelated users by removing manual `device_id` setup, introducing automatic device registration, adding Telegram deep-link onboarding, and gating desktop entry behind first-run onboarding.

**Architecture:** Add a local persistent device identity store on desktop, a server registration and onboarding-token flow, Telegram `/start pair_<token>` handling in the bot, and a desktop onboarding wizard that blocks entry into the main shell until registration, Telegram linking, and local security are complete.

**Tech Stack:** Electron, React, TypeScript, FastAPI, Python, aiogram, JSON-backed server state, Vitest, pytest.

---

## File structure and responsibilities

### Server

- Modify: `server/app/models/device.py`
  - Add device registration, onboarding status, and onboarding-token models.
- Modify: `server/app/services/state_backend.py`
  - Persist onboarding-token state.
- Modify: `server/app/services/device_registry.py`
  - Register devices and expose onboarding summaries.
- Create: `server/app/services/onboarding_token_store.py`
  - Create, validate, and consume short-lived Telegram deep-link tokens.
- Modify: `server/app/api/device.py`
  - Add registration and onboarding endpoints.
- Modify: `server/app/api/events.py`
  - Add start-link token consumption endpoint for bot.
- Modify: `server/app/main.py`
  - Register new store(s).

### Bot

- Modify: `bot/app/task_client.py`
  - Add bot-side client methods for start-link token consumption.
- Modify: `bot/app/handlers/start.py`
  - Parse `/start pair_<token>`.
- Modify: `bot/app/main.py`
  - Register updated start flow.
- Modify: `bot/app/handlers/help.py`
  - Mention the new deep-link onboarding path.

### Desktop main

- Create: `desktop/src/main/deviceIdentityStore.ts`
  - Generate and persist local `deviceId` and `deviceLabel`.
- Modify: `desktop/src/main/syncClient.ts`
  - Register device, fetch onboarding status, request onboarding token.
- Modify: `desktop/src/main/main.ts`
  - Use device identity store instead of `KARPIK_DEVICE_ID`.
  - Register device before normal runtime startup.
  - Expose onboarding IPC.
- Modify: `desktop/src/main/ownerProfileStore.ts`
  - Add completeness helper for onboarding gating if needed.

### Desktop renderer

- Create: `desktop/src/renderer/pages/OnboardingPage.tsx`
  - First-run wizard.
- Modify: `desktop/src/renderer/App.tsx`
  - Gate main shell behind onboarding completion.
- Modify: `desktop/src/renderer/window.d.ts`
  - Add onboarding IPC types.
- Modify: `desktop/src/preload/index.ts`
  - Expose onboarding IPC methods.
- Modify: `desktop/src/renderer/styles.css`
  - Add onboarding layout styles consistent with current shell.

### Tests

- Create: `server/tests/test_onboarding_tokens.py`
- Modify: `server/tests/test_device_registry.py`
- Modify: `server/tests/test_devices_api.py`
- Create: `bot/tests/test_start_link.py`
- Create: `desktop/src/main/deviceIdentityStore.test.ts`
- Modify: `desktop/src/renderer/App.test.tsx`
- Create: `desktop/src/renderer/onboarding.test.tsx`

---

### Task 1: Add server-side device registration and onboarding token flow

**Files:**
- Modify: `server/app/models/device.py`
- Modify: `server/app/services/state_backend.py`
- Modify: `server/app/services/device_registry.py`
- Create: `server/app/services/onboarding_token_store.py`
- Modify: `server/app/api/device.py`
- Modify: `server/app/api/events.py`
- Modify: `server/app/main.py`
- Tests:
  - `server/tests/test_device_registry.py`
  - `server/tests/test_devices_api.py`
  - `server/tests/test_onboarding_tokens.py`

- [ ] **Step 1: Write failing tests**

Cover:
- registering a new device with label and owner summary
- idempotent re-registration of an existing device
- minting onboarding tokens for a device
- consuming onboarding tokens exactly once
- computing onboarding status from trust/profile/auth state

- [ ] **Step 2: Run tests and confirm red**

Run:
- `pytest server/tests/test_device_registry.py server/tests/test_devices_api.py server/tests/test_onboarding_tokens.py -v`

- [ ] **Step 3: Implement minimal server support**

Implement:
- device registration endpoint
- onboarding status endpoint
- onboarding token minting and consumption
- storage for token lifecycle

- [ ] **Step 4: Run tests and confirm green**

Run:
- `pytest server/tests/test_device_registry.py server/tests/test_devices_api.py server/tests/test_onboarding_tokens.py -v`

- [ ] **Step 5: Commit**

```bash
git add server/app/models/device.py server/app/services/state_backend.py server/app/services/device_registry.py server/app/services/onboarding_token_store.py server/app/api/device.py server/app/api/events.py server/app/main.py server/tests/test_device_registry.py server/tests/test_devices_api.py server/tests/test_onboarding_tokens.py
git commit -m "feat: add device onboarding registration api"
```

### Task 2: Add bot deep-link pairing

**Files:**
- Modify: `bot/app/task_client.py`
- Modify: `bot/app/handlers/start.py`
- Modify: `bot/app/main.py`
- Modify: `bot/app/handlers/help.py`
- Tests:
- `bot/tests/test_start_help.py`
- `bot/tests/test_start_link.py`

- [ ] **Step 1: Write failing tests**

Cover:
- `/start pair_<token>` successfully pairs the Telegram user to the target device
- invalid token returns a Russian error
- normal `/start` without payload still shows the standard intro

- [ ] **Step 2: Run tests and confirm red**

Run:
- `pytest bot/tests/test_start_help.py bot/tests/test_start_link.py -v`

- [ ] **Step 3: Implement minimal deep-link support**

Implement:
- token consumption client call
- `/start` payload parsing
- Russian success and failure messages

- [ ] **Step 4: Run tests and confirm green**

Run:
- `pytest bot/tests/test_start_help.py bot/tests/test_start_link.py -v`

- [ ] **Step 5: Commit**

```bash
git add bot/app/task_client.py bot/app/handlers/start.py bot/app/main.py bot/app/handlers/help.py bot/tests/test_start_help.py bot/tests/test_start_link.py
git commit -m "feat: add telegram onboarding deep links"
```

### Task 3: Add desktop device identity store and onboarding IPC

**Files:**
- Create: `desktop/src/main/deviceIdentityStore.ts`
- Modify: `desktop/src/main/syncClient.ts`
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/main/ownerProfileStore.ts`
- Modify: `desktop/src/preload/index.ts`
- Modify: `desktop/src/renderer/window.d.ts`
- Tests:
- `desktop/src/main/deviceIdentityStore.test.ts`
- focused main tests as needed

- [ ] **Step 1: Write failing tests**

Cover:
- first launch generates and persists a stable `deviceId`
- subsequent launches reuse the same identity
- default `deviceLabel` uses hostname
- sync client can register device and request onboarding token

- [ ] **Step 2: Run tests and confirm red**

Run:
- `npm run test -- deviceIdentityStore main syncClient`

- [ ] **Step 3: Implement minimal desktop identity layer**

Implement:
- local store for `deviceId/deviceLabel/createdAt`
- replace env-driven `deviceId` with the store in runtime setup
- onboarding IPC for:
  - get identity
  - save device label
  - register device
  - fetch onboarding status
  - request onboarding token

- [ ] **Step 4: Run tests and confirm green**

Run:
- `npm run test -- deviceIdentityStore main syncClient`

- [ ] **Step 5: Commit**

```bash
git add desktop/src/main/deviceIdentityStore.ts desktop/src/main/syncClient.ts desktop/src/main/main.ts desktop/src/main/ownerProfileStore.ts desktop/src/preload/index.ts desktop/src/renderer/window.d.ts desktop/src/main/deviceIdentityStore.test.ts
git commit -m "feat: add desktop device identity store"
```

### Task 4: Add onboarding wizard gate in the renderer

**Files:**
- Create: `desktop/src/renderer/pages/OnboardingPage.tsx`
- Modify: `desktop/src/renderer/App.tsx`
- Modify: `desktop/src/renderer/styles.css`
- Tests:
- `desktop/src/renderer/App.test.tsx`
- `desktop/src/renderer/onboarding.test.tsx`

- [ ] **Step 1: Write failing tests**

Cover:
- fresh install lands on onboarding, not the main app
- onboarding collects owner profile and device label
- onboarding shows Telegram deep-link CTA
- onboarding exposes `/pair <code>` fallback
- main shell appears only after onboarding completion

- [ ] **Step 2: Run tests and confirm red**

Run:
- `npm run test -- App onboarding`

- [ ] **Step 3: Implement minimal onboarding UI**

Implement:
- wizard view
- first-run gate in `App.tsx`
- owner profile + device label save flow
- `Open Telegram` CTA using `start_link`
- fallback pairing UI

- [ ] **Step 4: Run tests and confirm green**

Run:
- `npm run test -- App onboarding`

- [ ] **Step 5: Commit**

```bash
git add desktop/src/renderer/pages/OnboardingPage.tsx desktop/src/renderer/App.tsx desktop/src/renderer/styles.css desktop/src/renderer/App.test.tsx desktop/src/renderer/onboarding.test.tsx
git commit -m "feat: add gated desktop onboarding flow"
```

### Task 5: Migration and full verification

**Files:**
- Modify as needed based on test failures

- [ ] **Step 1: Verify server**

Run:
- `pytest server/tests -q`

- [ ] **Step 2: Verify bot**

Run:
- `pytest bot/tests -q`

- [ ] **Step 3: Verify desktop**

Run:
- `npm run test`
- `npm run typecheck`
- `npm run make`

- [ ] **Step 4: Final migration review**

Confirm:
- existing local data still loads
- existing trusted users on server do not get invalidated
- new installs can onboard without manual `device_id`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add self-serve device onboarding"
```

---

## Local review notes

The main risk is not code complexity but rollout ordering. The desktop must not be fully gated until the server and bot already support registration and Telegram deep-link pairing. That is why the plan is backend-first, then bot, then desktop identity, then onboarding UI.
