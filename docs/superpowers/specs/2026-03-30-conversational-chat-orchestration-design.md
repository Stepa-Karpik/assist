# Conversational Chat Orchestration Design

Date: 2026-03-30

## Goal

Turn both desktop chat and Telegram chat into a conversation-first assistant experience instead of a command router.

The assistant should:

- answer ordinary messages like a person
- silently extract useful memory from the conversation
- consult local knowledge first, then trusted docs, then the web when needed
- create real device tasks only when the user is clearly asking for an action on the PC
- stream responses progressively instead of freezing the UI or appearing stalled

## Problems In The Current System

1. Desktop local chat is task-first. Generic messages fall through to a robotic router reply or to raw `codex` execution logic.
2. Telegram still exposes task-oriented behavior in cases that should be handled as natural conversation.
3. The assistant does not reliably write profile facts, preferences, stack knowledge, and source trust into memory as part of normal conversation.
4. Desktop chat waits synchronously for full completion, which makes the chat and sometimes the whole application feel frozen.
5. Technical errors leak into user-facing chat in forms like raw CLI or routing failures.

## Design Principles

- Conversation-first: every message is treated as a conversation turn before it is treated as a task.
- Multi-action planning: one message can produce several actions at once.
- Human-facing output only: user-visible messages must be natural Russian, not internal routing language.
- Silent knowledge capture: memory growth happens in the background without chat noise.
- Local-first knowledge: use the local vault before external search.
- Device actions are explicit: opening apps, sending files, screenshots, codex actions, and similar operations stay task-based.
- Transport reuse: desktop and Telegram should share the same planning logic, with transport-specific delivery behavior.

## High-Level Architecture

Introduce a shared conversational orchestration layer with four parts:

1. `message intake`
   - normalize text
   - gather conversation context
   - read current profile, preferences, observations, and relevant vault snippets

2. `message planner`
   - generate a `message plan` rather than a single intent
   - a plan may contain:
     - `visible_reply`
     - `knowledge_lookup`
     - `knowledge_write`
     - `device_task`
     - `follow_up`

3. `action executors`
   - reply executor
   - vault retrieval executor
   - web/docs lookup executor
   - knowledge writer
   - device task dispatcher

4. `response coordinator`
   - desktop: push streaming chunks to renderer
   - Telegram: edit one visible reply progressively
   - manage completion, failure, and optional follow-up messages

## Planner Behavior

The planner no longer chooses between "chat" and "task" as mutually exclusive modes.

Instead, each message may create multiple concurrent actions.

Example:

User says:

> Меня зовут Карпов Степан Викторович, я программист на Python, использую FastAPI, знаешь что-нибудь про его свежие обновления?

Planner output:

- `visible_reply`
  - answer naturally in Russian
- `knowledge_write`
  - record name, role, stack
- `knowledge_lookup`
  - search local vault for FastAPI material
  - if missing, consult trusted docs and then the web
- `assist_docs_update`
  - remember trusted docs and source notes
- `user_knowledge_update`
  - create or update user-facing FastAPI notes
- `follow_up`
  - suggest checking breaking changes, migration notes, or current release deltas

## Retrieval Rules

For technical questions, retrieval order is:

1. `assist/` memory
2. relevant `user/` notes
3. trusted docs registry in `assist/docs/registry/`
4. trusted sites and known documentation pages in `assist/docs/`
5. external web/docs search

If the local vault does not already contain trustworthy documentation references, the assistant should search the web, answer the user, and then write newly discovered knowledge back into the vault.

## Memory Model

### 1. `assist/observations/`

Temporary observations only.

Examples:

- possible preferences
- repeated emotional patterns
- recurring communication style
- possible literacy or explanation-complexity signals

Rules:

- timestamped
- confidence-scored
- not treated as truth
- not linked into the main registry while still provisional

### 2. `assist/profile/`

Confirmed personal facts:

- full name
- city
- age
- gender
- role
- occupation

### 3. `assist/preferences/`

Confirmed working preferences:

- preferred stack
- desired explanation depth
- criticism level
- formatting preferences
- trusted sources

### 4. `assist/docs/`

Assistant memory about documentation and sources:

- trusted sites
- article notes
- source summaries
- documentation registry

### 5. `user/`

User-facing knowledge base only:

