# Codex-First Chat Orchestration

## Summary

This subproject replaces the current fragile split between:

- conversational path
- task path
- bot-side routing

with a Codex-first architecture.

The new rule is:

- every user message is treated as conversation by default
- Codex remains the only visible assistant that answers the user
- a small sidecar model may help with routing and memory planning, but never answers directly
- tool execution remains local and structured
- memory and knowledge writing run in the background and never block the visible reply

This applies to both:

- desktop local chats
- Telegram chats routed through the paired desktop device

## Goals

- make chat behavior feel like one continuous Codex conversation
- prevent normal human dialogue from being misclassified as a task
- keep desktop and Telegram on one conversational architecture
- preserve device actions through tools without breaking the conversational flow
- preserve long-term memory and knowledge writing without blocking replies
- remove clumsy UX elements like visible ack spam for normal conversation

## Non-Goals

- making the secondary model visible to the user
- replacing Codex as the final response model
- removing the long-term markdown vault
- moving long-term memory to the server
- allowing arbitrary task execution directly from heuristic regex rules

## Core Principles

### Codex is the only visible assistant

The user should always experience one assistant.

That assistant is Codex.

Secondary models may help internally, but:

- they do not answer the user
- they do not write files directly
- they do not invoke tools directly
- they do not own the conversation

### Conversation is the default

All messages are treated as conversation unless a narrow and confident command path exists.

This means ordinary messages about life, work, projects, feelings, interests, and self-description must remain in the conversational path even if they contain words like:

- project
- code
- repo
- file

### Commands are narrow, explicit, and safe

Command interception remains supported, but only for stable, unambiguous actions such as:

- screenshot
- open site
- launch app
- send file
- status / queue
- stop process

Ambiguous or mixed messages must not bypass conversation.

### Memory is background work

The visible answer must not wait for:

- profile extraction
- preference extraction
- source registration
- topic linking
- vault writing

Memory and knowledge updates happen in the background after the conversational run starts or completes.

## Model Roles

### Codex

Codex always:

- owns the chat session
- generates the final reply
- decides whether to call tools
- writes or coordinates final knowledge writes
- remains the user-facing intelligence

### Router model

The router model is optional and invisible to the user.

Its job is to return structured JSON describing:

- the likely intent class
- whether tool usage is likely
- whether docs lookup is likely
- whether clarification is needed
- whether memory extraction is relevant

It does not execute anything.

It is a semantic parser, not an assistant.

### Memory model

The memory model is also optional and invisible to the user.

Its job is to return structured candidates for:

- profile facts
- preferences
- observations
- user vault topics
- assist vault topics
- source records
- skill candidates

It does not write markdown itself.

## Execution Pipeline

### GUI local chat

1. User sends a message.
2. The message appears in the chat immediately.
3. The input clears immediately.
4. The send button becomes a stop button for that chat only.
5. A single assistant bubble enters a typing state.
6. Router model may produce a structured interpretation.
7. Codex receives the message plus optional structured hints.
8. Codex may continue the conversation and optionally call tools.
9. Tokens stream into the same assistant bubble.
10. A memory sidecar starts in parallel and prepares write plans.
11. Long-term memory and vault writes happen in the background.

### Telegram chat

1. User sends a message to the bot.
2. Bot routes the message to the paired desktop device.
3. Desktop runs the same conversational pipeline as local chat.
4. Desktop streams updates back to Telegram through the server.
5. Telegram shows one placeholder/edit lifecycle, not multiple ack-style messages.
6. Background memory handling remains local to the desktop device.

## Routing Rules

### Default rule

If the system is not highly confident that a message is a direct command, it must stay in the conversational path.

### Explicit command path

Messages may enter command handling directly only when:

- the command is narrow
- the request is clearly actionable
- the arguments are sufficiently specified

Examples:

- `сделай скрин второго экрана`
- `открой ютуб`
- `скинь файл hack.pptx`
- `покажи очередь`

### Mixed messages

If a message both:

- contains conversation
- and implies an action

it should still go through Codex, with structured tool hints available.

Example:

- `я учусь в ДГТУ и делаю свои проекты, а ещё открой ютуб`

This should not be split by heuristics into a pure task path.

## Tool Model

Tools stay local and structured.

Allowed tools remain explicit and bounded, for example:

- `take_screenshot`
- `open_site`
- `launch_app`
- `send_file`
- `read_file`
- `list_path`
- `kill_app`
- `status`
- `queue`

The router model may suggest tool candidates.

Codex remains responsible for deciding whether those tools are actually used.

The application executes the tool and returns structured results back into the conversational flow.

## Memory and Knowledge Model

### Short-term memory

Short-term dialogue continuity remains inside the Codex session for the chat.

### Long-term memory

Long-term memory remains in the markdown vault:

- `user/`
- `assist/`

### Background memory workflow

After a message begins or completes:

1. The memory model may extract structured candidates.
2. The system builds a write plan.
3. Codex or a dedicated writer layer writes markdown updates.
4. Existing notes are appended or updated instead of duplicated.

### Promotion rules

The system must distinguish between:

- direct facts
- preferences
- temporary observations
- source records
- durable topics

Observations should remain separated from stable knowledge until confirmed.

## Live Reply UX

### Normal conversation

For normal conversation:

- do not show `Сейчас посмотрю...`
- do not create multiple assistant messages per reply
- create one assistant bubble
- start with a subtle typing state
- then stream real tokens into that bubble

### Task execution

For explicit actions:

- a short status may be shown
- for example `Делаю скриншот...`
- this should be a task-state presentation, not generic chat filler

### Stop behavior

If the user presses stop:

- only the current chat run stops
- already streamed text remains
- the reply bubble is preserved as partial output
- other chats continue unaffected

### Background continuity

Switching chats, switching pages, minimizing to tray, or hiding the main window must not stop an active run.

## Failure Handling

### Routing uncertainty

Routing uncertainty must degrade to conversation, not to task execution.

### Memory failures

Memory extraction or vault writing failures must not break the visible answer.

### Tool failures

Tool failures must be surfaced as part of the conversational result or task result, but should not corrupt the chat lifecycle.

### Streaming failures

If streaming fails after partial output:

- preserve the already streamed text
- do not silently discard the assistant bubble

## Configuration

The system should support two configurable internal roles:

- routing model
- memory model

Initially, the user may choose among:

- Codex
- bundled local model
- user-supplied local model

Codex still remains the final response model in all cases.

## Testing Requirements

The implementation should verify:

- normal self-description stays in conversation mode
- words like `проекты` do not force task/codex task routing
- direct commands still reach tool handling
- mixed requests stay coherent
- GUI messages appear instantly
- one reply maps to one assistant bubble
- stop preserves partial text
- tray/background continuation keeps runs alive
- Telegram follows the same conversational pipeline
- memory writes can fail without breaking replies

## Expected Outcome

After this subproject:

- the chat feels like one live Codex conversation
- ordinary dialogue no longer falls into broken task paths
- command handling remains available but no longer dominates the architecture
- long-term memory stays rich without blocking the visible reply
- GUI and Telegram share one coherent conversational system
