# Desktop Shell and Owner Profile Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the desktop app around the approved reference shell, add a synced owner profile, and migrate all existing pages into a coherent modern UI without breaking current task/auth/runtime behavior.

**Architecture:** Keep the existing desktop/server/runtime core, introduce a new renderer shell with explicit `Главная` and `Профиль` routes, add a local owner-profile store plus server sync, and feed profile context only into Telegram and local DeepSeek conversational layers. Rebuild the tray popup as a separate compact surface instead of shrinking the main layout.

**Tech Stack:** Electron, React, TypeScript, Vitest, FastAPI, pytest

---

### Task 1: Add owner profile storage and sync primitives

**Files:**
- Create: `desktop/src/main/ownerProfileStore.ts`
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/main/syncClient.ts`
- Modify: `server/app/main.py`
- Create: `server/app/api/profile.py`
- Create: `server/tests/test_profile_api.py`
- Test: `desktop/src/main/ownerProfileStore.test.ts`

- [ ] **Step 1: Write failing desktop and server tests for loading, saving, and syncing owner profile**
- [ ] **Step 2: Run focused vitest and pytest to confirm the failures**
- [ ] **Step 3: Implement local owner profile store with edit-friendly shape and view-mode filtering helpers**
- [ ] **Step 4: Add server profile endpoint and durable storage hook**
- [ ] **Step 5: Expose IPC methods and desktop sync path**
- [ ] **Step 6: Re-run focused tests until green**

### Task 2: Inject owner profile into conversational context only where allowed

**Files:**
- Modify: `bot/app/conversation.py`
- Modify: `bot/app/task_client.py`
- Modify: `desktop/src/main/localChatRuntime.ts`
- Modify: `desktop/src/main/deepseekClient.ts`
- Test: `bot/tests/test_conversation.py`
- Test: `desktop/src/main/localChatRuntime.test.ts`

- [ ] **Step 1: Write failing tests showing Telegram and local DeepSeek requests receive owner profile context**
- [ ] **Step 2: Run focused tests and confirm failures**
- [ ] **Step 3: Thread owner profile through conversational request builders**
- [ ] **Step 4: Assert Codex paths do not receive personal owner fields**
- [ ] **Step 5: Re-run focused tests until green**

### Task 3: Build the new desktop shell and pixel-close Home page

**Files:**
- Modify: `desktop/src/renderer/App.tsx`
- Modify: `desktop/src/renderer/layout/Sidebar.tsx`
- Modify: `desktop/src/renderer/styles.css`
- Create: `desktop/src/renderer/pages/HomePage.tsx`
- Test: `desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Write failing renderer tests for `Главная`, new sidebar structure, and default route**
- [ ] **Step 2: Run focused vitest to confirm failures**
- [ ] **Step 3: Introduce the new shell, navigation model, and logo asset plumbing**
- [ ] **Step 4: Implement the reference-close Home page with hero, top bar, summary, and quick input**
- [ ] **Step 5: Re-run focused renderer tests until green**

### Task 4: Add Profile page with beautiful view/edit states

**Files:**
- Create: `desktop/src/renderer/pages/ProfilePage.tsx`
- Modify: `desktop/src/renderer/App.tsx`
- Modify: `desktop/src/renderer/styles.css`
- Test: `desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Write failing renderer tests for separate `Профиль` navigation and hidden empty fields**
- [ ] **Step 2: Run focused vitest and confirm failures**
- [ ] **Step 3: Build profile card layout, avatar fallback, and edit mode**
- [ ] **Step 4: Wire save/edit actions to IPC and optimistic renderer state**
- [ ] **Step 5: Re-run focused renderer tests until green**

### Task 5: Migrate chats and remaining pages to the new visual system

**Files:**
- Modify: `desktop/src/renderer/pages/ChatsPage.tsx`
- Modify: `desktop/src/renderer/pages/TelegramChatsPage.tsx`
- Modify: `desktop/src/renderer/pages/BlockedTasksPage.tsx`
- Modify: `desktop/src/renderer/pages/ApplicationsPage.tsx`
- Modify: `desktop/src/renderer/pages/KnowledgePage.tsx`
- Modify: `desktop/src/renderer/pages/LogsPage.tsx`
- Modify: `desktop/src/renderer/pages/ServicesPage.tsx`
- Modify: `desktop/src/renderer/pages/SettingsPage.tsx`
- Modify: `desktop/src/renderer/styles.css`
- Test: `desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Write failing renderer tests for messenger layout and presence of all migrated sections**
- [ ] **Step 2: Run focused vitest and confirm failures**
- [ ] **Step 3: Convert `Чаты` to left-list/right-thread messenger layout**
- [ ] **Step 4: Re-style Telegram, blocked, apps, knowledge, logs, services, and settings into the same shell**
- [ ] **Step 5: Re-run focused renderer tests until green**

### Task 6: Rebuild tray popup as a compact dedicated surface

**Files:**
- Modify: `desktop/src/main/windows.ts`
- Modify: `desktop/src/main/tray.ts`
- Modify: `desktop/src/renderer/App.tsx`
- Modify: `desktop/src/renderer/styles.css`
- Test: `desktop/src/main/windows.test.ts`
- Test: `desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Write failing tests for tray-attached popup sizing and no-scroll compact layout**
- [ ] **Step 2: Run focused vitest and confirm failures**
- [ ] **Step 3: Refine popup sizing/positioning and blur-to-hide behavior**
- [ ] **Step 4: Replace popup content with a compact layout that always fits**
- [ ] **Step 5: Re-run focused tests until green**

### Task 7: Full regression sweep and packaging

**Files:**
- Modify: touched docs if needed
- Test: full desktop/server/bot suites

- [ ] **Step 1: Normalize touched Russian UI strings and remove mojibake from affected surfaces**
- [ ] **Step 2: Run `npm run test` in `desktop`**
- [ ] **Step 3: Run `npm run typecheck` in `desktop`**
- [ ] **Step 4: Run `pytest` for `server` and any touched `bot` suites**
- [ ] **Step 5: Run `npm run make` in `desktop` and validate the installer output**
