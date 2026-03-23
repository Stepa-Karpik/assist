# Karpik Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the `Karpik` monorepo with a production-shaped Electron desktop app, FastAPI server, aiogram bot, shared documentation/contracts, and the first safety-critical project skeleton.

**Architecture:** Use a split-repo layout with `desktop/`, `server/`, `bot/`, `infra/`, and `docs/`. The desktop app is the execution plane and must own local state, tray UX, and `codex` integration; the server and bot form the remote control plane for Telegram intake, queueing, policy, and delivery.

**Tech Stack:** Electron, React, TypeScript, Vite, FastAPI, PostgreSQL, aiogram, nginx

---

### Task 1: Create The Monorepo Skeleton

**Files:**
- Create: `.gitignore`
- Create: `README.md`
- Create: `desktop/README.md`
- Create: `server/README.md`
- Create: `bot/README.md`
- Create: `infra/README.md`
- Create: `docs/README.md`
- Create: `docs/superpowers/specs/2026-03-23-karpik-design.md`
- Create: `docs/superpowers/plans/2026-03-23-karpik-bootstrap.md`

- [ ] **Step 1: Add the root `.gitignore`**

Include ignores for:
- `desktop/node_modules/`
- `desktop/dist/`
- `desktop/out/`
- `desktop/.vite/`
- `server/.venv/`
- `bot/.venv/`
- `**/__pycache__/`
- `**/.pytest_cache/`
- `**/.env`
- `**/.env.*`
- `**/*.log`
- `desktop/release/`
- local runtime data folders if a dev points them into the repo

- [ ] **Step 2: Add a root `README.md`**

Document:
- what `Karpik` is
- which folders deploy where
- that desktop runtime data does not live inside the repo

- [ ] **Step 3: Add folder-level READMEs**

Each folder README should define:
- responsibility
- deploy target
- main entry points to be created next

- [ ] **Step 4: Verify the skeleton is visible**

Run: `Get-ChildItem -Recurse`
Expected: root folders and README files exist

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: initialize karpik monorepo skeleton"
```

### Task 2: Bootstrap The Electron Desktop Workspace

**Files:**
- Create: `desktop/package.json`
- Create: `desktop/tsconfig.json`
- Create: `desktop/tsconfig.node.json`
- Create: `desktop/vite.config.ts`
- Create: `desktop/electron.vite.config.ts`
- Create: `desktop/index.html`
- Create: `desktop/src/main/main.ts`
- Create: `desktop/src/main/tray.ts`
- Create: `desktop/src/main/windows.ts`
- Create: `desktop/src/main/dataRoot.ts`
- Create: `desktop/src/preload/index.ts`
- Create: `desktop/src/renderer/main.tsx`
- Create: `desktop/src/renderer/App.tsx`
- Create: `desktop/src/renderer/styles.css`
- Test: `desktop/src/main/dataRoot.test.ts`

- [ ] **Step 1: Write a failing test for desktop data-root resolution**

```ts
import { describe, expect, it } from "vitest";
import { getDataRoot } from "./dataRoot";

describe("getDataRoot", () => {
  it("builds the Karpik runtime path", () => {
    expect(getDataRoot("C:\\Users\\TBG\\AppData\\Roaming")).toContain("Karpik");
  });
});
```

- [ ] **Step 2: Run the test to confirm failure**

Run: `npm run test -- dataRoot`
Expected: fail because test tooling or module does not exist yet

- [ ] **Step 3: Create the Electron desktop scaffold**

Implement:
- Electron main process
- preload bridge
- React renderer entry
- Vite-based build config

- [ ] **Step 4: Implement `getDataRoot()` minimally**

Return a path rooted at `%APPDATA%\Karpik`.

- [ ] **Step 5: Run the test again**

Run: `npm run test -- dataRoot`
Expected: PASS

- [ ] **Step 6: Add the first window shell**

Implement:
- main window creation
- tray icon bootstrap
- quick popup placeholder window

- [ ] **Step 7: Commit**

```bash
git add desktop
git commit -m "feat: bootstrap electron desktop shell"
```

### Task 3: Add Desktop Navigation And Placeholder Screens

**Files:**
- Modify: `desktop/src/renderer/App.tsx`
- Create: `desktop/src/renderer/layout/Sidebar.tsx`
- Create: `desktop/src/renderer/pages/ChatsPage.tsx`
- Create: `desktop/src/renderer/pages/TelegramChatsPage.tsx`
- Create: `desktop/src/renderer/pages/BlockedTasksPage.tsx`
- Create: `desktop/src/renderer/pages/KnowledgePage.tsx`
- Create: `desktop/src/renderer/pages/LogsPage.tsx`
- Create: `desktop/src/renderer/pages/ServicesPage.tsx`
- Create: `desktop/src/renderer/pages/SettingsPage.tsx`
- Test: `desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Write a failing renderer test for required navigation labels**

