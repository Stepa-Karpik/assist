# Codex-First Chat Orchestration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragile chat/task split with a Codex-first conversation pipeline where normal dialogue always stays conversational, narrow commands are intercepted safely, and memory writing remains a background sidecar.

**Architecture:** The desktop becomes the single conversational runtime for both GUI and Telegram. A narrow command interceptor handles only stable device actions, while all normal and mixed messages flow through Codex sessions. Router and memory models become optional sidecars that return structured JSON hints, never user-facing replies.

**Tech Stack:** Electron, React, TypeScript, Vitest, Python bot/server, Codex CLI sessions, local markdown vault.

---

## File Map

### Desktop conversational runtime
- Modify: `desktop/src/main/localChatRuntime.ts`
- Modify: `desktop/src/main/codexConversationRunner.ts`
- Modify: `desktop/src/main/chatPlanner.ts`
- Modify: `desktop/src/main/localIntentResolver.ts`
- Create: `desktop/src/main/chatCommandInterceptor.ts`
- Create: `desktop/src/main/routerModel.ts`
- Create: `desktop/src/main/memoryModel.ts`

### Desktop renderer UX
- Modify: `desktop/src/renderer/pages/ChatsPage.tsx`
- Modify: `desktop/src/renderer/styles.css`

### Telegram device-side conversation path
- Modify: `desktop/src/main/conversationEventRuntime.ts`
- Modify: `bot/app/main.py`
- Modify: `bot/app/conversation.py`
- Modify: `bot/app/conversation_delivery.py`
- Modify: `server/app/api/chat.py`

### Knowledge and memory sidecars
- Modify: `desktop/src/main/chatMemoryExtractor.ts`
- Modify: `desktop/src/main/knowledgeBackgroundWriter.ts`
- Modify: `desktop/src/main/knowledgeIngestDecider.ts`
- Modify: `desktop/src/main/knowledgeLinker.ts`

### Tests
- Modify: `desktop/src/main/localChatRuntime.test.ts`
- Modify: `desktop/src/main/codexConversationRunner.test.ts`
- Create: `desktop/src/main/chatCommandInterceptor.test.ts`
- Create: `desktop/src/main/routerModel.test.ts`
- Modify: `desktop/src/renderer/pages/ChatsPage.test.tsx`
- Modify: `bot/tests/...` relevant conversation delivery tests

## Task 1: Narrow Command Interception

**Files:**
- Create: `desktop/src/main/chatCommandInterceptor.ts`
- Test: `desktop/src/main/chatCommandInterceptor.test.ts`
- Modify: `desktop/src/main/chatPlanner.ts`
- Modify: `desktop/src/main/localIntentResolver.ts`

- [ ] **Step 1: Write failing tests for safe command interception**

Add tests covering:
- normal self-description with words like `проекты` stays conversational
- explicit commands like `сделай скрин второго экрана` produce a tool action
- mixed requests degrade to conversation or mixed mode, not raw task mode
- ambiguous requests require clarification instead of forced task execution

- [ ] **Step 2: Run the focused interceptor tests to verify failure**

Run: `npm run test -- chatCommandInterceptor chatPlanner localIntentResolver`
Expected: FAIL on missing interceptor module and wrong classification behavior.

- [ ] **Step 3: Implement a narrow interceptor**

Create a focused module that only recognizes stable commands:
- screenshot
- open site
- launch app
- send file
- status / queue
- stop process

All other messages must return `conversation`.

- [ ] **Step 4: Update planner to use interceptor first and conversation as default**

Refactor `chatPlanner.ts` so that:
- task mode is no longer the default fallback
- ordinary text remains conversational
- mixed requests do not bypass Codex

- [ ] **Step 5: Re-run focused tests**

