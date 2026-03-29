# Multi-Device Pairing, Registry, and Desktop Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `/pair` and linked-application persistence while upgrading the shared server/bot architecture to support multiple local devices cleanly, with verified desktop autostart and tray lifecycle behavior.

**Architecture:** Move trust, pairing, active Telegram-device routing, and public application catalogs to server-owned device-scoped state. Keep secrets, absolute launch paths, and desktop behavior local. Implement the migration in small slices so single-device users continue working while multi-device support comes online.

**Tech Stack:** Electron, React, TypeScript, FastAPI, Python, JSON-backed server state backend, aiogram, Vitest, pytest.

---

## File structure and responsibilities

### Server

- Modify: `server/app/services/state_backend.py`
  - Persist new device-scoped sections for devices, trust, bindings, and public app catalog.
- Create: `server/app/services/device_registry.py`
  - Own device records, telegram-device bindings, and trust membership.
- Modify: `server/app/services/pairing_store.py`
  - Make pairing sessions authoritative on the server and update trust through the device registry.
- Create: `server/app/services/app_catalog_store.py`
  - Persist and query device-scoped public app catalogs.
- Modify: `server/app/api/pairing.py`
  - Accept and expose pairing sessions in server-owned form.
- Modify: `server/app/api/events.py`
  - Route bot pair attempts into server-owned pairing/trust state.
- Modify: `server/app/api/tasks.py`
  - Resolve trusted access by `telegram_user_id + device_id`, not desktop-local trust assumptions.
- Create: `server/app/api/devices.py`
  - Provide `devices`, `use-device`, and device catalog endpoints for the bot and future UI.
- Modify: `server/app/main.py`
  - Register new stores and routes.

### Bot

- Modify: `bot/app/conversation.py`
  - Resolve active target device before task routing.
- Modify: `bot/app/task_client.py`
  - Send `device_id` explicitly for tasks and device operations.
- Modify: `bot/app/pairing_client.py`
  - Consume the new server pairing/trust responses.
- Modify: `bot/app/handlers/help.py`
  - Update help text for `/devices`, `/use`, `/apps`, and automatic routing.
- Create: `bot/app/handlers/devices.py`
  - Implement `/devices` and `/use`.
- Modify: `bot/app/main.py`
  - Register new handlers and inject device-aware clients.

### Desktop main

- Modify: `desktop/src/main/syncClient.ts`
  - Add server calls for device registration, public app catalog sync, trust refresh, and device selection helpers.
- Modify: `desktop/src/main/main.ts`
  - Register device on startup, sync app catalog, fetch trust state from server, and verify autostart/tray lifecycle.
- Modify: `desktop/src/main/pairingStore.ts`
  - Stop treating local trusted IDs as source of truth; keep only local pairing session/display logic.
- Modify: `desktop/src/main/appRegistryStore.ts`
  - Preserve local registry behavior while publishing filtered public catalog to server.
- Create: `desktop/src/main/deviceContextStore.ts`
  - Cache local knowledge about the current device registration and server-visible trust summary.
- Modify: `desktop/src/main/appPreferencesStore.ts`
  - Make launch-at-login behavior an explicit tested contract.

### Desktop renderer

- Modify: `desktop/src/renderer/pages/SettingsPage.tsx`
  - Show pairing/trust state without leaking server URLs or raw infrastructure details.
- Modify: `desktop/src/renderer/pages/ApplicationsPage.tsx`
  - Fix save/remove UX, separate linked vs discovered apps clearly, and show sync failures in product language.
- Modify: `desktop/src/renderer/pages/ServicesPage.tsx`
  - Remove raw server/feed/IP visibility from normal UI.
- Modify: `desktop/src/renderer/window.d.ts`
  - Add any new IPC contracts.
- Modify: `desktop/src/preload/index.ts`
  - Expose new IPC calls.

### Tests

- Create: `server/tests/test_device_registry.py`
- Modify: `server/tests/test_pairing.py`
- Modify: `server/tests/test_tasks.py`
- Create: `server/tests/test_app_catalog.py`
- Create: `bot/tests/test_devices.py`
- Modify: `bot/tests/test_pair.py`
- Modify: `bot/tests/test_conversation.py`
- Modify: `desktop/src/main/pairingStore.test.ts`
- Create: `desktop/src/main/deviceContextStore.test.ts`
- Modify: `desktop/src/main/appRegistryStore.test.ts`
- Modify: `desktop/src/main/main.test.ts` or existing focused desktop main tests
- Modify: `desktop/src/renderer/App.test.tsx`
- Modify: `desktop/src/renderer/feedback.test.tsx`

---

### Task 1: Add server-owned device and trust state

**Files:**
- Create: `server/app/services/device_registry.py`
- Modify: `server/app/services/state_backend.py`
- Modify: `server/app/main.py`
- Test: `server/tests/test_device_registry.py`

