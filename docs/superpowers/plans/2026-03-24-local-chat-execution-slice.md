# Local Chat Execution Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent local chat history and direct GUI-origin execution inside `Чаты`.

**Architecture:** Extend `LocalChatStore` from summaries into summary-plus-detail storage, add a desktop-only `localChatRuntime` that appends messages around executor results, expose it through IPC, and upgrade `ChatsPage` into a detail view with local send.

**Tech Stack:** Electron, React, TypeScript, Vitest

---

### Task 1: Extend local chat persistence to include messages

**Files:**
- Modify: `desktop/src/main/localChatStore.ts`
- Modify: `desktop/src/main/localChatStore.test.ts`

- [ ] Step 1: Write failing tests for message append, detail retrieval, and persisted reload.
- [ ] Step 2: Run the focused store tests and verify they fail.
- [ ] Step 3: Implement chat detail plus message persistence with migration from summary-only data.
- [ ] Step 4: Re-run the focused store tests until green.
- [ ] Step 5: Commit `feat: persist local chat messages`

### Task 2: Add a local chat execution runtime

**Files:**
- Create: `desktop/src/main/localChatRuntime.ts`
- Create: `desktop/src/main/localChatRuntime.test.ts`
- Modify: `desktop/src/main/taskExecutor.ts`
- Modify: `desktop/src/main/taskExecutor.test.ts`

- [ ] Step 1: Write failing tests for success, failure, and local-approval chat execution paths.
- [ ] Step 2: Run the focused runtime tests and verify they fail because the runtime does not exist.
- [ ] Step 3: Implement the runtime and allow executor calls to accept explicit local workspace context.
- [ ] Step 4: Re-run the focused runtime tests until green.
- [ ] Step 5: Commit `feat: add local chat runtime`

### Task 3: Expose local chat detail and send flow through IPC

**Files:**
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/preload/index.ts`
- Modify: `desktop/src/renderer/window.d.ts`

- [ ] Step 1: Add IPC handlers for chat detail and send.
- [ ] Step 2: Reuse the new local chat runtime from the main process.
- [ ] Step 3: Keep the API desktop-only and avoid server changes.
- [ ] Step 4: Commit `feat: expose local chat execution ipc`

### Task 4: Upgrade `Чаты` into a real detail view

**Files:**
- Modify: `desktop/src/renderer/pages/ChatsPage.tsx`
- Modify: `desktop/src/renderer/App.tsx`
- Modify: `desktop/src/renderer/App.test.tsx`
- Modify: `desktop/src/renderer/styles.css`

- [ ] Step 1: Write failing UI tests for selected chat detail, message history, and send flow.
- [ ] Step 2: Run the focused app tests and verify they fail for the current list-only view.
- [ ] Step 3: Implement the local detail panel and send action.
- [ ] Step 4: Re-run the focused tests until green.
- [ ] Step 5: Commit `feat: add local chat detail ui`

### Task 5: Full regression and packaging

**Files:**
- No code changes expected unless regression fixes are needed.

- [ ] Step 1: Run `desktop` tests.
- [ ] Step 2: Run `desktop` typecheck.
- [ ] Step 3: Run `desktop` package.
- [ ] Step 4: Run `server` tests.
- [ ] Step 5: Run `bot` tests.
- [ ] Step 6: Commit regression fixes if needed.
