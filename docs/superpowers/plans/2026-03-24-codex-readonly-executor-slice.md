# Codex Read-Only Executor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Telegram-triggered tasks run `codex exec` in read-only mode against a configured local workspace and deliver the final answer back through the existing pipeline.

**Architecture:** Keep the server and bot task contract unchanged except for policy escalation. Add a desktop-only codex settings store plus a codex runner wrapper, then extend the existing task executor with a typed `codex <prompt>` capability.

**Tech Stack:** Electron, TypeScript, Vitest, FastAPI, Python, local Codex CLI

---

### Task 1: Persist local codex settings

**Files:**
- Create: `desktop/src/main/codexSettingsStore.ts`
- Create: `desktop/src/main/codexSettingsStore.test.ts`
- Modify: `desktop/src/main/bootstrapFolders.ts`
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/preload/index.ts`
- Modify: `desktop/src/renderer/pages/SettingsPage.tsx`
- Modify: `desktop/src/renderer/App.test.tsx`

- [ ] Step 1: Write failing tests for default workspace, save/load, and settings UI wiring.
- [ ] Step 2: Run the desktop test target and verify it fails for missing codex settings support.
- [ ] Step 3: Implement the minimal store and IPC wiring.
- [ ] Step 4: Update the settings page to show and save the workspace path.
- [ ] Step 5: Re-run desktop tests until green.
- [ ] Step 6: Commit `feat: add codex workspace settings`

### Task 2: Add read-only codex execution

**Files:**
- Modify: `desktop/src/main/taskExecutor.ts`
- Modify: `desktop/src/main/taskExecutor.test.ts`

- [ ] Step 1: Write failing executor tests for `codex <prompt>`, blank prompt, missing workspace, and runner failures.
- [ ] Step 2: Run the focused desktop executor tests and verify they fail for the expected reason.
- [ ] Step 3: Implement a small codex runner wrapper with dependency injection for tests.
- [ ] Step 4: Wire `codex <prompt>` into the existing executor with trimmed output and explicit errors.
- [ ] Step 5: Re-run focused desktop tests until green.
- [ ] Step 6: Commit `feat: add read-only codex executor`

### Task 3: Escalate codex tasks to high risk

**Files:**
- Modify: `server/app/services/task_policy.py`
- Modify: `server/tests/test_task_policy.py`

- [ ] Step 1: Write a failing server policy test for `codex` requests.
- [ ] Step 2: Run the focused server test and verify it fails correctly.
- [ ] Step 3: Implement the minimal policy change.
- [ ] Step 4: Re-run the focused server test until green.
- [ ] Step 5: Commit `feat: protect codex tasks with high-risk policy`

### Task 4: Full regression and live CLI smoke check

**Files:**
- No code changes expected unless regression fixes are needed.

- [ ] Step 1: Run `desktop` tests.
- [ ] Step 2: Run `desktop` typecheck.
- [ ] Step 3: Run `desktop` package.
- [ ] Step 4: Run `server` tests.
- [ ] Step 5: Run `bot` tests.
- [ ] Step 6: Run one local `codex exec` smoke command in read-only mode.
- [ ] Step 7: Commit regression fixes if needed.
