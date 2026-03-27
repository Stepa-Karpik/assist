# Telegram Pairing Slice Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real end-to-end Telegram pairing slice so the desktop app can open a pairing window, the bot can forward `/pair <code>` to the server, and the desktop app can locally validate the code and trust the Telegram user.

**Architecture:** Use the existing desktop-server polling model and extend it with pairing sessions and pending events. The server stores lightweight pairing metadata and replicated trusted-user state, while the desktop remains the only authority for the actual pair code and its validation.

**Tech Stack:** Electron, React, TypeScript, Vite, FastAPI, aiogram, pytest, vitest

---

### Task 1: Add Server Pairing Session And Event Skeleton

**Files:**
- Modify: `server/app/main.py`
- Create: `server/app/api/pairing.py`
- Create: `server/app/api/events.py`
- Create: `server/app/models/pairing.py`
- Create: `server/app/services/pairing_store.py`
- Test: `server/tests/test_pairing_api.py`

- [ ] **Step 1: Write the failing server pairing tests**

Add tests for:
- opening a pairing session
- creating a pending pair attempt
- listing pending events for a device
- resolving an event and storing the trusted Telegram user

- [ ] **Step 2: Run the pairing tests to confirm failure**

Run: `pytest server/tests/test_pairing_api.py -v`
Expected: FAIL because the pairing routes and store do not exist yet

- [ ] **Step 3: Implement the pairing models and in-memory store**

Create:
- a pairing session model
- a pair attempt event model
- in-memory store methods for open, close, create event, list events, resolve event, and trusted-user replication

- [ ] **Step 4: Add the server API routes**

Implement:
- `POST /api/pairing/open`
- `POST /api/pairing/close`
- `POST /api/bot/pair-attempt`
- `GET /api/events?device_id=...`
- `POST /api/events/{event_id}/resolve`

- [ ] **Step 5: Run the full server test suite**

Run: `pytest server/tests -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server
git commit -m "feat: add pairing session api"
```

### Task 2: Add Desktop Pairing State And Local Validation

**Files:**
- Create: `desktop/src/main/pairingStore.ts`
- Create: `desktop/src/main/pairingStore.test.ts`
- Modify: `desktop/src/main/bootstrapFolders.ts`
- Modify: `desktop/src/main/bootstrapFolders.test.ts`

- [ ] **Step 1: Write the failing desktop pairing-state tests**

Add tests for:
- opening a pairing session creates one active code with a 5-minute expiry
- generating a new code invalidates the previous code
- resolving a valid pair attempt adds the Telegram user to the trusted allowlist
- invalid codes do not add users

- [ ] **Step 2: Run the pairing-state tests to confirm failure**

Run: `npm run test`
Expected: FAIL because `pairingStore.ts` does not exist yet

- [ ] **Step 3: Implement the pairing state module**

Create a focused module that:
- creates the one-time code
- keeps the active pairing session
- stores trusted Telegram user IDs
- validates incoming pair attempts locally

- [ ] **Step 4: Extend runtime folders for local state**

Update runtime bootstrap so the desktop app has a dedicated `state/` directory for pairing and trusted-user persistence.

- [ ] **Step 5: Run desktop tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add desktop
git commit -m "feat: add desktop pairing state"
```

### Task 3: Wire Desktop Sync And GUI Controls For Pairing

**Files:**
- Modify: `desktop/src/main/syncClient.ts`
- Modify: `desktop/src/main/syncClient.test.ts`
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/preload/index.ts`
- Modify: `desktop/src/renderer/window.d.ts`
- Modify: `desktop/src/renderer/pages/SettingsPage.tsx`
- Modify: `desktop/src/renderer/App.test.tsx` if needed

- [ ] **Step 1: Write the failing sync and UI tests**

Add tests for:
- pairing sync client payloads
- settings page showing a pairing code action and current state text

- [ ] **Step 2: Run desktop tests to confirm failure**

Run: `npm run test`
Expected: FAIL

- [ ] **Step 3: Extend the desktop sync client**

Add methods for:
- opening a pairing session on the server
- closing a pairing session on the server
- fetching pending pairing events
- resolving pairing events back to the server

- [ ] **Step 4: Wire pairing polling into the main process**

On app boot:
- continue the existing online announcement
- poll pending events
- hand pair attempts to the local pairing store
- post results back to the server

- [ ] **Step 5: Expose minimal pairing controls to the renderer**

Expose preload methods for:
- opening a pairing session
- reading the current pairing state

Render in settings:
- pairing button
- current code
- expiry hint

- [ ] **Step 6: Run desktop tests again**

Run: `npm run test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add desktop
git commit -m "feat: wire desktop pairing flow"
```

### Task 4: Integrate Bot `/pair` With The Server

**Files:**
- Modify: `bot/app/config.py`
- Modify: `bot/app/main.py`
- Modify: `bot/app/handlers/pair.py`
- Modify: `bot/app/handlers/start.py`
- Modify: `bot/app/handlers/messages.py`
- Create: `bot/tests/test_pair_handler.py`

- [ ] **Step 1: Write the failing bot tests**

Add tests for:
- valid `/pair` request producing the success text
- invalid code producing `Код недействителен`
- no active pairing session producing no outgoing message

- [ ] **Step 2: Run bot tests to confirm failure**

Run: `pytest bot/tests -v`
Expected: FAIL

- [ ] **Step 3: Add a minimal server-facing bot client**

Implement a small HTTP helper that sends `/pair` attempts to the server and returns one of:
- `paired`
- `invalid_code`
- `ignored`

- [ ] **Step 4: Update bot handlers**

Change behavior so:
- `/pair` calls the server
- success replies `Устройство привязано`
- invalid code replies `Код недействителен`
- ignored results produce no response
- non-paired generic messages stay silent

- [ ] **Step 5: Run bot tests**

Run: `pytest bot/tests -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add bot
git commit -m "feat: connect pair command to server"
```

### Task 5: Verify The Pairing Slice End To End

**Files:**
- No new files required

- [ ] **Step 1: Run the desktop tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 2: Run the desktop typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run the server tests**

Run: `pytest server/tests -v`
Expected: PASS

- [ ] **Step 4: Run the bot tests**

Run: `pytest bot/tests -v`
Expected: PASS

- [ ] **Step 5: Commit any final cleanups**

```bash
git add desktop server bot
git commit -m "test: verify telegram pairing slice"
```

Only make this commit if verification required final cleanup changes.
