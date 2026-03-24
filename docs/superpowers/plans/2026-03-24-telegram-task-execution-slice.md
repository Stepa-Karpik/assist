# Telegram Task Execution Slice Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn authenticated Telegram tasks into real desktop execution with persisted task status and retrievable results.

**Architecture:** Keep the server as the control plane for task state, status transitions, and chat/task lookup. The desktop remains the only executor: it polls queued tasks, atomically moves them to `running`, executes a small allowlisted task set locally, and posts `done|failed` results back to the server. The bot stays thin and command-driven, surfacing task ids and result/status lookups without gaining direct execution authority.

**Tech Stack:** Electron, React, TypeScript, Node `fs/path`, FastAPI, aiogram, pytest, vitest

---

### Task 1: Add Server Task Execution Lifecycle And Result APIs

**Files:**
- Modify: `server/app/models/task.py`
- Modify: `server/app/services/task_store.py`
- Modify: `server/app/api/tasks.py`
- Test: `server/tests/test_task_execution_api.py`

- [ ] **Step 1: Write the failing server execution tests**

Cover:
- queued task detail returns its Telegram metadata and empty result fields
- desktop can transition a queued task to `running`
- desktop can finish a running task with a result message
- desktop can fail a running task with an error message
- task list can return recent tasks for a device without dropping non-queued statuses
- chat/task lookup for the bot returns the latest task for a chat and task id

- [ ] **Step 2: Run the server execution tests to confirm failure**

Run: `pytest server/tests/test_task_execution_api.py -v`
Expected: FAIL because execution/result models and routes do not exist yet

- [ ] **Step 3: Extend the task model for lifecycle data**

Add fields for:
- `started_at`
- `finished_at`
- `result_text`
- `error_text`
- `attempt_count`

Keep the current status enum and reuse it for `queued -> running -> done|failed`.

- [ ] **Step 4: Extend the in-memory task store**

Add focused helpers for:
- listing all device tasks in reverse chronological order
- starting a queued task
- completing a running task
- failing a running task
- fetching the latest task for `(device_id, chat_id)`

- [ ] **Step 5: Extend the task API**

Implement:
- `GET /api/tasks?device_id=...&include_history=true`
- `GET /api/tasks/{task_id}`
- `POST /api/tasks/{task_id}/start`
- `POST /api/tasks/{task_id}/complete`
- `POST /api/tasks/{task_id}/fail`

Return task records with status/result fields so both desktop and bot can consume one model.

- [ ] **Step 6: Run the full server test suite**

Run: `pytest server/tests -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server
git commit -m "feat: add task execution api"
```

### Task 2: Add Desktop Task Executor And Task-State Polling

**Files:**
- Create: `desktop/src/main/taskExecutor.ts`
- Create: `desktop/src/main/taskExecutor.test.ts`
- Modify: `desktop/src/main/syncClient.ts`
- Modify: `desktop/src/main/syncClient.test.ts`
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/preload/index.ts`
- Modify: `desktop/src/renderer/window.d.ts`

- [ ] **Step 1: Write the failing desktop executor tests**

Cover:
- `status` intent returns a short desktop-online result
- `read <relative-path>` reads only from the runtime `docs/user/` subtree
- path traversal outside `docs/user/` fails with a clear error
- unsupported intents fail without crashing the poll loop
- sync client can fetch task history and report `start|complete|fail`

- [ ] **Step 2: Run the desktop tests to confirm failure**

Run: `npm run test`
Expected: FAIL because the executor and task sync methods do not exist yet

- [ ] **Step 3: Implement the minimal task executor**

Support exactly:
- `status`
- `read <relative-path>`

Behavior:
- normalize/validate paths against `runtimeFolders.userRoot`
- cap returned text to a short, Telegram-safe payload
- produce explicit failure text for unsupported or invalid intents

- [ ] **Step 4: Extend the desktop sync client**

Add methods for:
- fetching full task history for the current device
- starting a task
- completing a task
- failing a task

- [ ] **Step 5: Wire task polling into the main process**

At startup:
- keep a cached task snapshot for the renderer
- poll device task history on an interval
- start queued tasks one-by-one
- run them through `taskExecutor`
- post lifecycle updates back to the server

- [ ] **Step 6: Expose read-only task snapshot IPC**

Expose:
- `getTaskSnapshot`

Keep the renderer read-only in this slice; execution remains main-process-only.

- [ ] **Step 7: Run desktop tests and typecheck**

Run: `npm run test`
Expected: PASS

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add desktop
git commit -m "feat: add desktop task executor"
```

### Task 3: Add Bot Task Status Lookups And Result-Aware Replies

**Files:**
- Modify: `bot/app/task_client.py`
- Modify: `bot/app/handlers/task.py`
- Modify: `bot/app/main.py`
- Modify: `bot/tests/test_task_handler.py`

- [ ] **Step 1: Write the failing bot task-status tests**

Cover:
- `/task ...` queued reply includes the task id
- `/confirm` queued reply includes the task id after high-risk approval
- `/status <task_id>` returns `queued|running|done|failed`
- `/status` without id can return the latest task for the current chat
- done and failed statuses include result/error text
- ignored chats stay silent

- [ ] **Step 2: Run bot tests to confirm failure**

Run: `pytest bot/tests -v`
Expected: FAIL

- [ ] **Step 3: Extend the bot HTTP client**

Add thin methods for:
- fetching a task by id
- fetching the latest task for `(device_id, chat_id)`

- [ ] **Step 4: Extend bot command handling**

Support:
- task-id-aware success text from `/task` and `/confirm`
- `/status`
- `/status <task_id>`

Keep `/auth`, `/confirm`, `/decline`, and silent ignore behavior intact.

- [ ] **Step 5: Run bot tests**

Run: `pytest bot/tests -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add bot
git commit -m "feat: add telegram task status commands"
```

### Task 4: Surface Task State In Desktop UI

**Files:**
- Modify: `desktop/src/renderer/App.test.tsx`
- Modify: `desktop/src/renderer/pages/TelegramChatsPage.tsx`
- Modify: `desktop/src/renderer/pages/BlockedTasksPage.tsx`

- [ ] **Step 1: Write the failing renderer tests**

Cover:
- Telegram page shows recent Telegram tasks with status badges and result text
- blocked page shows `awaiting_auth|awaiting_local_approval|blocked|failed` items separately
- empty states remain readable when there are no tasks yet

- [ ] **Step 2: Run renderer tests to confirm failure**

Run: `npm run test -- App`
Expected: FAIL

- [ ] **Step 3: Render task state from the main-process snapshot**

Show:
- task id
- intent
- status
- result or error text when present

Do not add mutation controls in this slice.

- [ ] **Step 4: Run desktop tests again**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop
git commit -m "feat: show remote task state in desktop ui"
```

### Task 5: Verify The Execution Slice End To End

**Files:**
- No new files required

- [ ] **Step 1: Run the desktop tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 2: Run the desktop typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run the server tests**

Run: `pytest server/tests -v`
Expected: PASS

- [ ] **Step 4: Run the bot tests**

Run: `pytest bot/tests -v`
Expected: PASS

- [ ] **Step 5: Commit any final cleanups**

```bash
git add desktop server bot docs
git commit -m "test: verify telegram task execution slice"
```

Only make this commit if verification required final cleanup changes.
