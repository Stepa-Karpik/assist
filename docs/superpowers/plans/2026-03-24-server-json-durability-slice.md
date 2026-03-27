# Server JSON Durability Slice Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist core server state across restarts using a shared JSON state file.

**Architecture:** Introduce a small JSON backend and inject it into the existing in-memory stores. Each durable store persists only its own section of the file after mutation. Runtime-only waiters and time-based ephemeral state remain in memory.

**Tech Stack:** FastAPI, Python stdlib, pytest

---

### Task 1: Add Shared JSON State Backend

**Files:**
- Create: `server/app/services/state_backend.py`
- Modify: `server/app/config.py`
- Test: `server/tests/test_state_persistence.py`

- [ ] **Step 1: Write the failing persistence tests**

Cover:
- task store reloads task history from the same file
- pairing store reloads trusted users from the same file
- challenge store reloads auth config flags from the same file
- delivery store reloads pending outbox events from the same file

- [ ] **Step 2: Run the persistence tests to confirm failure**

Run: `pytest server/tests/test_state_persistence.py -v`
Expected: FAIL because the shared backend does not exist yet

- [ ] **Step 3: Implement the shared backend**

Support:
- reading one named section
- writing one named section
- missing/invalid file fallback to empty state

- [ ] **Step 4: Add `KARPIK_STATE_FILE` config**

Default to `server/.tmp/runtime-state.json`.

- [ ] **Step 5: Run the persistence tests again**

Run: `pytest server/tests/test_state_persistence.py -v`
Expected: still FAIL because stores are not wired yet

### Task 2: Wire Durable Sections Into Existing Stores

**Files:**
- Modify: `server/app/services/task_store.py`
- Modify: `server/app/services/pairing_store.py`
- Modify: `server/app/services/challenge_store.py`
- Modify: `server/app/services/delivery_store.py`
- Modify: `server/app/main.py`

- [ ] **Step 1: Add optional backend injection to each store**

Persist:
- tasks
- trusted users
- auth config flags
- delivery events

- [ ] **Step 2: Keep ephemeral sections in memory**

Do not persist:
- pairing sessions/events
- auth waiters/events
- lockouts/trust windows/challenge waiters

- [ ] **Step 3: Load durable sections on startup**

When the app starts, stores should hydrate from the configured JSON file.

- [ ] **Step 4: Run the persistence tests**

Run: `pytest server/tests/test_state_persistence.py -v`
Expected: PASS

- [ ] **Step 5: Run the full server suite**

Run: `pytest server/tests -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server docs
git commit -m "feat: add server json durability"
```

### Task 3: Verify And Push

**Files:**
- Modify: `docs/runbooks/local-dev.md`

- [ ] **Step 1: Update the runbook briefly**

Document the state file location and override env var.

- [ ] **Step 2: Run desktop tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 3: Run desktop typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Run server tests**

Run: `pytest server/tests -v`
Expected: PASS

- [ ] **Step 5: Run bot tests**

Run: `pytest bot/tests -v`
Expected: PASS

- [ ] **Step 6: Push the branch**

```bash
git push -u origin task-6-bot-bootstrap
```