- useful explanations
- technology notes
- practical summaries
- polished topic pages

### Promotion Rules

- Direct user-stated facts can be promoted immediately.
- Repeated weak signals start in `assist/observations/`.
- The assistant may silently promote observations into facts or preferences after repeated confirmation over time.
- Promotion does not require user approval.

## Vault Writing Rules

- The assistant must append to existing topic files when a matching topic already exists.
- It should create new files only when the topic is genuinely new.
- File names should always be human-readable, never generic placeholders like `index.md`.
- All user-facing vault content should remain Obsidian-friendly Markdown with internal links where appropriate.
- `assist/observations/` stays intentionally separated from the stable knowledge structure and main registries until promotion.

## Desktop Delivery Model

Current synchronous local chat delivery should be replaced.

New flow:

1. renderer sends user message
2. main process immediately acknowledges acceptance
3. renderer shows the user bubble right away
4. main process emits streaming events:
   - `started`
   - `chunk`
   - `completed`
   - `failed`
5. renderer updates the assistant bubble progressively

This removes the frozen-chat feeling and keeps the desktop responsive while memory writes, retrieval, or device tasks continue in the background.

## Telegram Delivery Model

Telegram cannot stream token-by-token cleanly, so the bot should:

- show typing status
- send one placeholder reply
- progressively edit that one message every short interval
- finalize it when generation completes

This keeps the experience conversational without spamming multiple bot messages.

## Task Creation Rules

Device tasks should only be created when the message clearly asks for an action on the PC.

Examples that should become tasks:

- открой сайт
- запусти приложение
- скинь файл
- сделай скриншот
- прочитай файл
- создай заметку

Examples that should remain conversational:

- привет
- что нового в FastAPI
- объясни ошибку в концепции
- как лучше это сделать

If the message contains both a question and an action request, the planner may create both:

- visible conversational answer
- background or explicit device task

## Model Usage Policy

- DeepSeek remains the primary conversational planner/responder for natural chat and context classification.
- Explicit `codex/кодекс` markers remain as an override signal, but they are no longer required for normal human conversation.
- If the request is clearly about local files, project analysis, or codebase-level reasoning, the planner may route part of the work to codex without forcing the user into codex-style phrasing.
- Internal routing names like `codex`, `intent`, `argument`, or `unsupported task` must never leak into the visible chat layer.

## Error Handling

All user-visible failures must be rewritten into natural Russian.

Examples:

- not: `Error: argument 'osu' not found`
- yes: `Не получилось обработать запрос про osu. Уточни, это сайт, приложение или часть проекта.`

- not: `Unsupported task intent.`
- yes: `Я понял это как обычный вопрос, а не как действие на ПК. Если хочешь именно действие, скажи это явно, например: "открой osu" или "скинь файл".`

Technical diagnostics should stay in logs, not in the chat transcript.

## Testing Strategy

### Desktop main

- planner produces multi-action plans
- streaming event lifecycle is correct
- background jobs do not block response delivery
- local memory writes occur quietly

### Desktop renderer

- user bubble appears immediately
- assistant bubble streams progressively
- no full-application freeze during long replies
- error states remain human-readable

### Telegram bot

- ordinary questions use conversation-first flow
- device-action requests still create tasks
- progressive edited reply works
- explicit codex marker still overrides when requested

### Knowledge layer

- direct facts are written immediately
- observations are stored separately
- promotion path works
- docs registry updates on newly discovered trusted sources

### Regression

- pairing
- task queue
- codex-write approval
- local approvals
- screenshots
- app launching

## Rollout Plan

Implement in four slices:

1. desktop local chat
   - streaming
   - async orchestration
   - human reply behavior
   - memory extraction

2. Telegram chat
   - shared planner
   - progressive edits
   - task-or-conversation coexistence

3. knowledge-aware retrieval
   - local vault first
   - trusted docs next
   - web fallback
   - quiet vault writes

4. promotion and personalization
   - `observations -> profile/preferences`
   - follow-up suggestions
   - better personalization in later turns

## Non-Goals For This Subproject

- replacing all existing task execution infrastructure
- changing multi-device server ownership model
- redesigning the full desktop UI
- moving memory to a separate database

This subproject is specifically about making both chat surfaces behave like an assistant rather than a robot while preserving the existing task system underneath.
