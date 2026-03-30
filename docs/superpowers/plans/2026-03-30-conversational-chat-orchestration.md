# Conversational Chat Orchestration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make both desktop chat and Telegram chat behave like a natural assistant: ordinary messages should be answered conversationally, memory should update quietly in the background, device actions should remain task-based, and the desktop UI must stop freezing while replies are generated.

**Architecture:** Implement this on top of the shipping `knowledge-vault-foundation` line, not plain `main`, because the installed `0.1.13` build already depends on that desktop-local vault foundation. Add a conversation-first orchestration layer with multi-action planning, transport-specific streaming delivery, and background knowledge writes. Reuse existing task execution for explicit device actions, but stop exposing routing internals in user-visible chat.

**Tech Stack:** Electron main/renderer IPC, TypeScript, Vitest, Python Telegram bot, DeepSeek chat completions, local Markdown vault, existing local approval/task runtime.

---

## File Structure

### Desktop

- Create: `desktop/src/main/chatPlan.ts`
  - shared TypeScript types for message plan, visible reply events, memory writes, retrieval actions
- Create: `desktop/src/main/chatPlanner.ts`
  - builds a multi-action plan for local chat messages
- Create: `desktop/src/main/chatStreamSessionStore.ts`
  - tracks active local reply sessions and emits `started/chunk/completed/failed`
- Create: `desktop/src/main/chatMemoryExtractor.ts`
  - extracts direct facts, observations, topic hints, and documentation hints from a conversation turn
- Create: `desktop/src/main/chatKnowledgeRetriever.ts`
  - resolves local-vault snippets first, then trusted docs entries, then optional external lookup hooks
- Create: `desktop/src/main/deepseekStreamingResponder.ts`
  - streaming DeepSeek client for Electron main process
- Modify: `desktop/src/main/localChatRuntime.ts`
  - stop awaiting a full reply synchronously
  - orchestrate planning, streaming, background writes, and optional device tasks
- Modify: `desktop/src/main/localConversationRouter.ts`
  - demote it into a task-intent helper or remove task-first fallback logic entirely
- Modify: `desktop/src/main/main.ts`
  - add IPC event wiring for streaming local chat updates
- Modify: `desktop/src/preload/index.ts`
  - expose subscription API for local chat streaming events
- Modify: `desktop/src/renderer/window.d.ts`
  - add typed event subscription surface for streamed chat events
- Modify: `desktop/src/renderer/pages/ChatsPage.tsx`
  - render optimistic user message, assistant placeholder, progressive chunks, and non-blocking send flow
- Modify: `desktop/src/main/knowledgeBackgroundWriter.ts`
  - accept structured memory/doc updates from the planner instead of only coarse post-response hooks
- Modify: `desktop/src/main/knowledgeTopicResolver.ts`
  - support topic matching for appending to existing files rather than over-creating files
- Modify: `desktop/src/main/ownerProfileStore.ts`
  - expose stable profile context to planner/memory extraction if not already available

### Bot

- Create: `bot/app/chat_plan.py`
  - Python equivalents of message-plan dataclasses for Telegram flow
- Create: `bot/app/chat_planner.py`
  - conversation-first planner for Telegram messages
- Create: `bot/app/chat_streaming.py`
  - throttled progressive edit helper for one Telegram reply message
- Create: `bot/app/chat_memory_extractor.py`
  - extracts profile facts, preferences, observations, and documentation hints from Telegram chat turns
- Modify: `bot/app/conversation.py`
  - use planner first for ordinary text, preserve pending-state handling and explicit device-task flow
- Modify: `bot/app/chat_responder.py`
  - expand from plain one-shot reply helper toward planner-friendly response generation
- Modify: `bot/app/intent_resolver.py`
  - keep it for explicit device-task classification, but stop treating generic conversation as codex/task by default
- Modify: `bot/app/task_client.py`
  - no new transport change expected unless follow-up device task routing needs more metadata

### Tests

- Modify/Create:
  - `desktop/src/main/localChatRuntime.test.ts`
  - `desktop/src/main/deepseekChatResponder.test.ts`
  - `desktop/src/main/chatPlanner.test.ts`
  - `desktop/src/main/chatMemoryExtractor.test.ts`
  - `desktop/src/renderer/App.test.tsx`
  - `bot/tests/test_conversation.py`
  - `bot/tests/test_chat_responder.py`
  - `bot/tests/test_intent_resolver.py`
  - `bot/tests/test_chat_planner.py`

### Release

- Modify: `desktop/package.json`
  - bump desktop version after behavior is verified
- Update artifacts:
  - `desktop/out/make/squirrel.windows/x64/*`
  - `C:\Users\TBG\Desktop\KarpikSetup.exe`

