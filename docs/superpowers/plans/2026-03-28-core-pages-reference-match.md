# Core Pages Reference Match Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `Главная`, `Чаты`, `Чаты Telegram`, and `Задачи` so they match the approved PNG references as closely as possible while preserving live data and existing desktop behavior.

**Architecture:** Keep the current desktop runtime and page data sources, but introduce a dedicated shared shell for the four target pages and rewrite their renderer structure where needed. The shell owns the exact sidebar, top bar, and glow/background treatment; each target page then gets its own reference-close DOM template over the same live state.

**Tech Stack:** Electron, React, TypeScript, Vitest, CSS

---

## File structure

### Shared shell files

- Create: `desktop/src/renderer/layout/CorePagesShell.tsx`
  - Shared shell for the four target pages
  - Owns top bar, background, outer content frame, and shared spacing
- Modify: `desktop/src/renderer/layout/Sidebar.tsx`
  - Make sidebar geometry and active-state visuals match the new references
- Modify: `desktop/src/renderer/App.tsx`
  - Route only the four target sections through the new `CorePagesShell`
  - Keep other pages on the compatible shell
- Modify: `desktop/src/renderer/styles.css`
  - Add shared tokens and reference-match shell styles

### Page files

- Modify: `desktop/src/renderer/pages/HomePage.tsx`
  - Remove extra summary/panel sections
  - Keep only hero/orb/composer composition from `Main.png`
- Modify: `desktop/src/renderer/pages/ChatsPage.tsx`
  - Convert page into a reference-close messenger layout
- Modify: `desktop/src/renderer/pages/TelegramChatsPage.tsx`
  - Convert page from admin-card layout into Telegram-thread layout
- Modify: `desktop/src/renderer/pages/BlockedTasksPage.tsx`
  - Convert page into left-filter/right-row-list layout matching `Tasks.png`

### Tests

- Create: `desktop/src/renderer/corePagesReference.test.tsx`
  - Focused tests for shell, four pages, and visual structure contracts
- Modify: `desktop/src/renderer/App.test.tsx`
  - Keep existing navigation and behavior tests aligned with the new shell and page DOM

### Reference sources

- Read only:
  - `C:\Users\TBG\Desktop\new_design\Main.png`
  - `C:\Users\TBG\Desktop\new_design\Chats.png`
  - `C:\Users\TBG\Desktop\new_design\Telegram chats.png`
  - `C:\Users\TBG\Desktop\new_design\Tasks.png`

---

### Task 1: Build the shared reference shell

**Files:**
- Create: `desktop/src/renderer/layout/CorePagesShell.tsx`
- Modify: `desktop/src/renderer/layout/Sidebar.tsx`
- Modify: `desktop/src/renderer/App.tsx`
- Modify: `desktop/src/renderer/styles.css`
- Create: `desktop/src/renderer/corePagesReference.test.tsx`

- [ ] **Step 1: Write failing renderer tests for the shared shell**

Add focused tests that assert:
- the four target pages render inside one shared shell
- the top bar contains `Поиск`, `Задачи`, and `Новый чат`
- the sidebar remains icon-first and the active state is applied through the shared shell

- [ ] **Step 2: Run the focused shell test to confirm failure**

Run: `npm run test -- corePagesReference`
Expected: FAIL because `CorePagesShell` does not exist yet and the current layout does not satisfy the reference-shell contract.

- [ ] **Step 3: Implement the minimal shared shell**

Create `CorePagesShell.tsx` with:
- shell wrapper
- top-right action bar
- content slot
- reference-close background glow layers

Update `App.tsx` so:
- `home`
- `chats`
- `telegram`
- `blocked`
render through `CorePagesShell`

- [ ] **Step 4: Rework sidebar geometry and shell CSS**

Update:
- sidebar width
- icon spacing
- top/bottom pinning
- active indicator
- top bar sizing
- shared shell padding/border/glow

Do not yet perfect page internals here. Only shell.

- [ ] **Step 5: Re-run the focused shell test**

Run: `npm run test -- corePagesReference`
Expected: PASS for shell assertions.

- [ ] **Step 6: Commit the shell checkpoint**