Run: `npm run test -- chatCommandInterceptor chatPlanner localIntentResolver`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add desktop/src/main/chatCommandInterceptor.ts desktop/src/main/chatCommandInterceptor.test.ts desktop/src/main/chatPlanner.ts desktop/src/main/localIntentResolver.ts
git commit -m "feat: add narrow chat command interception"
```

## Task 2: Codex-First Local Chat Pipeline

**Files:**
- Modify: `desktop/src/main/localChatRuntime.ts`
- Modify: `desktop/src/main/codexConversationRunner.ts`
- Test: `desktop/src/main/localChatRuntime.test.ts`
- Test: `desktop/src/main/codexConversationRunner.test.ts`

- [ ] **Step 1: Write failing tests for Codex-first local chat flow**

Cover:
- normal dialogue never falls into task executor
- command interception still routes stable commands
- fallback no longer returns raw `codex <text>` task intents for conversation
- chat run state is per chat and does not block unrelated chats

- [ ] **Step 2: Run focused runtime tests to verify failure**

Run: `npm run test -- localChatRuntime codexConversationRunner`
Expected: FAIL on old planner/runtime assumptions.

- [ ] **Step 3: Refactor local chat runtime to treat conversation as default**

Update runtime so that:
- user messages stay in one conversational path by default
- tool actions become a structured side path
- knowledge recording stays post-response and non-blocking

- [ ] **Step 4: Preserve Codex session continuity**

Ensure:
- live chat uses existing session id if present
- old chat resumes only when a new message is actually sent
- opening an old chat does not start work

- [ ] **Step 5: Re-run focused runtime tests**

Run: `npm run test -- localChatRuntime codexConversationRunner`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add desktop/src/main/localChatRuntime.ts desktop/src/main/codexConversationRunner.ts desktop/src/main/localChatRuntime.test.ts desktop/src/main/codexConversationRunner.test.ts
git commit -m "refactor: make local chats codex-first"
```

## Task 3: Live Reply UX in GUI

**Files:**
- Modify: `desktop/src/renderer/pages/ChatsPage.tsx`
- Modify: `desktop/src/renderer/styles.css`
- Test: `desktop/src/renderer/pages/ChatsPage.test.tsx`

- [ ] **Step 1: Write failing renderer tests for single-bubble live reply**

Cover:
- user message appears immediately
- no visible `Сейчас посмотрю...` for normal conversation
- one assistant bubble enters typing state and then fills with text
- stop preserves partial text
- send button becomes stop only for the active chat

- [ ] **Step 2: Run focused renderer tests to verify failure**

Run: `npm run test -- ChatsPage`
Expected: FAIL because old optimistic placeholder flow still creates multiple assistant messages.

- [ ] **Step 3: Implement new live reply UI states**

Replace:
- ack bubble
- `Ассистент отвечает...` placeholder text

with:
- one assistant bubble
- typing-state animation
- same-bubble token updates

- [ ] **Step 4: Make composer behavior stable**

Ensure:
- input clears immediately
- send button animation is visible
- only chat-local busy state blocks additional sends
- no full-window freeze from send lifecycle

- [ ] **Step 5: Re-run renderer tests**

Run: `npm run test -- ChatsPage`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add desktop/src/renderer/pages/ChatsPage.tsx desktop/src/renderer/styles.css desktop/src/renderer/pages/ChatsPage.test.tsx
git commit -m "feat: improve live chat reply ux"
```

## Task 4: Telegram on the Same Conversational Runtime

**Files:**
- Modify: `desktop/src/main/conversationEventRuntime.ts`
- Modify: `bot/app/main.py`
- Modify: `bot/app/conversation.py`
- Modify: `bot/app/conversation_delivery.py`
- Test: `bot/tests/...`

- [ ] **Step 1: Write failing tests for Telegram conversational delivery**

Cover:
- bot creates one conversational event
- desktop produces one reply lifecycle
- Telegram placeholder is updated, not duplicated with multiple ack messages
- command-like conversation does not fall into the wrong task path

- [ ] **Step 2: Run focused bot tests to verify failure**

Run: `pytest bot/tests -k conversation -q`
Expected: FAIL on old delivery assumptions.

- [ ] **Step 3: Refactor Telegram delivery to mirror GUI semantics**

Implement:
- one placeholder/edit lifecycle
- no generic conversational ack spam
- desktop-local Codex session remains the single response engine

- [ ] **Step 4: Keep cancellation and partial text semantics aligned**

Ensure stop/cancel preserves already-generated text instead of deleting it.

- [ ] **Step 5: Re-run focused bot tests**

Run: `pytest bot/tests -k conversation -q`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add desktop/src/main/conversationEventRuntime.ts bot/app/main.py bot/app/conversation.py bot/app/conversation_delivery.py bot/tests
git commit -m "feat: align telegram chat flow with codex-first runtime"
```