## Execution Notes

- Implement from a new worktree branched off `knowledge-vault-foundation`, not off current `main`.
- Keep the existing task system intact; this plan is about orchestration and delivery, not replacing task execution.
- Treat `localConversationRouter.ts` as a legacy boundary that may shrink or disappear after planner integration.

### Task 1: Establish the execution branch and baseline

**Files:**
- Create: worktree rooted from `knowledge-vault-foundation`
- Test: existing desktop and bot suites before touching behavior

- [ ] **Step 1: Create a new worktree from `knowledge-vault-foundation`**

Run:

```powershell
git -C C:\Users\TBG\Desktop\assist worktree add C:\Users\TBG\Desktop\assist\.worktrees\conversational-chat-orchestration knowledge-vault-foundation
```

Expected: a clean isolated workspace based on the shipping `0.1.13` line.

- [ ] **Step 2: Run the relevant baseline tests**

Run:

```powershell
cd C:\Users\TBG\Desktop\assist\.worktrees\conversational-chat-orchestration\desktop
npm run test -- localChatRuntime App deepseekChatResponder
npm run typecheck
cd ..\..\bot
python -m pytest tests\test_conversation.py tests\test_chat_responder.py tests\test_intent_resolver.py -v
```

Expected: baseline passes on the branch you are actually fixing.

- [ ] **Step 3: Commit only if branch bootstrap needed adjustments**

```bash
git add .
git commit -m "chore: bootstrap conversational chat worktree"
```

### Task 2: Write failing desktop tests for conversation-first async chat

**Files:**
- Modify: `desktop/src/main/localChatRuntime.test.ts`
- Modify: `desktop/src/renderer/App.test.tsx`
- Create: `desktop/src/main/chatPlanner.test.ts`
- Create: `desktop/src/main/chatMemoryExtractor.test.ts`

- [ ] **Step 1: Add a failing test that generic local chat questions produce a conversational assistant reply plan, not a task**

Example assertion shape:

```ts
await expect(runtime.sendMessage({ chatId: "chat-1", text: "что нового в FastAPI?" })).resolves.toMatchObject({
  pendingReply: true
});
expect(executeTask).not.toHaveBeenCalled();
```

- [ ] **Step 2: Add a failing renderer test that sending a message no longer blocks until full completion**

Example expectations:

```tsx
await user.click(screen.getByRole("button", { name: /send/i }));
expect(screen.getByText("что нового в FastAPI?")).toBeInTheDocument();
expect(screen.getByText(/ассистент отвечает/i)).toBeInTheDocument();
```

- [ ] **Step 3: Add a failing planner test for multi-action output**

Example:

```ts
expect(plan.actions).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ kind: "visible_reply" }),
    expect.objectContaining({ kind: "knowledge_write" }),
    expect.objectContaining({ kind: "knowledge_lookup" })
  ])
);
```

- [ ] **Step 4: Add a failing memory extractor test for direct facts**

Example:

```ts
expect(extractMemoryWrites("Меня зовут Карпов Степан Викторович, я программист на Python")).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ target: "assist/profile", key: "full_name" }),
    expect.objectContaining({ target: "assist/preferences", key: "preferred_stack" })
  ])
);
```

- [ ] **Step 5: Run the focused desktop tests and confirm they fail for the expected reason**

Run:

```powershell
cd C:\Users\TBG\Desktop\assist\.worktrees\conversational-chat-orchestration\desktop
npm run test -- localChatRuntime App chatPlanner chatMemoryExtractor
```

Expected: failures indicating missing planner/streaming behavior, not unrelated breakage.

- [ ] **Step 6: Commit the red tests**

```bash
git add desktop/src/main/localChatRuntime.test.ts desktop/src/renderer/App.test.tsx desktop/src/main/chatPlanner.test.ts desktop/src/main/chatMemoryExtractor.test.ts
git commit -m "test: define conversational desktop chat behavior"
```

### Task 3: Implement desktop planner, memory extraction, and async streaming

**Files:**
- Create: `desktop/src/main/chatPlan.ts`
- Create: `desktop/src/main/chatPlanner.ts`
- Create: `desktop/src/main/chatMemoryExtractor.ts`
- Create: `desktop/src/main/chatStreamSessionStore.ts`
- Create: `desktop/src/main/deepseekStreamingResponder.ts`
- Modify: `desktop/src/main/localChatRuntime.ts`
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/preload/index.ts`
- Modify: `desktop/src/renderer/window.d.ts`
- Modify: `desktop/src/renderer/pages/ChatsPage.tsx`
- Modify: `desktop/src/main/knowledgeBackgroundWriter.ts`

- [ ] **Step 1: Add shared chat-plan types**

Implement the minimal types for:

```ts
type ChatPlanAction =
  | { kind: "visible_reply"; strategy: "deepseek" | "codex" | "static" }
  | { kind: "knowledge_write"; writes: KnowledgeWriteIntent[] }
  | { kind: "knowledge_lookup"; topics: string[] }
  | { kind: "device_task"; intent: string }
  | { kind: "follow_up"; suggestion: string };