```tsx
import { render, screen } from "@testing-library/react";
import App from "./App";

it("renders all primary sections", () => {
  render(<App />);
  expect(screen.getByText("Чаты")).toBeInTheDocument();
  expect(screen.getByText("Чаты Telegram")).toBeInTheDocument();
  expect(screen.getByText("Невыполненное")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the renderer test to confirm failure**

Run: `npm run test -- App`
Expected: FAIL

- [ ] **Step 3: Create the sidebar and placeholder pages**

Each page should render:
- section title
- one short explanatory paragraph
- room for future stateful content

- [ ] **Step 4: Wire the sidebar into `App.tsx`**

Keep state minimal:
- selected section in local state
- render active page

- [ ] **Step 5: Run the renderer test again**

Run: `npm run test -- App`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add desktop
git commit -m "feat: add initial karpik desktop navigation"
```

### Task 4: Add Desktop Runtime Storage Bootstrap

**Files:**
- Modify: `desktop/src/main/dataRoot.ts`
- Create: `desktop/src/main/bootstrapFolders.ts`
- Create: `desktop/src/main/bootstrapFolders.test.ts`

- [ ] **Step 1: Write a failing test for required runtime folders**

The test should assert the bootstrap function creates folder names for:
- `docs/user/master_info`
- `docs/user/knowledge`
- `docs/user/logs`
- `docs/user/services`
- `docs/user/websites`
- `docs/user/docs`
- protected secrets storage

- [ ] **Step 2: Run the test and confirm failure**

Run: `npm run test -- bootstrapFolders`
Expected: FAIL

- [ ] **Step 3: Implement the bootstrap folder map**

Keep the function pure first:
- input: data root path
- output: required folder paths

- [ ] **Step 4: Add filesystem creation wrapper**

Create folders on app startup before the first window is shown.

- [ ] **Step 5: Run the test again**

Run: `npm run test -- bootstrapFolders`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add desktop
git commit -m "feat: bootstrap karpik runtime folders"
```

### Task 5: Bootstrap The FastAPI Server

**Files:**
- Create: `server/pyproject.toml`
- Create: `server/app/__init__.py`
- Create: `server/app/main.py`
- Create: `server/app/config.py`
- Create: `server/app/api/__init__.py`
- Create: `server/app/api/health.py`
- Create: `server/app/api/device.py`
- Create: `server/app/api/tasks.py`
- Create: `server/tests/test_health.py`
- Create: `server/tests/test_device_online.py`

- [ ] **Step 1: Write a failing health test**

```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
```

- [ ] **Step 2: Run the test to confirm failure**

Run: `pytest server/tests/test_health.py -v`
Expected: FAIL

- [ ] **Step 3: Create the FastAPI app skeleton**

Include:
- app factory or module-level app
- router registration
- config placeholder

- [ ] **Step 4: Add `/health` and minimal device online endpoint**

The device endpoint should accept a placeholder device identifier and return a
basic ack.

- [ ] **Step 5: Run the server tests**

Run: `pytest server/tests -v`
Expected: PASS for current tests

- [ ] **Step 6: Commit**

```bash
git add server
git commit -m "feat: bootstrap fastapi control plane"
```

### Task 6: Bootstrap The Telegram Bot

**Files:**
- Create: `bot/pyproject.toml`
- Create: `bot/app/__init__.py`
- Create: `bot/app/main.py`
- Create: `bot/app/config.py`
- Create: `bot/app/handlers/start.py`
- Create: `bot/app/handlers/pair.py`
- Create: `bot/app/handlers/messages.py`
- Create: `bot/tests/test_pair_parser.py`

- [ ] **Step 1: Write a failing parser test for `/pair`**

```python
from app.handlers.pair import parse_pair_command

def test_parse_pair_command():
    assert parse_pair_command("/pair 123456") == "123456"
