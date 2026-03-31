# Codex-Native Conversational Sessions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current hybrid conversational runtime with device-local Codex sessions so GUI and Telegram can continue the same conversation thread while long-term knowledge still writes into the local vault.

**Architecture:** Desktop becomes the owner of conversational session lifecycle and streaming. Each local chat and Telegram chat maps to one persistent `codex_session_id`, and Telegram conversational requests are routed as device-scoped events to the desktop. The existing vault writer remains a separate background subsystem for durable knowledge and personalization.

**Tech Stack:** Electron main/renderer, local Codex CLI, FastAPI, aiogram, markdown vault, Vitest, pytest

---

## File Structure

### Desktop

- Create: `desktop/src/main/chatSessionStore.ts`
  - Persist mappings between local chats, Telegram chats, and `codex_session_id`
- Create: `desktop/src/main/chatSessionStore.test.ts`
  - Persistence and reuse tests
- Create: `desktop/src/main/codexConversationRunner.ts`
  - Start session, resume session, stream chunks, stop/cancel
- Create: `desktop/src/main/codexConversationRunner.test.ts`
  - Runner lifecycle and cancel tests
- Modify: `desktop/src/main/codexRunner.ts`
  - Reuse low-level process spawning helpers if practical
- Modify: `desktop/src/main/localChatRuntime.ts`
  - Replace prompt-history-driven conversation flow with Codex session runtime
- Modify: `desktop/src/main/localChatRuntime.test.ts`
  - Local chat behavior, single-flight, stop, optimistic send
- Modify: `desktop/src/main/main.ts`
  - Wire session store, runner, Telegram conversational events, background writes
- Modify: `desktop/src/main/syncClient.ts`
  - Add conversational event polling, update, ack endpoints
- Modify: `desktop/src/main/localChatStore.ts`
  - Store/reuse session metadata for continuation chats
- Modify: `desktop/src/main/quickAccessRuntime.ts`
  - Ensure quick entry uses same session-aware local chat runtime where appropriate
- Modify: `desktop/src/renderer/pages/ChatsPage.tsx`
  - Keep optimistic chat UX, stop control, and run status
- Modify: `desktop/src/renderer/App.tsx`
  - Any state propagation needed for active runs

### Server

- Create: `server/app/models/conversation_event.py`
  - Request/response models for conversational events and streaming updates
- Create: `server/app/services/conversation_event_store.py`
  - Durable pending event queue for device-scoped conversation runs
- Create: `server/app/api/conversation_events.py`
  - Device poll/update/ack endpoints
- Create: `server/tests/test_conversation_events_api.py`
  - End-to-end API tests
- Modify: `server/app/main.py`
  - Register new store/router
- Modify: `server/app/services/state_backend.py`
  - Persist new event store section

### Bot

- Modify: `bot/app/main.py`
  - Route conversational Telegram messages to server/desktop event flow instead of local final answer generation
- Modify: `bot/app/conversation.py`
  - Keep operator/task routing, but offload natural conversational execution to device events
- Create: `bot/app/conversation_delivery.py`
  - Telegram placeholder/update/final edit helpers for conversational runs
- Create: `bot/tests/test_conversation_delivery.py`
  - Delivery behavior tests
- Modify: `bot/app/task_client.py`
  - Add create/list/update/ack conversational event client methods
- Modify: `bot/tests/test_conversation.py`
  - New expectations for routed conversational flows

### Knowledge / Docs

- Modify: `desktop/src/main/knowledgeBackgroundWriter.ts`
  - Keep writing as post-response background work, independent from conversational runtime
- Modify: `desktop/src/main/chatMemoryExtractor.ts`
  - Ensure extraction still works with final Codex response text
- Modify: `desktop/src/main/knowledgeIngestDecider.ts`
  - Keep promotion rules unchanged unless a new edge case is discovered
- Modify: `docs/runbooks/local-dev.md`
  - Document session-backed conversation behavior for local testing if needed

---

### Task 1: Lock In Session Store Contract

