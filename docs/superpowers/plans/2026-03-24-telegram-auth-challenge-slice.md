# Telegram Auth Challenge Slice Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first real password/TOTP/trust-window auth flow for Telegram-origin tasks on top of the existing pairing transport.

**Architecture:** Keep the desktop app as the only authority for secret storage and validation. The server owns challenge state, trust-window timing, and task status transitions; the bot stays as a thin command-driven ingress that relays `/task`, `/auth`, `/confirm`, and `/decline`.

**Tech Stack:** Electron, React, TypeScript, Node `crypto`, FastAPI, aiogram, pytest, vitest

---

### Task 1: Add Server-Side Auth Challenge State And Protected Task Intake

**Files:**
- Modify: `server/app/models/task.py`
- Modify: `server/app/api/tasks.py`
- Create: `server/app/models/challenge.py`
- Create: `server/app/services/challenge_store.py`
- Create: `server/app/api/challenges.py`
- Modify: `server/app/main.py`
- Test: `server/tests/test_auth_challenge_api.py`

- [ ] **Step 1: Write the failing server challenge tests**

Cover:
- trusted `low` risk Telegram task queues immediately
- trusted `medium` risk Telegram task opens a `password` challenge when no trust window exists
- successful password resolution queues the `medium` task and opens a `5 minute` trust window for the same chat
- trusted `high` risk task with an active trust window still requires `confirm`
- repeated failed auth attempts lock the chat for `3 minutes`
- missing desktop auth setup returns a GUI-setup response instead of opening a challenge

- [ ] **Step 2: Run the server challenge tests to confirm failure**

Run: `pytest server/tests/test_auth_challenge_api.py -v`
Expected: FAIL because challenge models, store, and routes do not exist yet

- [ ] **Step 3: Extend the server task model for Telegram auth**

Add fields for:
- `risk`
- `required_auth`
- `telegram_user_id`
- `chat_id`
- `challenge_id`

Use the existing task statuses and move Telegram tasks to `awaiting_auth` until the challenge passes.

- [ ] **Step 4: Implement the challenge models and in-memory store**

Create:
- challenge records with `password | totp | confirm`
- per-chat lockouts
- per-chat trust windows
- lightweight desktop auth configuration status per device
- helper methods for creating task-bound challenges and applying step results

- [ ] **Step 5: Add the challenge and protected-task API routes**

Implement:
- `POST /api/auth/config/status`
- `GET /api/auth/events?device_id=...`
- `POST /api/auth/events/{event_id}/resolve`
- extend `POST /api/tasks` to accept Telegram metadata and risk
- `POST /api/challenges/input`
- `POST /api/challenges/decision`

- [ ] **Step 6: Run the full server test suite**

Run: `pytest server/tests -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server
git commit -m "feat: add auth challenge api"
```

### Task 2: Add Desktop Auth Secret Storage And Local Validation

**Files:**
- Create: `desktop/src/main/authStore.ts`
- Create: `desktop/src/main/authStore.test.ts`
- Modify: `desktop/src/main/bootstrapFolders.ts`
- Modify: `desktop/src/main/bootstrapFolders.test.ts`

- [ ] **Step 1: Write the failing desktop auth-store tests**

Cover:
- saving a password stores a derived verifier rather than raw plaintext
- validating a correct password succeeds
- validating a wrong password fails
- validating a TOTP token succeeds for the current 30-second window
- trust-window and lockout timing remain server-owned and are not persisted locally

- [ ] **Step 2: Run the desktop tests to confirm failure**

Run: `npm run test`
Expected: FAIL because `authStore.ts` does not exist yet

- [ ] **Step 3: Implement the local auth store**

Create a focused module that:
- persists local auth settings under `secrets/`
- hashes the password with Node `crypto`
- stores the TOTP secret locally
- validates password and TOTP inputs without exposing the secret values
- reports only capability flags (`passwordConfigured`, `totpConfigured`) to the rest of the app

- [ ] **Step 4: Run desktop tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop
git commit -m "feat: add desktop auth store"
```

### Task 3: Wire Desktop Sync, Polling, And Settings For Auth Challenges

**Files:**
- Modify: `desktop/src/main/syncClient.ts`
- Modify: `desktop/src/main/syncClient.test.ts`
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/preload/index.ts`
- Modify: `desktop/src/renderer/window.d.ts`
- Modify: `desktop/src/renderer/pages/SettingsPage.tsx`
- Modify: `desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Write the failing desktop sync/UI tests**

Cover:
- announcing desktop auth config status to the server
- fetching pending auth events
- resolving auth events back to the server
- settings page allowing password and TOTP secret configuration
- settings page showing local auth capability status

- [ ] **Step 2: Run the desktop tests to confirm failure**

Run: `npm run test`
Expected: FAIL

- [ ] **Step 3: Extend the sync client for auth events**

Add methods for:
- posting auth capability status
- fetching auth events
- resolving auth events

- [ ] **Step 4: Wire auth event polling into the main process**

At startup and after settings changes:
- send auth capability status to the server
- poll auth events
- validate password/TOTP inputs locally through `authStore`
- resolve the result back to the server

- [ ] **Step 5: Expose settings controls through preload**

Expose:
- `getAuthConfigState`
- `saveAuthConfig`
- keep the existing pairing API

- [ ] **Step 6: Render auth configuration in settings**

Add:
- password input
- TOTP secret input
- save action
- capability status text
- keep the existing pairing controls intact

- [ ] **Step 7: Run desktop tests again**

Run: `npm run test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add desktop
git commit -m "feat: wire desktop auth challenge flow"
```

### Task 4: Add Telegram Task Intake And Challenge Commands In The Bot

**Files:**
- Modify: `bot/app/config.py`
- Modify: `bot/app/main.py`
- Modify: `bot/app/handlers/messages.py`
- Modify: `bot/app/handlers/start.py`
- Modify: `bot/app/handlers/pair.py`
- Modify: `bot/app/pairing_client.py`
- Create: `bot/app/task_client.py`
- Create: `bot/app/handlers/task.py`
- Create: `bot/tests/test_task_handler.py`

- [ ] **Step 1: Write the failing bot auth/task tests**

Cover:
- untrusted `/task` stays silent
- trusted `low` risk `/task low ...` queues immediately
- trusted `medium` risk `/task medium ...` prompts for password
- `/auth <value>` transitions `password -> totp -> confirm` as required
- `/confirm` queues the high-risk task
- `/decline` cancels the active high-risk challenge
- lockout and setup-required responses are surfaced with user-readable text

- [ ] **Step 2: Run bot tests to confirm failure**

Run: `pytest bot/tests -v`
Expected: FAIL

- [ ] **Step 3: Add a task/challenge HTTP client for the bot**

Implement a thin client for:
- creating Telegram tasks
- sending auth input
- sending confirm/decline decisions

- [ ] **Step 4: Update bot handlers**

Support:
- `/task <low|medium|high> <intent>`
- `/auth <value>`
- `/confirm`
- `/decline`
- continue staying silent for generic non-paired messages

- [ ] **Step 5: Run bot tests**

Run: `pytest bot/tests -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add bot
git commit -m "feat: add telegram auth challenge commands"
```

### Task 5: Verify The Auth Challenge Slice End To End

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
git add desktop server bot docs
git commit -m "test: verify telegram auth challenge slice"
```

Only make this commit if verification required final cleanup changes.
