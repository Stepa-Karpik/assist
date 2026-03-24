# Knowledge Browser Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `Knowledge / Review` into a real desktop knowledge browser over the local runtime folders.

**Architecture:** Add a focused main-side `knowledgeStore` with safe section roots and expose it through small IPC methods. Keep the renderer simple: list entries by section and preview one selected text file.

**Tech Stack:** Electron, React, TypeScript, Node `fs/path`, Vitest

---

### Task 1: Add safe knowledge browser store

**Files:**
- Create: `desktop/src/main/knowledgeStore.ts`
- Create: `desktop/src/main/knowledgeStore.test.ts`

- [ ] Step 1: Write failing tests for section listing, file reading, and traversal rejection.
- [ ] Step 2: Run the focused store tests and verify they fail.
- [ ] Step 3: Implement the minimal safe knowledge store.
- [ ] Step 4: Re-run the focused store tests until green.
- [ ] Step 5: Commit `feat: add knowledge browser store`

### Task 2: Expose knowledge APIs through main and preload

**Files:**
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/preload/index.ts`
- Modify: `desktop/src/renderer/window.d.ts`

- [ ] Step 1: Add IPC handlers for listing knowledge sections and reading entries.
- [ ] Step 2: Keep the payload text-only and desktop-local.
- [ ] Step 3: Commit `feat: expose knowledge browser ipc`

### Task 3: Upgrade `Knowledge / Review` page

**Files:**
- Modify: `desktop/src/renderer/pages/KnowledgePage.tsx`
- Modify: `desktop/src/renderer/App.test.tsx`
- Modify: `desktop/src/renderer/styles.css`

- [ ] Step 1: Write failing renderer tests for file list and preview switching.
- [ ] Step 2: Run the focused app tests and verify they fail.
- [ ] Step 3: Implement the knowledge browser UI.
- [ ] Step 4: Re-run the focused tests until green.
- [ ] Step 5: Commit `feat: add knowledge browser ui`

### Task 4: Full regression and packaging

**Files:**
- No code changes expected unless regression fixes are needed.

- [ ] Step 1: Run `desktop` tests.
- [ ] Step 2: Run `desktop` typecheck.
- [ ] Step 3: Run `desktop` package.
- [ ] Step 4: Run `server` tests.
- [ ] Step 5: Run `bot` tests.
- [ ] Step 6: Commit regression fixes if needed.
