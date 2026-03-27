# Chat Continuation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first real local chat UX by introducing a persistent desktop chat store and continuation from Telegram chats into local chats.

**Architecture:** Keep local chat state entirely on the desktop. Add a runtime-backed chat store in `desktop/src/main`, expose it through preload IPC, use `Чаты Telegram` to create continuation chats, and render only local chats in `Чаты`.

**Tech Stack:** Electron, React, TypeScript, Vitest

---

### Task 1: Add a persistent local chat store

**Files:**
- Create: `desktop/src/main/localChatStore.ts`
- Create: `desktop/src/main/localChatStore.test.ts`

- [ ] Step 1: Write failing tests for desktop chat creation, Telegram continuation creation, and reload from disk.
- [ ] Step 2: Run the focused chat store tests and verify they fail because the store does not exist yet.
- [ ] Step 3: Implement the minimal persistent store under runtime `state/`.
- [ ] Step 4: Re-run the focused tests until green.
- [ ] Step 5: Commit `feat: add local chat store`

### Task 2: Expose local chats through preload and main process

**Files:**
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/preload/index.ts`
- Modify: `desktop/src/renderer/window.d.ts`

- [ ] Step 1: Add IPC handlers for listing local chats and creating desktop or continuation chats.
- [ ] Step 2: Expose the bridge methods through preload and renderer typings.
- [ ] Step 3: Keep the payloads local-only and avoid server changes.
- [ ] Step 4: Commit `feat: expose local chat ipc`

### Task 3: Turn `Чаты` into a real local chat list

**Files:**
- Modify: `desktop/src/renderer/pages/ChatsPage.tsx`
- Modify: `desktop/src/renderer/App.test.tsx`

- [ ] Step 1: Write failing UI tests for empty state, local chat listing, and desktop chat creation.
- [ ] Step 2: Run the focused app tests and verify they fail for the placeholder page.
- [ ] Step 3: Implement the minimal local chat list UI.
- [ ] Step 4: Re-run the focused tests until green.
- [ ] Step 5: Commit `feat: add local chats page`

### Task 4: Add `Продолжить чат` from Telegram into local chats

**Files:**
- Modify: `desktop/src/renderer/pages/TelegramChatsPage.tsx`
- Modify: `desktop/src/renderer/App.tsx`
- Modify: `desktop/src/renderer/App.test.tsx`

- [ ] Step 1: Write failing UI tests for creating a continuation chat from a Telegram chat.
- [ ] Step 2: Run the focused app tests and verify they fail for missing continuation action.
- [ ] Step 3: Implement the continuation action and switch the UI back to `Чаты` after success.
- [ ] Step 4: Re-run the focused tests until green.
- [ ] Step 5: Commit `feat: add telegram chat continuation`

### Task 5: Full regression and packaging

**Files:**
- No code changes expected unless regression fixes are needed.

- [ ] Step 1: Run `desktop` tests.
- [ ] Step 2: Run `desktop` typecheck.
- [ ] Step 3: Run `desktop` package.
- [ ] Step 4: Run `server` tests.
- [ ] Step 5: Run `bot` tests.
- [ ] Step 6: Commit regression fixes if needed.
