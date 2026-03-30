# Conversational Chat Streaming And Memory Promotion Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make desktop and Telegram chat feel human by routing ordinary text through a conversation-first pipeline, streaming replies per chat, supporting stop/cancel, and quietly promoting memory into the vault without polluting the user-visible graph.

**Architecture:** Keep each local chat run in desktop main-process state so replies can continue across tab switches and tray minimization. Narrow `codex`/task routing so ordinary questions never fall through to raw CLI execution, then layer retrieval, docs lookup, and quiet memory promotion on top of the conversational path.

**Tech Stack:** Electron, React, TypeScript, Vitest, Python, aiogram, pytest, markdown vault files.

---

### Task 1: Desktop Chat Run State Machine

**Files:**
- Create: `desktop/src/main/chatRunStore.ts`
- Test: `desktop/src/main/chatRunStore.test.ts`
- Modify: `desktop/src/main/localChatRuntime.ts`
- Modify: `desktop/src/main/localChatRuntime.test.ts`
- Modify: `desktop/src/main/localChatStore.ts`
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/preload/index.ts`
- Modify: `desktop/src/renderer/window.d.ts`
- Modify: `desktop/src/renderer/pages/ChatsPage.tsx`

- [ ] **Step 1: Write the failing store test**

```ts
it("tracks one active run per chat and supports cancellation", () => {
  const store = createChatRunStore();
  const run = store.startRun("chat-1");
  expect(store.canSend("chat-1")).toBe(false);
  store.requestCancel(run.runId);
  expect(store.getRun("chat-1")?.cancelRequested).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- chatRunStore`  
Expected: FAIL because `chatRunStore` does not exist yet.

- [ ] **Step 3: Implement minimal chat run store**

```ts
type ChatRunStatus = "thinking" | "streaming" | "cancelled" | "failed" | "completed";
```

Implement:
- one active run per `chatId`
- `startRun`
- `updateRun`
- `requestCancel`
- `finishRun`
- helper for `canSend(chatId)`

- [ ] **Step 4: Run focused test to verify it passes**

Run: `npm run test -- chatRunStore`

- [ ] **Step 5: Write failing runtime/UI tests**

Add tests proving:
- local chat appends an ack message then a streaming assistant message
- send button becomes stop button while run is active
- stopping preserves partial text
- only the active chat is locked

- [ ] **Step 6: Run focused tests to verify they fail**

Run: `npm run test -- localChatRuntime ChatsPage`

- [ ] **Step 7: Implement runtime and renderer wiring**

Implement:
- ack message `Сейчас посмотрю и отвечу по сути.`
- separate streaming assistant message
- deletion of ack on success/cancel/failure
- IPC for canceling the active run
- renderer chat input disabled only for that chat

- [ ] **Step 8: Run focused tests to verify they pass**

Run: `npm run test -- chatRunStore localChatRuntime ChatsPage`

- [ ] **Step 9: Commit**

```bash
git add desktop/src/main/chatRunStore.ts desktop/src/main/chatRunStore.test.ts desktop/src/main/localChatRuntime.ts desktop/src/main/localChatRuntime.test.ts desktop/src/main/localChatStore.ts desktop/src/main/main.ts desktop/src/preload/index.ts desktop/src/renderer/window.d.ts desktop/src/renderer/pages/ChatsPage.tsx
git commit -m "feat: add per-chat streaming run state"
```

### Task 2: Conversation-First Routing And Humanized Failures

**Files:**
- Modify: `desktop/src/main/chatPlanner.ts`
- Modify: `desktop/src/main/chatPlanner.test.ts`
- Modify: `bot/app/conversation.py`
- Modify: `bot/app/intent_resolver.py`
- Modify: `bot/app/chat_responder.py`
- Test: `bot/tests/test_conversation.py`
- Test: `bot/tests/test_chat_responder.py`

- [ ] **Step 1: Write failing routing tests**

Examples:

```python
def test_plain_question_uses_conversation_path():
    ...

def test_habr_article_question_does_not_fall_into_codex():
    ...
```

```ts
it("treats stack and article questions as conversational", () => {
  expect(planChatRequest("читаю на хабре ...")).toMatchObject({ kind: "conversation" });
});
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run:
- `npm run test -- chatPlanner`
- `python -m pytest tests/test_conversation.py tests/test_chat_responder.py -q`

- [ ] **Step 3: Narrow codex routing**

Implement:
- ordinary text defaults to conversational
- `codex` only on explicit keyword or clear local project/file/code requests
- convert raw internal errors into human-readable text

- [ ] **Step 4: Run focused tests to verify they pass**

Run:
- `npm run test -- chatPlanner`
- `python -m pytest tests/test_conversation.py tests/test_chat_responder.py -q`

- [ ] **Step 5: Commit**

```bash
git add desktop/src/main/chatPlanner.ts desktop/src/main/chatPlanner.test.ts bot/app/conversation.py bot/app/intent_resolver.py bot/app/chat_responder.py bot/tests/test_conversation.py bot/tests/test_chat_responder.py
git commit -m "fix: route ordinary chat through conversation flow"
```

### Task 3: Quiet Memory Promotion And Observation Layer

**Files:**
- Create: `desktop/src/main/knowledgeObservationWriter.ts`
- Test: `desktop/src/main/knowledgeObservationWriter.test.ts`
- Modify: `desktop/src/main/knowledgeBackgroundWriter.ts`
- Modify: `desktop/src/main/knowledgeBackgroundWriter.test.ts`
- Modify: `desktop/src/main/chatMemoryExtractor.ts`
- Modify: `desktop/src/main/chatMemoryExtractor.test.ts`
- Modify: `desktop/src/main/localChatRuntime.ts`
- Modify: `bot/app/chat_memory_extractor.py`

- [ ] **Step 1: Write failing memory tests**

Examples:

```ts
it("writes temporary observations into assist/observations without backlinks", async () => {
  ...
});

it("updates an existing topic note instead of duplicating it", async () => {
  ...
});
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `npm run test -- knowledgeBackgroundWriter chatMemoryExtractor`

- [ ] **Step 3: Implement observation layer and promotion rules**

Implement:
- `assist/observations/...` writer with dated entries
- durable facts/preferences update only on direct statements or repeated signals
- reuse existing topic files instead of creating duplicates
- docs/article source URLs update `assist/docs/...` registries quietly

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `npm run test -- knowledgeBackgroundWriter knowledgeObservationWriter chatMemoryExtractor`

- [ ] **Step 5: Commit**

```bash
git add desktop/src/main/knowledgeObservationWriter.ts desktop/src/main/knowledgeObservationWriter.test.ts desktop/src/main/knowledgeBackgroundWriter.ts desktop/src/main/knowledgeBackgroundWriter.test.ts desktop/src/main/chatMemoryExtractor.ts desktop/src/main/chatMemoryExtractor.test.ts desktop/src/main/localChatRuntime.ts bot/app/chat_memory_extractor.py
git commit -m "feat: add quiet observation and memory promotion"
```

### Task 4: Background Continuity, Full Verification, And Release

**Files:**
- Modify: `desktop/package.json`
- Modify: `desktop/package-lock.json`
- Modify: `docs/superpowers/specs/2026-03-30-conversational-chat-streaming-and-memory-promotion-design.md`
- Modify: `docs/superpowers/plans/2026-03-30-conversational-chat-streaming-and-memory-promotion.md`

- [ ] **Step 1: Add/adjust tests for tray/background continuity**

Verify:
- active run survives tab switches
- active run survives tray/minimize
- chat remains locked only while that run is active

- [ ] **Step 2: Run full desktop, bot, and server verification**

Run:
- `npm run test`
- `npm run typecheck`
- `python -m pytest tests -q` in `bot`
- `python -m pytest tests -q` in `server`

Expected:
- all green

- [ ] **Step 3: Bump desktop version and build installer**

Run:
- `npm run make`

Expected:
- `desktop/out/make/squirrel.windows/x64/KarpikSetup.exe`
- updated `RELEASES`
- updated `.nupkg`

- [ ] **Step 4: Copy installer to desktop and upload feed**

Copy:
- `desktop/out/make/squirrel.windows/x64/KarpikSetup.exe`
to:
- `C:\Users\TBG\Desktop\KarpikSetup.exe`

Upload:
- `RELEASES`
- `.nupkg`
- `KarpikSetup.exe`
to:
- `/srv/karpik/desktop-updates/win32/x64/`

- [ ] **Step 5: Commit**

```bash
git add desktop/package.json desktop/package-lock.json
git commit -m "chore: bump desktop version for conversational chat runtime"
```
