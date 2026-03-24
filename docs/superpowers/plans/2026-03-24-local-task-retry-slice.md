# 2026-03-24 Local Task Retry Slice

1. Add RED coverage for retry in:
   - `server/tests/test_task_execution_api.py`
   - `desktop/src/main/syncClient.test.ts`
   - `desktop/src/renderer/App.test.tsx`
2. Implement `retry_task` in the server task store and expose `/api/tasks/{task_id}/retry`.
3. Add `retryTask` to the desktop sync client, IPC main handler, preload bridge, and renderer typings.
4. Add a `Retry` action to retryable items in `BlockedTasksPage`.
5. Verify with:
   - `server`: `pytest tests -q`
   - `desktop`: `npm run test`
   - `desktop`: `npm run typecheck`
   - `desktop`: `npm run package`