**Files:**
- Create: `desktop/src/main/chatSessionStore.ts`
- Test: `desktop/src/main/chatSessionStore.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests covering:
- create/reuse `codex_session_id` for a local chat
- bind `telegram_chat_id` to the same session
- reuse the session when a continuation chat is created
- preserve interrupted state metadata

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test -- chatSessionStore
```
Expected: FAIL because store does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement a focused JSON-backed store that persists:
- `localChatId`
- `telegramChatId`
- `codexSessionId`
- `deviceId`
- `interrupted`

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test -- chatSessionStore
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop/src/main/chatSessionStore.ts desktop/src/main/chatSessionStore.test.ts
git commit -m "feat: add conversational session store"
```

### Task 2: Build Codex Conversation Runner

**Files:**
- Create: `desktop/src/main/codexConversationRunner.ts`
- Test: `desktop/src/main/codexConversationRunner.test.ts`
- Modify: `desktop/src/main/codexRunner.ts`

- [ ] **Step 1: Write the failing test**

Add tests for:
- start a persistent session on first message
- resume an existing session on later messages
- surface incremental chunks/events
- cancel an active process and keep partial output

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test -- codexConversationRunner
```
Expected: FAIL because runner does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement a runner that:
- launches Codex without `--ephemeral` for first-run chat sessions
- captures the resulting `session_id`
- calls `codex exec resume <session_id> ...` for follow-ups
- emits chunk updates and supports cancellation

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test -- codexConversationRunner
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop/src/main/codexConversationRunner.ts desktop/src/main/codexConversationRunner.test.ts desktop/src/main/codexRunner.ts
git commit -m "feat: add codex conversational runner"
```

### Task 3: Switch Local GUI Chats to Session-Backed Conversations

**Files:**
- Modify: `desktop/src/main/localChatRuntime.ts`
- Modify: `desktop/src/main/localChatRuntime.test.ts`
- Modify: `desktop/src/main/localChatStore.ts`
- Modify: `desktop/src/renderer/pages/ChatsPage.tsx`

- [ ] **Step 1: Write the failing test**

Add or extend tests to assert:
- local chat send is optimistic
- same chat reuses `codex_session_id`
- stop cancels only that chat run
- switching chats does not terminate a running response

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test -- localChatRuntime ChatsPage
```
Expected: FAIL on old prompt-history-based assumptions.

- [ ] **Step 3: Write minimal implementation**

Replace current conversation path so local chats:
- use `chatSessionStore`
- call `codexConversationRunner`
- store run status separately from message storage
- keep existing vault write hook after final answer

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test -- localChatRuntime ChatsPage
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop/src/main/localChatRuntime.ts desktop/src/main/localChatRuntime.test.ts desktop/src/main/localChatStore.ts desktop/src/renderer/pages/ChatsPage.tsx
git commit -m "feat: move local chats to codex sessions"
```

### Task 4: Add Device-Scoped Conversational Events on the Server

**Files:**
- Create: `server/app/models/conversation_event.py`
- Create: `server/app/services/conversation_event_store.py`
- Create: `server/app/api/conversation_events.py`
- Create: `server/tests/test_conversation_events_api.py`
- Modify: `server/app/main.py`
- Modify: `server/app/services/state_backend.py`

- [ ] **Step 1: Write the failing test**

Cover:
- create conversational event for a device
- list pending events per `device_id`
- update stream/final status
- acknowledge completed event

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pytest server/tests/test_conversation_events_api.py -q
```
Expected: FAIL because route/store do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement a simple durable event queue and API with:
- create
- list pending by device
- post update/final payload
- ack

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
pytest server/tests/test_conversation_events_api.py -q
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/app/models/conversation_event.py server/app/services/conversation_event_store.py server/app/api/conversation_events.py server/tests/test_conversation_events_api.py server/app/main.py server/app/services/state_backend.py
git commit -m "feat: add conversational event transport"
```

### Task 5: Route Telegram Conversation Through Desktop

**Files:**
- Modify: `bot/app/main.py`
- Modify: `bot/app/conversation.py`
- Modify: `bot/app/task_client.py`
- Create: `bot/app/conversation_delivery.py`
- Create: `bot/tests/test_conversation_delivery.py`
- Modify: `bot/tests/test_conversation.py`

- [ ] **Step 1: Write the failing test**

Cover:
- conversational Telegram message creates a device event instead of local final reasoning
- placeholder + final update path remains human-readable
- operator/task commands still bypass the conversational event path

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pytest bot/tests/test_conversation.py bot/tests/test_conversation_delivery.py -q
```
Expected: FAIL because current bot still finalizes local conversational replies itself.

- [ ] **Step 3: Write minimal implementation**