- [ ] **Step 1: Write the failing tests**

Add tests for:
- registering a device record
- granting trust for `telegram_user_id + device_id`
- resolving all trusted devices for a Telegram user
- setting and reading active/default device binding

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest server/tests/test_device_registry.py -v`
Expected: FAIL because the registry/store does not exist yet.

- [ ] **Step 3: Implement the minimal registry**

Implement a small `DeviceRegistry` that persists:
- `devices`
- `device_trust`
- `telegram_device_bindings`

Use `StateBackend.read_section/write_section` so the current JSON backend keeps working.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest server/tests/test_device_registry.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/app/services/device_registry.py server/app/services/state_backend.py server/app/main.py server/tests/test_device_registry.py
git commit -m "feat: add server device registry"
```

### Task 2: Refactor pairing to server-owned truth

**Files:**
- Modify: `server/app/services/pairing_store.py`
- Modify: `server/app/api/pairing.py`
- Modify: `server/app/api/events.py`
- Modify: `desktop/src/main/pairingStore.ts`
- Modify: `desktop/src/main/syncClient.ts`
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/renderer/pages/SettingsPage.tsx`
- Test: `server/tests/test_pairing.py`
- Test: `desktop/src/main/pairingStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Cover:
- opening a pairing session for a specific `device_id`
- `/pair`-style event resolution creates trust in the server registry
- desktop restart does not destroy effective trust because trust now comes from server state

- [ ] **Step 2: Run the tests to verify they fail**

Run:
- `pytest server/tests/test_pairing.py -v`
- `npm run test -- pairingStore`

Expected: FAIL on new server-owned trust expectations.

- [ ] **Step 3: Implement the minimal server-owned pairing flow**

Changes:
- pairing session opens against server state with `device_id`
- successful pair attempt grants trust through `DeviceRegistry`
- desktop `PairingStore` only owns current local code/session display, not the trusted-user source of truth
- settings page reads trust count from synced server state

- [ ] **Step 4: Run the tests to verify they pass**

Run:
- `pytest server/tests/test_pairing.py -v`
- `npm run test -- pairingStore feedback`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/app/services/pairing_store.py server/app/api/pairing.py server/app/api/events.py desktop/src/main/pairingStore.ts desktop/src/main/syncClient.ts desktop/src/main/main.ts desktop/src/renderer/pages/SettingsPage.tsx server/tests/test_pairing.py desktop/src/main/pairingStore.test.ts
git commit -m "feat: move pairing trust to server state"
```

### Task 3: Make linked applications authoritative and device-scoped

**Files:**
- Create: `server/app/services/app_catalog_store.py`
- Create: `server/tests/test_app_catalog.py`
- Create: `server/app/api/devices.py`
- Modify: `desktop/src/main/appRegistryStore.ts`
- Modify: `desktop/src/main/syncClient.ts`
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/renderer/pages/ApplicationsPage.tsx`
- Modify: `desktop/src/preload/index.ts`
- Modify: `desktop/src/renderer/window.d.ts`
- Test: `desktop/src/main/appRegistryStore.test.ts`
- Test: `desktop/src/renderer/feedback.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add coverage for:
- local save/remove still persists on disk
- desktop publishes only public app catalog fields to server
- `/apps` catalog source is linked device-scoped entries, not discovered noise
- renderer shows linked and discovered sections clearly

- [ ] **Step 2: Run the tests to verify they fail**

Run:
- `pytest server/tests/test_app_catalog.py -v`
- `npm run test -- appRegistryStore feedback`

Expected: FAIL because public catalog sync/store is missing.

- [ ] **Step 3: Implement the minimal device-scoped catalog**

Changes:
- keep `launchPath` local only
- sync only `appId/displayName/aliases/linked/source` to server
- on save/remove/refresh-discovered, re-publish the device public catalog
- update the Applications page copy and feedback so success/failure is understandable

- [ ] **Step 4: Run the tests to verify they pass**

Run:
- `pytest server/tests/test_app_catalog.py -v`
- `npm run test -- appRegistryStore feedback`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/app/services/app_catalog_store.py server/app/api/devices.py server/tests/test_app_catalog.py desktop/src/main/appRegistryStore.ts desktop/src/main/syncClient.ts desktop/src/main/main.ts desktop/src/renderer/pages/ApplicationsPage.tsx desktop/src/preload/index.ts desktop/src/renderer/window.d.ts desktop/src/main/appRegistryStore.test.ts desktop/src/renderer/feedback.test.tsx
git commit -m "feat: sync linked app catalog by device"
```

### Task 4: Make the bot device-aware

**Files:**
- Create: `bot/app/handlers/devices.py`
- Modify: `bot/app/task_client.py`
- Modify: `bot/app/pairing_client.py`
- Modify: `bot/app/conversation.py`
- Modify: `bot/app/main.py`
- Modify: `bot/app/handlers/help.py`
- Test: `bot/tests/test_devices.py`
- Test: `bot/tests/test_pair.py`
- Test: `bot/tests/test_conversation.py`

