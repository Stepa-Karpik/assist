# Screenshot Delivery Implementation Plan

> **Goal:** ship the first non-text Telegram task result by adding a `screenshot` capability with image delivery.

## Task 1: Add RED tests

Files:
- `desktop/src/main/taskExecutor.test.ts`
- `server/tests/test_task_policy.py`
- `server/tests/test_task_delivery_api.py`
- `bot/tests/test_delivery.py`

- [ ] Replace the current screenshot unsupported-path test with a screenshot success test in desktop.
- [ ] Add policy coverage showing screenshot escalates to `high`.
- [ ] Add delivery API coverage showing artifact fields survive task completion.
- [ ] Add bot delivery coverage showing image events use photo delivery.
- [ ] Run focused RED tests and confirm they fail for the intended reasons.

## Task 2: Add artifact-aware task models and server flow

Files:
- `server/app/models/task.py`
- `server/app/models/delivery.py`
- `server/app/services/task_store.py`
- `server/app/services/delivery_store.py`
- `server/app/api/tasks.py`
- `server/app/services/task_policy.py`

- [ ] Add optional artifact fields to task and delivery models.
- [ ] Accept optional artifact payload on task completion.
- [ ] Persist artifact fields through task store and delivery outbox.
- [ ] Escalate `screenshot` to `high`.

## Task 3: Add desktop screenshot execution

Files:
- `desktop/src/main/taskExecutor.ts`
- `desktop/src/main/screenshotCapture.ts`

- [ ] Add a small screenshot capture helper for Electron main.
- [ ] Teach the task executor to return PNG artifact payloads for `screenshot`.
- [ ] Keep the executor injectable for tests.

## Task 4: Add bot artifact delivery

Files:
- `bot/app/delivery_client.py`
- `bot/app/delivery.py`
- `bot/app/main.py`

- [ ] Parse artifact fields from delivery events.
- [ ] Route image events through `send_photo`.
- [ ] Keep text-only delivery unchanged.

## Task 5: Verify and package

- [ ] Run focused tests for the new slice.
- [ ] Run full desktop tests.
- [ ] Run desktop typecheck.
- [ ] Run desktop package.
- [ ] Run full server tests.
- [ ] Run full bot tests.
