# Core Pages Reference Match Design

Date: 2026-03-28
Status: Draft for implementation

## Goal

Bring four desktop pages to near pixel-close parity with the new approved reference images in `C:\Users\TBG\Desktop\new_design\`:

- `Main.png`
- `Chats.png`
- `Telegram chats.png`
- `Tasks.png`

This work is intentionally narrower than the earlier shell redesign. The objective is not "same style"; it is "same composition, spacing, and hierarchy" for these four screens while preserving live app behavior and real data.

## Scope

In scope:

- `Главная`
- `Чаты`
- `Чаты Telegram`
- `Задачи`
- shared shell used by those four pages:
  - left icon sidebar
  - top action bar
  - base background, glow, borders, radii

Out of scope:

- redesigning the remaining pages to reference-exact parity
- changing runtime APIs or server behavior
- changing the business logic for chat execution, Telegram sync, approvals, retries, or task lifecycle

## Source of truth

Visual reference assets:

- `C:\Users\TBG\Desktop\new_design\Main.png`
- `C:\Users\TBG\Desktop\new_design\Chats.png`
- `C:\Users\TBG\Desktop\new_design\Telegram chats.png`
- `C:\Users\TBG\Desktop\new_design\Tasks.png`
- existing logo asset in `C:\Users\TBG\Desktop\new_design\design-logo.png`

Behavioral source of truth:

- existing renderer state, IPC, and runtime logic already used by the current desktop app

## Design constraints

1. Live data must remain real.
   - Chat lists, messages, Telegram task history, task states, approvals, and actions must continue to use actual application data.

2. Visual parity takes precedence over reuse of current DOM.
   - If current DOM structure prevents a close match, the page structure should be rewritten.

3. Only these four pages need pixel-close treatment in this slice.
   - Other pages may continue to use the compatible redesign shell, but they are not part of this exact-match target.

4. The shared shell must be visually identical across these four screens.
   - Same sidebar width
   - same top bar geometry
   - same glow/background treatment
   - same action-button sizes

## Shared shell

### Sidebar

The left sidebar should match the reference structure:

- small glowing logo at the top
- vertical icon stack in the middle
- two icons pinned near the bottom
- very narrow width
- minimal labels; icons are primary
- active section indicated by subtle blue-violet glow/accent, not by bulky pills

The sidebar for the four target pages is the same shell, not four separate implementations.

### Top action bar

The top-right bar is identical across all four pages:

- search field
- `Задачи` button
- `Новый чат` primary button

It should preserve the exact proportions and placement from the reference:

- no extra headings in the top bar
- no additional action clutter
- right-aligned layout

### Background

The background for the four pages should be rebuilt around the approved reference:

- near-black base
- soft blue/purple central glow
- no extra cards below the fold on `Главная`
- subtle borders and glass effect on primary content panels

## Page mapping

### 1. Главная

The home page should visually match `Main.png` as closely as possible:

- centered orb/logo
- two-line hero heading
- large centered composer card
- `Прикрепить` button inside the composer on the left
- small submit button on the right

Behavior:

- search remains passive for now
- `Новый чат` creates a real local chat
- sending from the hero composer submits a real quick request and then routes the user to `Чаты`

Explicit non-goals for this page:

- no extra summary grid
- no extra lower activity/task sections
- no secondary cards below the hero block

### 2. Чаты

The chats page should visually match `Chats.png`:

- left list panel with local chats
- right large thread panel
- header above the list showing active chat title and subtitle
- assistant messages on the left
- user messages on the right
- timestamps inside message bubbles
- bottom composer fixed inside the thread panel

Behavior:

- live local chat list and selection remain real
- live message history remains real
- create/send actions remain real
- image artifacts remain inline in the thread

### 3. Чаты Telegram

The Telegram page should use the same composition as `Telegram chats.png`, not the current admin-card layout:

- left list panel with Telegram chat threads
- right thread panel rendered as a conversation/timeline surface
- top-left title/subtitle above the list
- active chat highlighted like the reference

Behavior:

- show normalized Telegram task history in a thread-like layout instead of only stacked task cards
- keep workspace binding and continuation actions, but move them into a compact meta/header zone so they do not visually break the reference
- inline artifacts remain supported
- cancel actions remain available where task state allows them

### 4. Задачи

The tasks page should match `Tasks.png`:

- left filter panel
  - `Все`
  - `Активные`
  - `Требуют внимания`
  - `Завершенные`
- right list of compact task rows
- each row shows:
  - `ID`
  - task label
  - intent summary
  - status aligned to the right

Behavior:

- list is built from real task data
- filters are client-side on current snapshot
- actions such as approve/reject/cancel/retry are hidden behind an expanded detail state per row so the default screen stays visually clean and close to the reference

## Data and behavior preservation

The redesign must preserve the following existing capabilities:

- local chat creation
- local chat message sending
- Telegram task rendering
- task cancellation
- local approval and rejection
- task retry where supported
- artifact rendering for images/files already exposed in the renderer

No server contract changes are required for this slice.

## Implementation approach

Recommended implementation strategy:

1. Rebuild the shared shell used by the four pages.
2. Rebuild `Главная` against `Main.png`.
3. Rebuild `Чаты` against `Chats.png`.
4. Rebuild `Чаты Telegram` against `Telegram chats.png`.
5. Rebuild `Задачи` against `Tasks.png`.
6. Keep all runtime logic and page data sources intact wherever possible.

This avoids duplicating shell code while still allowing each page to have its own reference-close DOM structure.

## Acceptance criteria

The slice is complete when all of the following are true:

1. `Главная`, `Чаты`, `Чаты Telegram`, and `Задачи` visibly match their corresponding PNG references in overall composition, spacing, hierarchy, and control placement.
2. These four pages share one visually consistent shell.
3. Existing live data and actions still work on these pages.
4. The `Чаты` page uses a real messenger layout.
5. The `Чаты Telegram` page no longer reads like an admin dashboard and instead uses a thread-style surface.
6. The `Задачи` page defaults to compact rows with clean filters on the left.
7. No mojibake remains on the affected surfaces.
8. Renderer tests, desktop tests, typecheck, and desktop packaging remain green.

## Verification

Required verification before completion:

- renderer tests for the affected pages and shell
- full desktop test suite
- desktop typecheck
- desktop packaging build

Optional visual spot-check:

- compare running app against the four PNG references side by side
