# Telegram Task Delivery Slice Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically deliver terminal Telegram task results back to the originating chat via a server outbox and bot poller.

**Architecture:** Keep delivery state on the server as a lightweight outbox keyed by `device_id`, `task_id`, and `chat_id`. When a Telegram-origin task finishes or fails, the server emits one outbox event. The bot polls pending events, renders the final message text, sends it to Telegram, and acks the event after successful delivery.

**Tech Stack:** FastAPI, aiogram, Python stdlib, pytest

---

### Task 1: Add Server Outbox Models, Store, And API

**Files:**
- Create: `server/app/models/delivery.py`
- Create: `server/app/services/delivery_store.py`
- Modify: `server/app/services/task_store.py`
- Modify: `server/app/api/tasks.py`
- Modify: `server/app/main.py`
- Test: `server/tests/test_task_delivery_api.py`

- [ ] **Step 1: Write the failing server delivery tests**

Cover:
- completing a Telegram-origin task creates one pending `task_done` outbox item
- failing a Telegram-origin task creates one pending `task_failed` outbox item
- completing a desktop-origin task does not create a bot outbox item
- acking an outbox item marks it delivered and removes it from the pending list

- [ ] **Step 2: Run the new server tests to confirm failure**

Run: `pytest server/tests/test_task_delivery_api.py -v`
Expected: FAIL because delivery models, store, and routes do not exist yet

- [ ] **Step 3: Implement delivery models and in-memory outbox store**

Add:
- delivery event model
- delivery list response
- delivery ack response
- create/list/ack store methods

- [ ] **Step 4: Emit outbox events from task completion/failure**

Only emit when:
- task source is `telegram`
- `chat_id` and `telegram_user_id` are present
- terminal status is `done` or `failed`

- [ ] **Step 5: Add delivery routes**

Implement:
- `GET /api/bot/outbox?device_id=...`
- `POST /api/bot/outbox/{event_id}/ack`

- [ ] **Step 6: Run the full server suite**

Run: `pytest server/tests -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server
git commit -m "feat: add telegram task delivery api"
```

### Task 2: Add Bot Delivery Client, Renderer, And Poll Loop

**Files:**
- Create: `bot/app/delivery_client.py`
- Create: `bot/app/delivery.py`
- Modify: `bot/app/main.py`
- Test: `bot/tests/test_delivery.py`

- [ ] **Step 1: Write the failing bot delivery tests**

Cover:
- rendering a `task_done` event into final Telegram text
- rendering a `task_failed` event into final Telegram text
- one poll cycle sends pending events and acks them
- ack is skipped when Telegram send fails

- [ ] **Step 2: Run bot delivery tests to confirm failure**

Run: `pytest bot/tests/test_delivery.py -v`
Expected: FAIL

- [ ] **Step 3: Implement the bot delivery HTTP client**

Add methods for:
- fetching pending outbox events
- acking an outbox event

- [ ] **Step 4: Implement delivery rendering and one-cycle sender**

Keep it small:
- render terminal success/failure text
- send through an injected Telegram sender callback
- ack only after successful send

- [ ] **Step 5: Wire a background polling task into the bot runtime**

On bot startup:
- create a repeating poll loop
- fetch pending outbox items
- send and ack them

- [ ] **Step 6: Run the full bot suite**

Run: `pytest bot/tests -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add bot
git commit -m "feat: add telegram task delivery poller"
```

### Task 3: Verify And Push The Delivery Slice

**Files:**
- Modify: `docs/runbooks/local-dev.md` if startup flow wording needs a small note

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
