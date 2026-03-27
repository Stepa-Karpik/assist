# Task Policy And Safe File Ops Slice Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent low-risk bypasses by classifying remote task intents on the server and add useful safe file operations to the desktop executor.

**Architecture:** Keep risk enforcement on the server. Before auth gating, classify the task intent into a minimum-risk bucket and use the escalated risk for challenge flow. Keep execution on the desktop in a small allowlist: `status`, `read`, `list`, and `write-note`.

**Tech Stack:** FastAPI, Electron, TypeScript, Node `fs/path`, pytest, vitest

---

### Task 1: Add Server Intent Classification And Risk Escalation

**Files:**
- Create: `server/app/services/task_policy.py`
- Modify: `server/app/api/tasks.py`
- Test: `server/tests/test_task_policy.py`

- [ ] **Step 1: Write the failing server policy tests**

Cover:
- `status` keeps `low`
- `read docs/file.txt` keeps `low`
- `write-note daily.txt :: hello` escalates `low -> medium`
- unknown intent escalates `low -> high`
- escalated risk still flows through existing auth setup and challenge rules

- [ ] **Step 2: Run the new server tests to confirm failure**

Run: `pytest server/tests/test_task_policy.py -v`
Expected: FAIL because classification does not exist yet

- [ ] **Step 3: Implement task intent policy**

Return:
- normalized minimum risk
- existing trimmed intent string

Use the escalated risk everywhere in `POST /api/tasks`.

- [ ] **Step 4: Run the full server suite**

Run: `pytest server/tests -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server
git commit -m "feat: add task risk policy"
```

### Task 2: Add `list` And `write-note` To The Desktop Executor

**Files:**
- Modify: `desktop/src/main/taskExecutor.ts`
- Modify: `desktop/src/main/taskExecutor.test.ts`

- [ ] **Step 1: Write the failing desktop executor tests**

Cover:
- `list docs` returns file names from the runtime subtree
- `write-note daily.txt :: hello` writes under `docs/user/docs/notes`
- path traversal in note name is rejected

- [ ] **Step 2: Run desktop tests to confirm failure**

Run: `npm run test`
Expected: FAIL because these intents are not implemented yet

- [ ] **Step 3: Implement `list`**

Rules:
- allow only paths under `docs/user`
- return a short newline-delimited listing

- [ ] **Step 4: Implement `write-note`**

Rules:
- target folder is `docs/user/docs/notes`
- accept a basename-like filename only
- write UTF-8 text
- return the final relative note path

- [ ] **Step 5: Run desktop tests and typecheck**

Run: `npm run test`
Expected: PASS

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add desktop
git commit -m "feat: add safe file task capabilities"
```

### Task 3: Verify And Push

**Files:**
- No new files required

- [ ] **Step 1: Run desktop tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 2: Run desktop typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run server tests**

Run: `pytest server/tests -v`
Expected: PASS

- [ ] **Step 4: Run bot tests**

Run: `pytest bot/tests -v`
Expected: PASS

- [ ] **Step 5: Push the branch**

```bash
git push -u origin task-6-bot-bootstrap
```