```bash
git add desktop/src/renderer/layout/CorePagesShell.tsx desktop/src/renderer/layout/Sidebar.tsx desktop/src/renderer/App.tsx desktop/src/renderer/styles.css desktop/src/renderer/corePagesReference.test.tsx
git commit -m "feat: add core pages reference shell"
```

### Task 2: Rebuild `Главная` to match `Main.png`

**Files:**
- Modify: `desktop/src/renderer/pages/HomePage.tsx`
- Modify: `desktop/src/renderer/styles.css`
- Modify: `desktop/src/renderer/corePagesReference.test.tsx`

- [ ] **Step 1: Write failing tests for the home-page reference contract**

Add assertions that `Главная`:
- shows only the hero/orb/composer layout
- does not render the old summary grid
- does not render the old lower activity/task panels
- keeps `Новый чат` and hero composer behavior

- [ ] **Step 2: Run the focused home-page test and confirm failure**

Run: `npm run test -- corePagesReference`
Expected: FAIL because the current `HomePage.tsx` still renders the older extra sections.

- [ ] **Step 3: Rewrite `HomePage.tsx` around the reference composition**

Keep:
- owner greeting
- quick-request submit behavior
- create-chat behavior

Remove from the page:
- summary grid
- recent activity panel
- active tasks panel

Keep the page centered and visually sparse like `Main.png`.

- [ ] **Step 4: Tune home-specific CSS to reference parity**

Adjust:
- orb size and position
- title width and line breaks
- composer dimensions
- `Прикрепить` and submit button placement
- vertical spacing and glow

- [ ] **Step 5: Re-run the focused home-page test**

Run: `npm run test -- corePagesReference`
Expected: PASS for home assertions.

- [ ] **Step 6: Commit the home-page checkpoint**

```bash
git add desktop/src/renderer/pages/HomePage.tsx desktop/src/renderer/styles.css desktop/src/renderer/corePagesReference.test.tsx
git commit -m "feat: match home page to reference"
```

### Task 3: Rebuild `Чаты` to match `Chats.png`

**Files:**
- Modify: `desktop/src/renderer/pages/ChatsPage.tsx`
- Modify: `desktop/src/renderer/styles.css`
- Modify: `desktop/src/renderer/corePagesReference.test.tsx`
- Modify: `desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Write failing tests for the chats-page messenger geometry**

Add assertions that `Чаты`:
- renders a left list panel and right thread panel
- shows the active chat header above the list
- keeps the composer pinned inside the thread panel
- renders user bubbles on the right and assistant bubbles on the left

- [ ] **Step 2: Run the focused chats-page test and confirm failure**

Run: `npm run test -- corePagesReference App`
Expected: FAIL because the current DOM and spacing do not match the target structure.

- [ ] **Step 3: Rewrite the chat page DOM to match the reference**

Keep the current live data and actions, but restructure:
- left rail title/subtitle block
- inner list panel
- right thread panel
- bottom composer bar

- [ ] **Step 4: Add reference-close chat styling**

Tune:
- panel widths
- bubble radius and alignment
- timestamp placement
- selected item pill styling
- composer height, border, and submit button size

- [ ] **Step 5: Re-run focused chats tests**

Run: `npm run test -- corePagesReference App`
Expected: PASS for chat-structure assertions and existing behavior tests.

- [ ] **Step 6: Commit the chats checkpoint**

```bash
git add desktop/src/renderer/pages/ChatsPage.tsx desktop/src/renderer/styles.css desktop/src/renderer/corePagesReference.test.tsx desktop/src/renderer/App.test.tsx
git commit -m "feat: match chats page to reference"
```

### Task 4: Rebuild `Чаты Telegram` to match `Telegram chats.png`

**Files:**
- Modify: `desktop/src/renderer/pages/TelegramChatsPage.tsx`
- Modify: `desktop/src/renderer/styles.css`
- Modify: `desktop/src/renderer/corePagesReference.test.tsx`
- Modify: `desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Write failing tests for the Telegram-thread layout**

Add assertions that `Чаты Telegram`:
- uses the same left-list/right-thread composition as the reference
- no longer defaults to stacked admin cards
- keeps workspace binding and continuation controls in a compact header/meta zone

- [ ] **Step 2: Run the focused Telegram-page test and confirm failure**

