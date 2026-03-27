# Conversational Routing, App Launch, and UI Polish Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Karpik into a conversational Russian-first operator assistant across Telegram and desktop, with app/site launching, assistant-owned process control, and a polished minimal UI.

**Architecture:** Keep deterministic capability routing first, then use DeepSeek for conversational fallback, and escalate to Codex only for explicit `codex/кодекс` requests or file/project-sensitive prompts. Add a desktop-side application registry plus assistant process registry, then refactor the renderer into a chat-first operator console and a compact tray popup that behaves like a near-tray utility, not a second main window.

**Tech Stack:** aiogram, Python stdlib HTTP, Electron, React, TypeScript, Vitest, pytest

---

### Task 1: Extend Telegram routing for Russian conversational operator flows

**Files:**
- Modify: `bot/app/intent_resolver.py`
- Modify: `bot/app/conversation.py`
- Modify: `bot/app/main.py`
- Modify: `bot/app/handlers/help.py`
- Test: `bot/tests/test_intent_resolver.py`
- Test: `bot/tests/test_conversation.py`

- [ ] **Step 1: Write failing bot tests for `/apps`, verbal `приложения/программы`, app launch phrases, site open phrases, and DeepSeek-vs-Codex routing.**
- [ ] **Step 2: Run focused pytest for `bot/tests/test_intent_resolver.py` and `bot/tests/test_conversation.py` and confirm failures.**
- [ ] **Step 3: Split resolver output into deterministic operator/capability results plus conversational fallback instead of defaulting everything to `codex`.**
- [ ] **Step 4: Add Russian-first routing rules for `pc`, `queue`, `last`, `apps`, `kill`, `open-site`, `launch-app`, and screenshot clarification.**
- [ ] **Step 5: Add app selection pending-state with numeric choice and inline-button flows for linked apps.**
- [ ] **Step 6: Re-run focused pytest until green.**

### Task 2: Add bot-side DeepSeek chat/router fallback and Russian response shaping

**Files:**
- Modify: `bot/app/intent_resolver.py`
- Modify: `bot/app/conversation.py`
- Modify: `bot/app/main.py`
- Modify: `bot/app/config.py`
- Test: `bot/tests/test_intent_resolver.py`
- Test: `bot/tests/test_conversation.py`

- [ ] **Step 1: Write failing tests showing generic prompts like `привет` become assistant replies, while explicit `codex` and file-sensitive prompts still escalate to Codex.**
- [ ] **Step 2: Run focused pytest and confirm failures.**
- [ ] **Step 3: Introduce a conversational DeepSeek reply path that can return Russian assistant text without creating a task when no deterministic capability matches.**
- [ ] **Step 4: Enforce Codex escalation for explicit `codex/кодекс` markers and file/project-sensitive prompts.**
- [ ] **Step 5: Ensure Telegram-visible errors and helper texts are emitted only in Russian, without raw English stderr.**
- [ ] **Step 6: Re-run focused pytest until green.**

### Task 3: Add desktop application registry, discovery, launch, and assistant-owned process control

