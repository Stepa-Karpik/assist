# Runtime Observability Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add quick popup send, audit logs, and runtime service status to the desktop app.

**Architecture:** Persist desktop activity in a focused `activityLogStore`, reuse `localChatRuntime` for quick requests, and expose small IPC surfaces for popup/logs/services. Keep all behavior desktop-local; no server contract changes are needed.

**Tech Stack:** Electron, React, TypeScript, Vitest

---

### Task 1: Persist runtime activity log

**Files:**
- Create: `desktop/src/main/activityLogStore.ts`
- Create: `desktop/src/main/activityLogStore.test.ts`

- [ ] Step 1: Write failing tests for append, reload, and entry trimming.
- [ ] Step 2: Run the focused activity-log tests and verify they fail.
- [ ] Step 3: Implement the minimal persisted store.
- [ ] Step 4: Re-run the focused activity-log tests until green.
- [ ] Step 5: Commit `feat: add desktop activity log store`

### Task 2: Wire quick access and remote task audit in main

**Files:**
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/main/localChatRuntime.ts`
- Modify: `desktop/src/main/localChatStore.ts`

- [ ] Step 1: Write failing tests for quick-request behavior and App-level popup flow.
- [ ] Step 2: Run the focused tests and verify they fail for the current placeholder popup.
- [ ] Step 3: Add main-side wiring for activity logging, quick-request dispatch, and task snapshot diff logging.
- [ ] Step 4: Re-run the focused tests until green.
- [ ] Step 5: Commit `feat: wire quick access and runtime audit`

### Task 3: Expose logs and runtime status through IPC

**Files:**
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/preload/index.ts`
- Modify: `desktop/src/renderer/window.d.ts`

- [ ] Step 1: Add IPC for quick access state, quick request submit, activity log, and runtime status.
- [ ] Step 2: Keep the payloads renderer-friendly and desktop-only.
- [ ] Step 3: Commit `feat: expose runtime observability ipc`

### Task 4: Upgrade Quick Access, Logs, and Services views

**Files:**
- Modify: `desktop/src/renderer/App.tsx`
- Modify: `desktop/src/renderer/App.test.tsx`
- Modify: `desktop/src/renderer/pages/LogsPage.tsx`
- Modify: `desktop/src/renderer/pages/ServicesPage.tsx`
- Modify: `desktop/src/renderer/styles.css`

- [ ] Step 1: Write failing renderer tests for quick popup send, logs page, and services page.
- [ ] Step 2: Run the focused app tests and verify they fail.
- [ ] Step 3: Implement the renderer changes with minimal UI complexity.
- [ ] Step 4: Re-run the focused app tests until green.
- [ ] Step 5: Commit `feat: add runtime observability ui`

### Task 5: Full regression and packaging

**Files:**
- No code changes expected unless regression fixes are needed.

- [ ] Step 1: Run `desktop` tests.
- [ ] Step 2: Run `desktop` typecheck.
- [ ] Step 3: Run `desktop` package.
- [ ] Step 4: Run `server` tests.
- [ ] Step 5: Run `bot` tests.
- [ ] Step 6: Commit regression fixes if needed.
