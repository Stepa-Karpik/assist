# Remote Task Control and UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add operator-grade task kill/status controls across server, Telegram, and desktop while redesigning the desktop UI into a usable modern operator console.

**Architecture:** Extend the current task lifecycle with explicit cancellation semantics, add desktop-side execution handles for running tasks, reuse the existing task history/presence transport for Telegram operator views, and refactor renderer layouts into a chat-first dashboard with a tray-attached compact popup.

**Tech Stack:** FastAPI, aiogram, Electron, React, TypeScript, Vitest, pytest

---

### Task 1: Add server-side cancellation lifecycle

**Files:**
- Modify: `server/app/models/task.py`
- Modify: `server/app/services/task_store.py`
- Modify: `server/app/api/tasks.py`
- Test: `server/tests/test_task_execution_api.py`

- [ ] **Step 1: Write failing server tests for cancel semantics**
- [ ] **Step 2: Run focused pytest and confirm failures**
- [ ] **Step 3: Add `cancel_requested` and `cancelled` task states plus store transitions**
- [ ] **Step 4: Add `/api/tasks/{task_id}/cancel` and any list/filter updates**
- [ ] **Step 5: Re-run focused pytest until green**

### Task 2: Add desktop execution registry and task kill flow

**Files:**
- Modify: `desktop/src/main/taskExecutor.ts`
- Modify: `desktop/src/main/taskRuntime.ts`
- Modify: `desktop/src/main/syncClient.ts`
- Modify: `desktop/src/main/main.ts`
- Test: `desktop/src/main/taskRuntime.test.ts`
- Test: `desktop/src/main/taskExecutor.test.ts`

- [ ] **Step 1: Write failing desktop tests for cancelling running tasks**
- [ ] **Step 2: Run focused vitest and confirm failures**
- [ ] **Step 3: Introduce cancellable execution handles and active-task registry**
- [ ] **Step 4: Teach polling loop to detect `cancel_requested` and finalize as `cancelled`**
- [ ] **Step 5: Add IPC method for GUI-triggered task cancellation**
- [ ] **Step 6: Re-run focused vitest until green**

### Task 3: Add Telegram operator commands and inline kill actions

**Files:**
- Modify: `bot/app/task_client.py`
- Modify: `bot/app/conversation.py`
- Modify: `bot/app/intent_resolver.py`
- Modify: `bot/app/main.py`
- Modify: `bot/app/handlers/help.py`
- Test: `bot/tests/test_conversation.py`
- Test: `bot/tests/test_main.py`

- [ ] **Step 1: Write failing bot tests for `/pc`, `/queue`, `/last`, `/kill`, and inline kill callbacks**
- [ ] **Step 2: Run focused pytest and confirm failures**
- [ ] **Step 3: Extend task client with device/queue/history/cancel fetches**
- [ ] **Step 4: Implement handlers and inline buttons**
- [ ] **Step 5: Extend natural-language resolver for status/queue/kill phrases**
- [ ] **Step 6: Re-run focused pytest until green**

### Task 4: Fix local chat intent flow for natural messages

**Files:**
- Modify: `desktop/src/main/localChatRuntime.ts`
- Create: `desktop/src/main/localIntentResolver.ts`
- Test: `desktop/src/main/localChatRuntime.test.ts`
- Test: `desktop/src/main/localIntentResolver.test.ts`

- [ ] **Step 1: Write failing tests showing `привет` and similar messages no longer surface unsupported intent**
- [ ] **Step 2: Run focused vitest and confirm failures**
- [ ] **Step 3: Add local intent resolver and codex fallback path**
- [ ] **Step 4: Integrate resolver into local chat runtime**
- [ ] **Step 5: Re-run focused vitest until green**

### Task 5: Redesign main desktop chat and operator panels

**Files:**
- Modify: `desktop/src/renderer/App.tsx`
- Modify: `desktop/src/renderer/pages/ChatsPage.tsx`
- Modify: `desktop/src/renderer/pages/BlockedTasksPage.tsx`
- Modify: `desktop/src/renderer/pages/TelegramChatsPage.tsx`
- Modify: `desktop/src/renderer/pages/ServicesPage.tsx`
- Modify: `desktop/src/renderer/styles.css`
- Test: `desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Write failing renderer tests for chat-thread layout and operator actions**
- [ ] **Step 2: Run focused vitest and confirm failures**
- [ ] **Step 3: Refactor main shell/sidebar/content layout**
- [ ] **Step 4: Convert local chats into messenger-style bubbles and sidebar**
- [ ] **Step 5: Add kill buttons and cleaner queue/history presentation**
- [ ] **Step 6: Re-run focused vitest until green**

### Task 6: Fix quick popup behavior and compact design

**Files:**
- Modify: `desktop/src/main/windows.ts`
- Modify: `desktop/src/main/tray.ts`
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/renderer/App.tsx`
- Modify: `desktop/src/renderer/styles.css`
- Test: `desktop/src/main/windows.test.ts`
- Test: `desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Write failing tests for popup positioning/hide/compact content behavior**
- [ ] **Step 2: Run focused vitest and confirm failures**
- [ ] **Step 3: Position popup relative to tray bounds and hide on blur/outside click**
- [ ] **Step 4: Redesign popup to fixed compact layout without scroll**
- [ ] **Step 5: Re-run focused vitest until green**

### Task 7: Normalize touched Russian strings and regressions

**Files:**
- Modify: touched bot/desktop files with mojibake strings
- Test: existing focused tests plus full suites

- [ ] **Step 1: Replace broken mojibake strings in touched surfaces**
- [ ] **Step 2: Run focused localization-related vitest/pytest**
- [ ] **Step 3: Run full verification for desktop, server, and bot**
- [ ] **Step 4: Build installer and validate packaging**
- [ ] **Step 5: Commit coherent implementation slices**