**Files:**
- Create: `server/app/models/app_catalog.py`
- Create: `server/app/services/app_catalog_store.py`
- Create: `server/app/api/apps.py`
- Create: `server/tests/test_app_catalog_api.py`
- Create: `desktop/src/main/appRegistryStore.ts`
- Create: `desktop/src/main/appRegistryStore.test.ts`
- Create: `desktop/src/main/assistantProcessStore.ts`
- Create: `desktop/src/main/assistantProcessStore.test.ts`
- Create: `desktop/src/main/appLauncher.ts`
- Create: `desktop/src/main/appLauncher.test.ts`
- Create: `desktop/src/main/siteLauncher.ts`
- Create: `desktop/src/main/siteLauncher.test.ts`
- Create: `desktop/src/main/errorNormalizer.ts`
- Create: `desktop/src/main/errorNormalizer.test.ts`
- Modify: `desktop/src/main/taskExecutor.ts`
- Modify: `desktop/src/main/taskExecutor.test.ts`
- Modify: `desktop/src/main/taskRuntime.ts`
- Modify: `desktop/src/main/taskRuntime.test.ts`
- Modify: `desktop/src/main/syncClient.ts`
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/main/activityLogStore.ts`
- Modify: `desktop/src/main/quickAccessRuntime.ts`
- Modify: `bot/app/task_client.py`

- [ ] **Step 1: Write failing main-process tests for app registry CRUD, alias normalization, discovery fallback, launch-app, open-site, kill-by-task, and refusal to kill non-assistant processes.**
- [ ] **Step 2: Write failing server and bot tests for app catalog sync/list endpoints and Telegram `/apps` consumption.**
- [ ] **Step 3: Run focused vitest/pytest for the new main-process and server tests and confirm failures.**
- [ ] **Step 4: Add a persistent app registry store with alias normalization and source metadata.**
- [ ] **Step 5: Add discovery over Desktop, Start Menu, `Program Files`, and `Program Files (x86)` for `.lnk` and `.exe`.**
- [ ] **Step 6: Add a server-side app catalog store plus desktop sync and bot fetch support.**
- [ ] **Step 7: Add launchers for sites and apps, plus an assistant-owned process registry that tracks only processes Karpik started.**
- [ ] **Step 8: Extend task execution to support `open-site`, `launch-app`, and `kill-app` with Russian humanized errors.**
- [ ] **Step 9: Add IPC methods for app registry CRUD and assistant process views/actions.**
- [ ] **Step 10: Re-run focused vitest/pytest until green.**

### Task 4: Replace local chat thin task wrapper with conversational desktop routing

**Files:**
- Create: `desktop/src/main/deepseekClient.ts`
- Create: `desktop/src/main/deepseekClient.test.ts`
- Create: `desktop/src/main/assistantRouter.ts`
- Create: `desktop/src/main/assistantRouter.test.ts`
- Modify: `desktop/src/main/localIntentResolver.ts`
- Modify: `desktop/src/main/localChatRuntime.ts`
- Modify: `desktop/src/main/localChatRuntime.test.ts`
- Modify: `desktop/src/main/quickAccessRuntime.ts`
- Modify: `desktop/src/main/main.ts`

- [ ] **Step 1: Write failing tests showing local chat and quick popup no longer return `Unsupported task intent.` for conversational prompts.**
- [ ] **Step 2: Run focused vitest for local chat/runtime/router tests and confirm failures.**
- [ ] **Step 3: Introduce a shared desktop assistant router with the same routing policy as Telegram: pending-state, deterministic capability, DeepSeek fallback, Codex escalation.**
- [ ] **Step 4: Keep DeepSeek answers in local chat history as normal assistant messages, not as a separate model layer.**
- [ ] **Step 5: Route file/project-sensitive local prompts to Codex and conversational prompts to DeepSeek.**
- [ ] **Step 6: Re-run focused vitest until green.**

### Task 5: Add desktop Applications page and refactor main window into a polished chat-first console

**Files:**
- Modify: `desktop/src/renderer/App.tsx`
- Modify: `desktop/src/renderer/App.test.tsx`
- Modify: `desktop/src/renderer/layout/Sidebar.tsx`
- Create: `desktop/src/renderer/pages/ApplicationsPage.tsx`
- Modify: `desktop/src/renderer/pages/ChatsPage.tsx`
- Modify: `desktop/src/renderer/pages/TelegramChatsPage.tsx`
- Modify: `desktop/src/renderer/pages/BlockedTasksPage.tsx`
- Modify: `desktop/src/renderer/pages/ServicesPage.tsx`
- Modify: `desktop/src/renderer/window.d.ts`
- Modify: `desktop/src/preload/index.ts`
- Modify: `desktop/src/renderer/styles.css`

- [ ] **Step 1: Write failing renderer tests for a new `Приложения` section, messenger-style chat bubbles, working main-window scroll, and Russian labels on touched surfaces.**
- [ ] **Step 2: Run focused vitest for `desktop/src/renderer/App.test.tsx` and confirm failures.**
- [ ] **Step 3: Add the `Приложения` page with linked apps, aliases, launch path, and CRUD actions.**
- [ ] **Step 4: Refactor `Чаты` into a proper messenger layout with user bubbles on the right, assistant bubbles on the left, and a compact chat sidebar.**
- [ ] **Step 5: Align `Чаты Telegram`, `Невыполненное`, and `Сервисы` to the same minimal operator visual language.**
- [ ] **Step 6: Restore normal scroll behavior for the main window without reintroducing popup scroll.**
- [ ] **Step 7: Re-run focused vitest until green.**

### Task 6: Rebuild quick popup into a true tray-adjacent compact widget

**Files:**
- Modify: `desktop/src/main/windows.ts`
- Modify: `desktop/src/main/windows.test.ts`
- Modify: `desktop/src/main/tray.ts`
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/renderer/App.tsx`
- Modify: `desktop/src/renderer/styles.css`
- Modify: `desktop/src/main/quickAccessRuntime.ts`

- [ ] **Step 1: Write failing tests for near-tray popup placement, blur-to-hide behavior, and compact no-scroll content.**
- [ ] **Step 2: Run focused vitest for `desktop/src/main/windows.test.ts` and popup-related renderer tests and confirm failures.**
- [ ] **Step 3: Tighten tray placement and hide-on-blur/outside-click behavior so the popup behaves like a tray widget, not a floating center window.**
- [ ] **Step 4: Reduce popup content to status, quick actions, compact recent activity, and quick input so it fits without scroll.**
- [ ] **Step 5: Re-run focused vitest until green.**

### Task 7: Final Russian copy cleanup, version bump, full verification, and release artifacts

**Files:**
- Modify: touched bot and desktop files with user-facing strings
- Modify: `desktop/package.json`
- Test: full existing suites

- [ ] **Step 1: Replace remaining raw English or mojibake strings in touched Telegram and GUI surfaces.**
- [ ] **Step 2: Bump desktop version for the new installer/feed.**
- [ ] **Step 3: Run full verification: `desktop npm run test`, `desktop npm run typecheck`, `server pytest`, `bot pytest`.**
- [ ] **Step 4: Build installer/update artifacts with `desktop npm run make`.**
- [ ] **Step 5: Commit coherent implementation slices and prepare remote deploy if verification is fully green.**
