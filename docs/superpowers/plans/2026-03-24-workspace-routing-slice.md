# Workspace Routing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the desktop manage multiple named `codex` workspaces and route Telegram `codex` tasks by local chat binding.

**Architecture:** Keep workspace knowledge entirely local. Extend the desktop codex settings store into a workspace registry plus chat bindings, then use that state in the executor and expose it through the existing settings and Telegram chat pages.

**Tech Stack:** Electron, React, TypeScript, Vitest

---

### Task 1: Extend the local codex settings model

**Files:**
- Modify: `desktop/src/main/codexSettingsStore.ts`
- Modify: `desktop/src/main/codexSettingsStore.test.ts`
- Modify: `desktop/src/renderer/window.d.ts`
- Modify: `desktop/src/preload/index.ts`

- [ ] Step 1: Write failing tests for config migration, multiple workspaces, default fallback, and binding cleanup.
- [ ] Step 2: Run the focused codex settings tests and verify they fail for the current single-path model.
- [ ] Step 3: Implement the minimal workspace registry and chat binding model.
- [ ] Step 4: Expose the richer state and binding save action through preload/window typings.
- [ ] Step 5: Re-run the focused tests until green.
- [ ] Step 6: Commit `feat: add codex workspace registry`

### Task 2: Route codex tasks by workspace binding

**Files:**
- Modify: `desktop/src/main/taskExecutor.ts`
- Modify: `desktop/src/main/taskExecutor.test.ts`
- Modify: `desktop/src/main/main.ts`

- [ ] Step 1: Write failing executor tests for Telegram chat binding resolution and default fallback.
- [ ] Step 2: Run the focused executor tests and verify they fail for the current single-root routing.
- [ ] Step 3: Implement the minimal workspace resolver and wire it into both `codex` and `codex-write`.
- [ ] Step 4: Re-run the focused executor tests until green.
- [ ] Step 5: Commit `feat: route codex tasks by workspace`

### Task 3: Add workspace management UI in settings

**Files:**
- Modify: `desktop/src/renderer/pages/SettingsPage.tsx`
- Modify: `desktop/src/renderer/App.test.tsx`

- [ ] Step 1: Write failing UI tests for listing, editing, adding, and saving named workspaces.
- [ ] Step 2: Run the focused UI tests and verify they fail for missing workspace registry controls.
- [ ] Step 3: Implement the minimal settings editor for workspaces and default selection.
- [ ] Step 4: Re-run the focused UI tests until green.
- [ ] Step 5: Commit `feat: add workspace settings ui`

### Task 4: Add Telegram chat binding UI

**Files:**
- Modify: `desktop/src/renderer/pages/TelegramChatsPage.tsx`
- Modify: `desktop/src/renderer/App.test.tsx`
- Modify: `desktop/src/main/main.ts`

- [ ] Step 1: Write failing UI tests for showing chat bindings and saving a workspace selection for a Telegram chat.
- [ ] Step 2: Run the focused UI tests and verify they fail for missing chat binding controls.
- [ ] Step 3: Implement the minimal chat grouping and binding save flow.
- [ ] Step 4: Re-run the focused tests until green.
- [ ] Step 5: Commit `feat: add telegram workspace bindings`

### Task 5: Full regression and packaging

**Files:**
- No code changes expected unless regression fixes are needed.

- [ ] Step 1: Run `desktop` tests.
- [ ] Step 2: Run `desktop` typecheck.
- [ ] Step 3: Run `desktop` package.
- [ ] Step 4: Run `server` tests.
- [ ] Step 5: Run `bot` tests.
- [ ] Step 6: Commit regression fixes if needed.