- [ ] **Step 1: Write the failing tests**

Cover:
- pairing assigns an active/default device
- `/devices` lists trusted devices
- `/use <device>` switches active device
- ordinary task routing uses the resolved active device
- single-device users continue working without explicit device selection

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest bot/tests/test_devices.py bot/tests/test_pair.py bot/tests/test_conversation.py -v`
Expected: FAIL on missing device-routing behavior.

- [ ] **Step 3: Implement minimal device-aware routing**

Changes:
- add bot helpers for listing/selecting devices
- pass resolved `device_id` into task and status requests
- keep current UX simple for single-device users

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest bot/tests/test_devices.py bot/tests/test_pair.py bot/tests/test_conversation.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add bot/app/handlers/devices.py bot/app/task_client.py bot/app/pairing_client.py bot/app/conversation.py bot/app/main.py bot/app/handlers/help.py bot/tests/test_devices.py bot/tests/test_pair.py bot/tests/test_conversation.py
git commit -m "feat: route bot requests by active device"
```

### Task 5: Verify and harden desktop startup and tray lifecycle

**Files:**
- Modify: `desktop/src/main/appPreferencesStore.ts`
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/main/windows.ts`
- Modify: `desktop/src/main/tray.ts`
- Modify: `desktop/src/renderer/pages/SettingsPage.tsx`
- Test: `desktop/src/renderer/App.test.tsx`
- Test: any existing desktop-main lifecycle tests that cover login item and tray behavior

- [ ] **Step 1: Write the failing tests**

Add tests for:
- toggling `launchAtLogin` updates Electron login item settings
- `startHiddenOnLaunch` keeps the main window hidden
- `closeToTrayOnClose` hides instead of quitting
- explicit tray exit still quits

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- App windows tray`
Expected: FAIL on lifecycle expectations not asserted today.

- [ ] **Step 3: Implement the minimal hardening**

Changes:
- ensure login-item toggles are applied immediately and restored on startup
- verify tray close/hide/exit behavior paths
- keep settings labels human-readable and avoid leaking technical details

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- App windows tray`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop/src/main/appPreferencesStore.ts desktop/src/main/main.ts desktop/src/main/windows.ts desktop/src/main/tray.ts desktop/src/renderer/pages/SettingsPage.tsx desktop/src/renderer/App.test.tsx
git commit -m "fix: harden desktop startup and tray lifecycle"
```

### Task 6: Hide infrastructure details from normal UI and run final regression

**Files:**
- Modify: `desktop/src/renderer/pages/ServicesPage.tsx`
- Modify: `desktop/src/renderer/pages/SettingsPage.tsx`
- Modify: `desktop/src/renderer/App.tsx`
- Modify: `desktop/src/renderer/styles.css`
- Test: `desktop/src/renderer/App.test.tsx`
- Test: any focused Services/Settings renderer tests

- [ ] **Step 1: Write the failing tests**

Cover:
- normal UI does not show raw server IP, server URL, update feed URL
- product language remains visible (`server online`, `updates available`, `this PC`, etc.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- App Services Settings`
Expected: FAIL because raw infrastructure details are currently visible.

- [ ] **Step 3: Implement the minimal UI concealment**

Changes:
- hide server URL/IP/feed from normal views
- keep only product-facing status summaries
- preserve enough local debugging via logs rather than normal UI text

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- App Services Settings`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop/src/renderer/pages/ServicesPage.tsx desktop/src/renderer/pages/SettingsPage.tsx desktop/src/renderer/App.tsx desktop/src/renderer/styles.css desktop/src/renderer/App.test.tsx
git commit -m "fix: hide infrastructure details from ui"
```

### Task 7: Final integration verification

**Files:**
- Modify as needed based on failures found in the full run

- [ ] **Step 1: Run full server test suite**

Run: `pytest server/tests -v`
Expected: PASS

- [ ] **Step 2: Run full bot test suite**

Run: `pytest bot/tests -v`
Expected: PASS

- [ ] **Step 3: Run full desktop test suite**

Run: `npm run test`
Expected: PASS

- [ ] **Step 4: Run desktop typecheck and packaging**

Run:
- `npm run typecheck`
- `npm run make`

Expected: PASS

- [ ] **Step 5: Commit final cleanup**

```bash
git add -A
git commit -m "feat: ship multi-device pairing and registry support"
```

---

## Local review notes

Because subagent delegation is not authorized in this session, this plan was reviewed locally against the spec with focus on:

- preserving single-device behavior
- not leaking launch paths to server
- upgrading pairing and app catalog in compatible order
- treating autostart/tray as a tested product contract

The riskiest implementation edge is the migration from desktop-local trust assumptions to server-owned device trust. That is why the plan sequences server registry first, pairing second, bot routing later.

