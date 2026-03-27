# Desktop Sync Bandwidth Reduction Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut desktop network usage by making background task sync lightweight, lazy-loading large artifacts, and disabling unnecessary polling loops when they are idle.

**Architecture:** Keep the existing HTTP transport and task lifecycle, but split lightweight task snapshots from heavy artifact payloads. The desktop should poll only lightweight status data by default, fetch artifacts on demand, and avoid polling auth/pairing endpoints unless a relevant session is active.

**Tech Stack:** Electron, TypeScript, React, Vitest, FastAPI, Python, Pytest

---

### Task 1: Make server task listings lightweight

**Files:**
- Modify: `server/app/models/task.py`
- Modify: `server/app/api/tasks.py`
- Modify: `server/app/services/task_store.py`
- Modify: `server/tests/test_task_delivery_api.py`
- Modify: `server/tests/test_task_execution_api.py`

- [ ] Step 1: Write failing server tests proving list/history endpoints omit `artifact_base64` by default while preserving artifact metadata.
- [ ] Step 2: Run the focused server tests and verify they fail for the current heavy payload behavior.
- [ ] Step 3: Implement the minimal API/store changes so `/api/tasks` returns lightweight records by default.
- [ ] Step 4: Add an explicit path for requesting the full artifact payload only when needed.
- [ ] Step 5: Re-run the focused server tests until green.
- [ ] Step 6: Commit `fix: slim task snapshot payloads`

### Task 2: Stop desktop from polling heavy history continuously

**Files:**
- Modify: `desktop/src/main/syncClient.ts`
- Modify: `desktop/src/main/taskRuntime.ts`
- Modify: `desktop/src/main/taskRuntime.test.ts`
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/main/remoteTaskMirror.ts`

- [ ] Step 1: Write failing desktop tests for lightweight sync cycles and no background history polling.
- [ ] Step 2: Run the focused desktop tests and verify they fail for the current sync behavior.
- [ ] Step 3: Implement minimal runtime changes so background polling fetches queue/current snapshot only, not full history.
- [ ] Step 4: Keep manual/UI refresh paths for history where they are actually needed.
- [ ] Step 5: Re-run the focused desktop tests until green.
- [ ] Step 6: Commit `fix: remove heavy history polling`

### Task 3: Lazy-load artifacts only when UI needs them

**Files:**
- Modify: `desktop/src/main/syncClient.ts`
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/preload/index.ts`
- Modify: `desktop/src/renderer/window.d.ts`
- Modify: `desktop/src/renderer/pages/TelegramChatsPage.tsx`
- Modify: `desktop/src/renderer/pages/BlockedTasksPage.tsx`
- Modify: `desktop/src/renderer/pages/ChatsPage.tsx`
- Modify: `desktop/src/renderer/App.test.tsx`

- [ ] Step 1: Write failing renderer/main tests for fetching artifact data only when a card/detail actually needs it.
- [ ] Step 2: Run the focused desktop tests and verify they fail for the current eager artifact model.
- [ ] Step 3: Implement a minimal artifact fetch path and renderer wiring.
- [ ] Step 4: Ensure screenshot/file previews still render, but only after explicit load.
- [ ] Step 5: Re-run the focused desktop tests until green.
- [ ] Step 6: Commit `fix: lazy load remote task artifacts`

### Task 4: Gate idle polling loops

**Files:**
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/main/syncClient.test.ts`
- Modify: `desktop/src/renderer/App.test.tsx`

- [ ] Step 1: Write failing tests for not polling auth/pairing endpoints while there is no active auth challenge or pairing session.
- [ ] Step 2: Run the focused tests and verify they fail for the current always-on loops.
- [ ] Step 3: Implement the minimal gating logic while keeping active flows responsive.
- [ ] Step 4: Re-run the focused tests until green.
- [ ] Step 5: Commit `fix: gate idle auth and pairing polls`

### Task 5: Regression and comparison

**Files:**
- Modify: `docs/runbooks/local-dev.md`

- [ ] Step 1: Run `desktop` full tests before and after and record the counts.
- [ ] Step 2: Run `desktop` typecheck before and after and record the result.
- [ ] Step 3: Run `server` full pytest before and after and record the counts.
- [ ] Step 4: Summarize the traffic fix and the before/after verification in the final handoff.
