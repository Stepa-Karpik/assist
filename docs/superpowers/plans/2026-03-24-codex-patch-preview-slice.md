# Codex Patch Preview Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Telegram-triggered `codex-write` tasks generate a local patch preview, wait for desktop approval, and only then apply file edits into the real workspace.

**Architecture:** Keep the server as the task state authority, but store preview artifacts only on the desktop. The desktop executor generates a temp workspace preview, the task runtime publishes `awaiting_local_approval`, and the GUI resolves the preview with local approve/reject actions.

**Tech Stack:** Electron, TypeScript, Vitest, React, FastAPI, Python, local Codex CLI

---

### Task 1: Add server transitions for local approval

**Files:**
- Modify: `server/app/models/task.py`
- Modify: `server/app/api/tasks.py`
- Modify: `server/app/services/task_store.py`
- Modify: `server/app/services/delivery_store.py`
- Modify: `server/tests/test_task_execution_api.py`

- [ ] Step 1: Write failing server tests for `running -> awaiting_local_approval`, `awaiting_local_approval -> done`, and `awaiting_local_approval -> blocked`.
- [ ] Step 2: Run the focused server tests and verify they fail for the missing lifecycle transitions.
- [ ] Step 3: Implement the minimal store and API transitions.
- [ ] Step 4: Ensure blocked Telegram tasks still create a delivery event.
- [ ] Step 5: Re-run the focused server tests until green.
- [ ] Step 6: Commit `feat: add local approval task transitions`

### Task 2: Add desktop preview generation and persistence

**Files:**
- Create: `desktop/src/main/codexWritePreview.ts`
- Create: `desktop/src/main/codexWritePreview.test.ts`
- Create: `desktop/src/main/localApprovalStore.ts`
- Create: `desktop/src/main/localApprovalStore.test.ts`
- Modify: `desktop/src/main/codexRunner.ts`

- [ ] Step 1: Write failing desktop tests for preview generation, no-change behavior, and approve/reject persistence.
- [ ] Step 2: Run the focused desktop tests and verify they fail for missing preview support.
- [ ] Step 3: Implement the minimal temp-workspace preview generator.
- [ ] Step 4: Implement the local approval store with drift detection and cleanup.
- [ ] Step 5: Re-run the focused desktop tests until green.
- [ ] Step 6: Commit `feat: add codex write preview store`

### Task 3: Wire runtime and GUI local approval flow

**Files:**
- Modify: `desktop/src/main/taskExecutor.ts`
- Modify: `desktop/src/main/taskExecutor.test.ts`
- Modify: `desktop/src/main/taskRuntime.ts`
- Modify: `desktop/src/main/taskRuntime.test.ts`
- Modify: `desktop/src/main/syncClient.ts`
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/preload/index.ts`
- Modify: `desktop/src/renderer/window.d.ts`
- Modify: `desktop/src/renderer/pages/BlockedTasksPage.tsx`
- Modify: `desktop/src/renderer/App.test.tsx`

- [ ] Step 1: Write failing runtime and UI tests for `codex-write`, pending local approval rendering, and approve/reject actions.
- [ ] Step 2: Run the focused desktop tests and verify they fail for missing IPC or runtime transitions.
- [ ] Step 3: Implement `codex-write` intent parsing in the executor.
- [ ] Step 4: Publish `awaiting_local_approval` through the server sync client and persist preview artifacts locally.
- [ ] Step 5: Add renderer actions and preview details to `Невыполненное`.
- [ ] Step 6: Re-run the focused desktop tests until green.
- [ ] Step 7: Commit `feat: add local codex approval flow`

### Task 4: Update task policy and delivery expectations

**Files:**
- Modify: `server/app/services/task_policy.py`
- Modify: `server/tests/test_task_policy.py`
- Modify: `bot/tests/test_task_handler.py`

- [ ] Step 1: Write failing tests covering `codex-write` risk escalation and status messaging.
- [ ] Step 2: Run the focused server and bot tests and verify they fail correctly.
- [ ] Step 3: Implement the minimal policy and message updates.
- [ ] Step 4: Re-run the focused tests until green.
- [ ] Step 5: Commit `feat: cover codex write policy`

### Task 5: Full regression and packaging

**Files:**
- No code changes expected unless regression fixes are needed.

- [ ] Step 1: Run `desktop` tests.
- [ ] Step 2: Run `desktop` typecheck.
- [ ] Step 3: Run `desktop` package.
- [ ] Step 4: Run `server` tests.
- [ ] Step 5: Run `bot` tests.
- [ ] Step 6: Run one local smoke command for `codex-write` preview generation if feasible.
- [ ] Step 7: Commit regression fixes if needed.