Make the bot:
- publish conversational events to the server
- keep placeholder/edit behavior
- receive final text via delivery updates
- preserve explicit task/auth/operator flows

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
pytest bot/tests/test_conversation.py bot/tests/test_conversation_delivery.py -q
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add bot/app/main.py bot/app/conversation.py bot/app/task_client.py bot/app/conversation_delivery.py bot/tests/test_conversation.py bot/tests/test_conversation_delivery.py
git commit -m "feat: route telegram conversation through desktop"
```

### Task 6: Connect Desktop to Telegram Conversational Events

**Files:**
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/main/syncClient.ts`
- Modify: `desktop/src/main/localChatStore.ts`
- Test: `desktop/src/main/localChatRuntime.test.ts`

- [ ] **Step 1: Write the failing test**

Add integration-style tests for:
- polling pending conversational events
- starting/resuming the correct `codex_session_id`
- streaming updates back to the server
- reusing the same session when a GUI continuation chat exists

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test -- localChatRuntime syncClient
```
Expected: FAIL because the event transport is not wired yet.

- [ ] **Step 3: Write minimal implementation**

Wire desktop main process to:
- poll conversational events
- run them through `codexConversationRunner`
- stream or checkpoint updates back through `syncClient`
- continue writing vault memory in the background

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test -- localChatRuntime syncClient
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop/src/main/main.ts desktop/src/main/syncClient.ts desktop/src/main/localChatStore.ts desktop/src/main/localChatRuntime.test.ts
git commit -m "feat: wire desktop conversational event execution"
```

### Task 7: Preserve Long-Term Memory and Skill Approval

**Files:**
- Modify: `desktop/src/main/knowledgeBackgroundWriter.ts`
- Modify: `desktop/src/main/chatMemoryExtractor.ts`
- Modify: `desktop/src/main/knowledgeIngestDecider.ts`
- Test: `desktop/src/main/knowledgeBackgroundWriter.test.ts`
- Test: `desktop/src/main/chatMemoryExtractor.test.ts`

- [ ] **Step 1: Write the failing test**

Add or extend tests for:
- conversational responses still write user/assist notes
- sources from Telegram conversational events still become docs entries
- significant skill updates still create approval drafts rather than silent writes

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test -- knowledgeBackgroundWriter chatMemoryExtractor
```
Expected: FAIL on at least one missing Codex-session-backed path.

- [ ] **Step 3: Write minimal implementation**

Adjust the writer/extractor only where needed so Codex-native conversation continues feeding:
- `assist/profile`
- `assist/preferences`
- `assist/docs/...`
- `user/...`
- `assist/skills` approval drafts

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test -- knowledgeBackgroundWriter chatMemoryExtractor
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop/src/main/knowledgeBackgroundWriter.ts desktop/src/main/chatMemoryExtractor.ts desktop/src/main/knowledgeIngestDecider.ts desktop/src/main/knowledgeBackgroundWriter.test.ts desktop/src/main/chatMemoryExtractor.test.ts
git commit -m "fix: preserve long-term knowledge writes with codex sessions"
```

### Task 8: Full Verification and Release

**Files:**
- Modify: `desktop/package.json`
- Modify: `desktop/package-lock.json`
- Optional docs updates if implementation changed commands or runtime behavior

- [ ] **Step 1: Run full verification**

Run:
```bash
npm run test
npm run typecheck
pytest server/tests -q
pytest bot/tests -q
```
Expected: all green

- [ ] **Step 2: Bump desktop version**

Update:
- `desktop/package.json`
- `desktop/package-lock.json`

- [ ] **Step 3: Build release**

Run:
```bash
npm run make
```
Expected: new Squirrel artifacts in `desktop/out/make/squirrel.windows/x64/`

- [ ] **Step 4: Copy installer and update feed**

Copy/update:
- `C:\Users\TBG\Desktop\KarpikSetup.exe`
- server feed:
  - `RELEASES`
  - `karpik-<version>-full.nupkg`
  - `KarpikSetup.exe`

- [ ] **Step 5: Commit**

```bash
git add desktop/package.json desktop/package-lock.json
git commit -m "chore: bump desktop version for codex sessions"
```

- [ ] **Step 6: Push and deploy**

Run:
```bash
git push -u origin main
```

Then deploy server stack and verify:
```bash
curl http://127.0.0.1:8080/health
curl http://212.8.227.40:8080/health
curl http://212.8.227.40:8080/desktop-updates/win32/x64/RELEASES
```