```

- [ ] **Step 2: Run the bot test to confirm failure**

Run: `pytest bot/tests/test_pair_parser.py -v`
Expected: FAIL

- [ ] **Step 3: Create the aiogram app skeleton**

Add:
- dispatcher
- startup entry
- handlers package

- [ ] **Step 4: Implement `/start` and `/pair` placeholders**

`/start` should return a basic greeting.
`/pair` should validate and extract a candidate code.

- [ ] **Step 5: Run the bot tests**

Run: `pytest bot/tests -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add bot
git commit -m "feat: bootstrap aiogram bot skeleton"
```

### Task 7: Define Shared Contracts And State Models

**Files:**
- Create: `docs/contracts/task.md`
- Create: `docs/contracts/challenge.md`
- Create: `docs/contracts/device-session.md`
- Create: `docs/contracts/chat-model.md`

- [ ] **Step 1: Write `task.md`**

Define:
- `task_id`
- `conversation_id`
- `task_group_id`
- `intent`
- `type`
- `target`
- `scope`
- `constraints`
- `risk`
- `required_auth`
- `status`

- [ ] **Step 2: Write `challenge.md`**

Define:
- password step
- TOTP step
- expiry
- trust window
- lockout behavior

- [ ] **Step 3: Write `device-session.md`**

Define:
- online/offline
- queue pull
- heartbeat
- reconnection semantics

- [ ] **Step 4: Write `chat-model.md`**

Define:
- desktop chat
- Telegram chat
- local continuation chat
- `Ссылается на ...` rule

- [ ] **Step 5: Commit**

```bash
git add docs/contracts
git commit -m "docs: define shared contracts for karpik"
```

### Task 8: Add The First Server-Side Task Queue Skeleton

**Files:**
- Modify: `server/app/api/tasks.py`
- Create: `server/app/services/task_store.py`
- Create: `server/app/models/task.py`
- Create: `server/tests/test_task_queue.py`

- [ ] **Step 1: Write a failing task queue test**

The test should create a task and assert the server returns a queued status.

- [ ] **Step 2: Run the test to confirm failure**

Run: `pytest server/tests/test_task_queue.py -v`
Expected: FAIL

- [ ] **Step 3: Implement an in-memory task store first**

Do not add PostgreSQL yet in this task.
Keep it minimal and testable.

- [ ] **Step 4: Add task creation and listing endpoints**

Support:
- create task
- list queued tasks for a device

- [ ] **Step 5: Run tests**

Run: `pytest server/tests -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server
git commit -m "feat: add initial task queue api"
```

### Task 9: Add The First Desktop-Server Sync Flow

**Files:**
- Create: `desktop/src/main/syncClient.ts`
- Create: `desktop/src/main/syncClient.test.ts`
- Modify: `desktop/src/main/main.ts`

- [ ] **Step 1: Write a failing sync client test**

The test should verify that the client can describe:
- online event payload
- queue poll payload

- [ ] **Step 2: Run the test to confirm failure**

Run: `npm run test -- syncClient`
Expected: FAIL

- [ ] **Step 3: Implement a minimal HTTP sync client**

Support:
- announce online
- fetch queued tasks

- [ ] **Step 4: Call it from startup**

On app boot:
- create data folders
- start windows/tray
- announce online

- [ ] **Step 5: Run desktop tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add desktop
git commit -m "feat: add initial desktop sync client"
```

### Task 10: Add Installer, Packaging, And Runbooks

**Files:**
- Modify: `desktop/package.json`
- Create: `desktop/build/`
- Create: `docs/runbooks/local-dev.md`
- Create: `docs/runbooks/server-deploy.md`
- Create: `docs/runbooks/desktop-install.md`

- [ ] **Step 1: Add Windows packaging config**

Pick one packaging path and wire it fully:
- Electron Forge makers or
- electron-builder

Keep the choice explicit in `desktop/package.json`.

- [ ] **Step 2: Add installer-facing app metadata**

Include:
- app name `Karpik`
- Windows artifact naming
- placeholder icons/assets

- [ ] **Step 3: Write runbooks**

Document:
- desktop local dev
- server deploy path
- how the installed app connects to the server

- [ ] **Step 4: Verify packaging command exists**

Run: `npm run package`
Expected: command starts successfully, even if signing is not configured yet

- [ ] **Step 5: Commit**

```bash
git add desktop docs
git commit -m "chore: add packaging config and runbooks"
```

### Task 11: Add CI And Smoke Validation

**Files:**
- Create: `.github/workflows/desktop.yml`
- Create: `.github/workflows/server.yml`
- Create: `.github/workflows/bot.yml`

- [ ] **Step 1: Add desktop CI**

Run:
- install deps
- typecheck
- test

- [ ] **Step 2: Add server CI**

Run:
- dependency install
- pytest

- [ ] **Step 3: Add bot CI**

Run:
- dependency install
- pytest

- [ ] **Step 4: Commit**

```bash
git add .github
git commit -m "ci: add initial validation workflows"
```

## Notes For Execution

- keep desktop runtime data outside the repo
- do not commit secrets
- prefer typed tasks over raw direct command execution
- keep GUI and Telegram control flows separate
- treat `Невыполненное` as a first-class workflow, not an error bucket

## Open Assumptions Locked For This Plan

- desktop runtime data root is `%APPDATA%\Karpik`
- human-readable user data can live under `%APPDATA%\Karpik\docs\user`
- server and bot stay deployable independently from the desktop app
- the first milestone is a safe project skeleton, not the full assistant feature set