## Task 5: Router and Memory Sidecar Contracts

**Files:**
- Create: `desktop/src/main/routerModel.ts`
- Create: `desktop/src/main/memoryModel.ts`
- Test: `desktop/src/main/routerModel.test.ts`
- Modify: `desktop/src/main/chatMemoryExtractor.ts`
- Modify: `desktop/src/main/knowledgeBackgroundWriter.ts`
- Modify: `desktop/src/main/knowledgeIngestDecider.ts`
- Modify: `desktop/src/main/knowledgeLinker.ts`

- [ ] **Step 1: Write failing tests for sidecar contracts**

Cover:
- router returns safe defaults and degrades to `conversation`
- memory planner distinguishes facts vs observations
- source/topic extraction for URLs yields stable structured records
- background knowledge failures do not break reply success

- [ ] **Step 2: Run focused sidecar tests to verify failure**

Run: `npm run test -- routerModel knowledgeBackgroundWriter knowledgeIngestDecider knowledgeLinker`
Expected: FAIL because sidecar modules and contract behavior are incomplete.

- [ ] **Step 3: Implement sidecar interfaces**

Create stable interfaces for:
- router model provider
- memory model provider

Default implementations may be no-op or Codex-backed until external GGUF models are plugged in.

- [ ] **Step 4: Refactor knowledge pipeline to consume structured plans**

Make memory extraction and vault updates consume normalized structured candidates instead of brittle ad-hoc heuristics where possible.

- [ ] **Step 5: Re-run focused sidecar tests**

Run: `npm run test -- routerModel knowledgeBackgroundWriter knowledgeIngestDecider knowledgeLinker`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add desktop/src/main/routerModel.ts desktop/src/main/memoryModel.ts desktop/src/main/routerModel.test.ts desktop/src/main/chatMemoryExtractor.ts desktop/src/main/knowledgeBackgroundWriter.ts desktop/src/main/knowledgeIngestDecider.ts desktop/src/main/knowledgeLinker.ts
git commit -m "feat: add router and memory sidecar contracts"
```

## Task 6: Full Verification and Release Prep

**Files:**
- Modify only as needed for final polish discovered during verification

- [ ] **Step 1: Run full desktop verification**

Run:
- `npm run test`
- `npm run typecheck`
- `npm run make`

Expected:
- all pass
- installer artifacts generated in `desktop/out/make`

- [ ] **Step 2: Run bot and server verification**

Run:
- `pytest bot/tests -q`
- `pytest server/tests -q`

Expected:
- all pass

- [ ] **Step 3: Smoke-check representative chat flows manually**

Verify at minimum:
- normal self-description stays conversational
- mixed request stays coherent
- explicit command still works
- partial stop preserves text
- Telegram placeholder/edit behavior is sane

- [ ] **Step 4: Commit final polish if needed**

```bash
git add .
git commit -m "fix: finalize codex-first chat orchestration"
```

- [ ] **Step 5: Prepare release handoff**

After approval:
- merge or fast-forward to `main`
- push
- rebuild installer
- update desktop feed
- deploy server if changed