Run: `npm run test -- corePagesReference App`
Expected: FAIL because the current page is still card-first.

- [ ] **Step 3: Rewrite `TelegramChatsPage.tsx` into a thread-style surface**

Convert the right side into:
- conversation/timeline body
- compact meta/header controls
- inline task artifacts

Preserve:
- workspace binding
- continuation
- cancel actions
- real task history data

- [ ] **Step 4: Add Telegram-page CSS to match the reference**

Tune:
- list spacing
- active thread item state
- right panel proportions
- inline message/task bubble treatment
- compact meta zone styling

- [ ] **Step 5: Re-run focused Telegram-page tests**

Run: `npm run test -- corePagesReference App`
Expected: PASS for Telegram-page layout and retained actions.

- [ ] **Step 6: Commit the Telegram-page checkpoint**

```bash
git add desktop/src/renderer/pages/TelegramChatsPage.tsx desktop/src/renderer/styles.css desktop/src/renderer/corePagesReference.test.tsx desktop/src/renderer/App.test.tsx
git commit -m "feat: match telegram chats page to reference"
```

### Task 5: Rebuild `Задачи` to match `Tasks.png`

**Files:**
- Modify: `desktop/src/renderer/pages/BlockedTasksPage.tsx`
- Modify: `desktop/src/renderer/styles.css`
- Modify: `desktop/src/renderer/corePagesReference.test.tsx`
- Modify: `desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Write failing tests for the tasks-page row layout**

Add assertions that `Задачи`:
- renders left-side filters
- defaults to compact rows on the right
- keeps status aligned to the right side of the row
- hides action controls until a row is expanded/selected

- [ ] **Step 2: Run the focused tasks-page test and confirm failure**

Run: `npm run test -- corePagesReference App`
Expected: FAIL because the current page still renders heavy task cards and always-visible actions.

- [ ] **Step 3: Rewrite `BlockedTasksPage.tsx` into filter-plus-row layout**

Keep:
- real task state
- approval/reject/retry/cancel behavior

Change:
- left filter rail
- compact right-side rows
- expandable detail region per row for actions and previews

- [ ] **Step 4: Add tasks-page CSS to match `Tasks.png`**

Tune:
- filter pill widths
- row height and spacing
- status color placement
- expanded detail styling
- scroll behavior inside the right panel only

- [ ] **Step 5: Re-run focused tasks-page tests**

Run: `npm run test -- corePagesReference App`
Expected: PASS for tasks-page structure and retained actions.

- [ ] **Step 6: Commit the tasks checkpoint**

```bash
git add desktop/src/renderer/pages/BlockedTasksPage.tsx desktop/src/renderer/styles.css desktop/src/renderer/corePagesReference.test.tsx desktop/src/renderer/App.test.tsx
git commit -m "feat: match tasks page to reference"
```

### Task 6: Regression sweep and packaging

**Files:**
- Modify: touched files only if regressions are found
- Test: desktop renderer and packaging commands

- [ ] **Step 1: Normalize affected Russian strings and remove any mojibake that surfaces during the rebuild**

Check touched shell/page files and tests for broken literals before the final sweep.

- [ ] **Step 2: Run the focused reference-layout suite**

Run: `npm run test -- corePagesReference`
Expected: PASS

- [ ] **Step 3: Run the full desktop test suite**

Run: `npm run test`
Expected: PASS with zero failing tests

- [ ] **Step 4: Run desktop typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Build the desktop installer**

Run: `npm run make`
Expected: PASS and artifacts under `desktop/out/make`

- [ ] **Step 6: Commit the final integration sweep**

```bash
git add desktop/src/renderer/App.tsx desktop/src/renderer/App.test.tsx desktop/src/renderer/corePagesReference.test.tsx desktop/src/renderer/layout/CorePagesShell.tsx desktop/src/renderer/layout/Sidebar.tsx desktop/src/renderer/pages/HomePage.tsx desktop/src/renderer/pages/ChatsPage.tsx desktop/src/renderer/pages/TelegramChatsPage.tsx desktop/src/renderer/pages/BlockedTasksPage.tsx desktop/src/renderer/styles.css
git commit -m "feat: align core pages to approved references"
```