```

- [ ] **Step 2: Implement the planner with conversation-first rules**

Key rules:
- generic questions -> visible reply + possible lookup/write
- explicit PC actions -> device task
- explicit `кодекс/codex` -> allow codex path
- file/project-sensitive prompts may still require codex, but without exposing that wording to the user

- [ ] **Step 3: Implement memory extraction**

Handle at minimum:
- direct profile facts
- role/profession
- stack mentions
- technology-topic hints
- trusted-source hints from pasted URLs

- [ ] **Step 4: Add stream session store and event API**

The store should support:
- create reply session
- append chunk
- complete
- fail

- [ ] **Step 5: Refactor `localChatRuntime.sendMessage` so it returns immediately after enqueueing the assistant reply**

Required behavior:
- append user message immediately
- append assistant placeholder immediately
- continue reply generation in background
- send renderer updates through events

- [ ] **Step 6: Update renderer and preload for progressive assistant output**

Renderer should:
- show user bubble right away
- show assistant placeholder
- update assistant bubble as chunks arrive
- keep the rest of the app responsive while waiting

- [ ] **Step 7: Wire quiet knowledge writes into the background flow**

Use the planner output to call the existing vault-writing layer without blocking visible response delivery.

- [ ] **Step 8: Run focused desktop tests and make them pass**

Run:

```powershell
cd C:\Users\TBG\Desktop\assist\.worktrees\conversational-chat-orchestration\desktop
npm run test -- localChatRuntime App chatPlanner chatMemoryExtractor deepseekChatResponder
npm run typecheck
```

Expected: all targeted desktop tests pass.

- [ ] **Step 9: Commit the desktop chat orchestration slice**

```bash
git add desktop/src/main desktop/src/preload/index.ts desktop/src/renderer/window.d.ts desktop/src/renderer/pages/ChatsPage.tsx
git commit -m "feat: add conversational desktop chat orchestration"
```

### Task 4: Write failing Telegram tests for conversation-first behavior

**Files:**
- Modify: `bot/tests/test_conversation.py`
- Modify: `bot/tests/test_chat_responder.py`
- Modify: `bot/tests/test_intent_resolver.py`
- Create: `bot/tests/test_chat_planner.py`

- [ ] **Step 1: Add a failing test that ordinary Telegram questions are answered conversationally**

Example:

```python
reply = conversation.handle_text(user_id=1, chat_id=1, text="что нового в FastAPI?")
assert "FastAPI" in reply.text
assert task_client.created_tasks == []
```

- [ ] **Step 2: Add a failing test that explicit PC actions still create a task**

Example:

```python
reply = conversation.handle_text(user_id=1, chat_id=1, text="скинь скриншот")
assert task_client.created_tasks[0]["intent"].startswith("screenshot")
```

- [ ] **Step 3: Add a failing test for progressive Telegram editing coordinator**

Example:

```python
events = list(streamer.iter_events("Привет, сейчас посмотрю..."))
assert events[0].kind == "started"
assert any(event.kind == "chunk" for event in events)
assert events[-1].kind == "completed"
```

- [ ] **Step 4: Run the focused bot tests and verify the failures are relevant**

Run:

```powershell
cd C:\Users\TBG\Desktop\assist\.worktrees\conversational-chat-orchestration\bot
python -m pytest tests/test_conversation.py tests/test_chat_responder.py tests/test_intent_resolver.py tests/test_chat_planner.py -v
```

Expected: failures around missing planner/progressive behavior.

- [ ] **Step 5: Commit the red Telegram tests**

```bash
git add bot/tests/test_conversation.py bot/tests/test_chat_responder.py bot/tests/test_intent_resolver.py bot/tests/test_chat_planner.py
git commit -m "test: define conversational telegram behavior"
```

### Task 5: Implement Telegram planner and progressive reply editing

**Files:**
- Create: `bot/app/chat_plan.py`
- Create: `bot/app/chat_planner.py`
- Create: `bot/app/chat_streaming.py`
- Create: `bot/app/chat_memory_extractor.py`
- Modify: `bot/app/conversation.py`
- Modify: `bot/app/chat_responder.py`
- Modify: `bot/app/intent_resolver.py`

- [ ] **Step 1: Add Telegram-side plan dataclasses and planner**

Match the desktop planner behavior conceptually:
- conversation-first
- multi-action plan
- explicit task routing only for real PC actions

- [ ] **Step 2: Teach `conversation.py` to use the planner before creating tasks**

Preserve:
- auth pending states
- inline confirm buttons
- screenshot clarification
- app selection

Change:
- generic questions no longer become robotic task-routing replies

- [ ] **Step 3: Add throttled progressive edit delivery**

Implement a helper that:
- sends one initial reply
- updates it periodically with longer text
- completes cleanly

- [ ] **Step 4: Integrate memory extraction hooks**

At minimum, emit extracted memory intents so the desktop-side knowledge layer can later converge on the same structure, or store through the existing bot-side pathways if they already exist.

- [ ] **Step 5: Run focused bot tests and make them pass**

Run:

```powershell
cd C:\Users\TBG\Desktop\assist\.worktrees\conversational-chat-orchestration\bot
python -m pytest tests/test_conversation.py tests/test_chat_responder.py tests/test_intent_resolver.py tests/test_chat_planner.py -v
```

Expected: all targeted bot tests pass.

- [ ] **Step 6: Commit the Telegram orchestration slice**

```bash
git add bot/app bot/tests
git commit -m "feat: add conversational telegram orchestration"
```

### Task 6: Integrate trusted-doc lookup and quiet vault writes

**Files:**
- Modify: `desktop/src/main/chatKnowledgeRetriever.ts`
- Modify: `desktop/src/main/knowledgeBackgroundWriter.ts`
- Modify: `desktop/src/main/knowledgeTopicResolver.ts`
- Modify: `desktop/src/main/localChatRuntime.ts`
- Modify: `bot/app/chat_planner.py`
- Modify: `bot/app/chat_responder.py`

- [ ] **Step 1: Add retrieval tests for local-vault-first behavior**

Examples:
- local FastAPI note exists -> no external lookup needed
- no local doc source exists -> planner requests external docs lookup

- [ ] **Step 2: Implement trusted-docs-first retrieval**

Retrieval order:
- assist memory
- user notes
- trusted registries
- known docs pages
- external web lookup

- [ ] **Step 3: Wire quiet writes into `assist/docs` and `user/`**

When new technical knowledge is discovered:
- update or append the topic file in `user/`
- update source note and registry in `assist/docs`

- [ ] **Step 4: Add a follow-up suggestion policy**

Examples:
- offer to save a compact summary
- offer to fetch breaking changes
- offer to inspect migration notes

- [ ] **Step 5: Run the expanded desktop tests**

Run:

```powershell
cd C:\Users\TBG\Desktop\assist\.worktrees\conversational-chat-orchestration\desktop
npm run test -- localChatRuntime chatPlanner chatMemoryExtractor deepseekChatResponder
npm run typecheck
```

Expected: green.

- [ ] **Step 6: Commit retrieval and memory integration**

```bash
git add desktop/src/main bot/app
git commit -m "feat: add knowledge-aware conversational retrieval"
```

### Task 7: Full regression, version bump, and release artifacts

**Files:**
- Modify: `desktop/package.json`
- Modify: `desktop/package-lock.json`
- Update: desktop build artifacts after verification

- [ ] **Step 1: Run the full relevant suites**

Run:

```powershell
cd C:\Users\TBG\Desktop\assist\.worktrees\conversational-chat-orchestration\desktop
npm run test
npm run typecheck
npm run make
cd ..\..\bot
python -m pytest tests -v
cd ..\server
python -m pytest tests -v
```

Expected: all affected suites pass.

- [ ] **Step 2: Manually smoke test the target scenarios**

Desktop chat:
- `привет`
- `меня зовут Карпов Степан Викторович, я программист на Python, использую FastAPI, знаешь что-нибудь про его свежие обновления?`
- confirm UI does not freeze while reply is streaming

Telegram:
- same FastAPI conversational prompt
- explicit device action like `скинь скриншот`
- explicit codex override like `кодекс объясни ошибку в файле main.py`

- [ ] **Step 3: Bump desktop version**

Set next patch version in:
- `desktop/package.json`
- `desktop/package-lock.json`

- [ ] **Step 4: Rebuild release artifacts**

Run:

```powershell
cd C:\Users\TBG\Desktop\assist\.worktrees\conversational-chat-orchestration\desktop
npm run make
```

- [ ] **Step 5: Commit the release-ready conversational chat feature**

```bash
git add desktop/package.json desktop/package-lock.json desktop bot server
git commit -m "feat: add conversational assistant chat orchestration"
```

