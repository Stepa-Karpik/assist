# Codex-Native Conversational Sessions

## Summary

This subproject replaces the current hybrid conversational memory approach with a codex-native session model.

The core rule is:

- one conversation thread maps to exactly one `codex_session_id`
- Codex owns conversational history
- desktop owns session lifecycle, streaming, stop/cancel, and background side effects
- the local markdown vault remains the source of long-term knowledge and personalization
- server and Telegram bot remain transport and routing layers

This design applies to both:

- desktop local chats
- Telegram conversational chats routed to a specific desktop device

## Goals

- make Codex the canonical owner of per-chat conversational history
- remove the need to rebuild long prompt-based history manually for normal conversation
- allow GUI and Telegram to continue the same conversation via the same `codex_session_id`
- preserve asynchronous behavior, streaming, stop/cancel, tray continuity, and background writes
- keep `user/` and `assist/` vault writing as a separate long-term memory subsystem

## Non-Goals

- replacing the knowledge vault with Codex history
- moving vault contents to the server
- turning the bot into the place where conversational reasoning happens
- using `C:\Users\TBG\.codex\history.jsonl` as the application database or source of truth

## Core Principles

### Codex owns short-term conversational memory

Per-chat dialogue memory should come from Codex session continuation, not from our own reconstructed text transcript.

The application should prefer:

- first message: create a persistent Codex session
- subsequent messages: resume the same session

### Vault owns long-term memory

The vault remains the long-term memory layer:

- `user/` for user-facing knowledge
- `assist/` for assistant profile, preferences, source memory, and skills

Conversation history and long-term knowledge are related but separate.

### Desktop owns execution

Conversational reasoning for a device must run on that device.

This is required because:

- Codex is installed locally
- Codex session state is local
- vault is local
- the assistant must continue responding while the app is minimized to tray

### Server owns routing

The server routes conversational events and delivery between:

- Telegram bot
- the correct desktop device

The server should not become the primary conversational runtime.

## Session Model

### Conversation session mapping

Desktop stores mappings:

- `local_chat_id -> codex_session_id`
- `telegram_chat_id -> codex_session_id`
- `continuation_local_chat_id -> telegram_chat_id`

Each conversation thread uses exactly one `codex_session_id`.

If a local GUI chat is created as a continuation of a Telegram chat, it reuses the existing `codex_session_id`.

### Session lifecycle

For a new conversational thread:

1. desktop creates a persistent Codex session
2. desktop stores the resulting `codex_session_id`
3. desktop starts a conversational run for the current prompt

For an existing thread:

1. desktop loads the stored `codex_session_id`
2. desktop calls `codex exec resume <session_id> ...`
3. desktop streams the resulting text back to the current surface

### Interrupted sessions

If the application is terminated during an active conversational run:

- the active run is marked `interrupted`
- the `codex_session_id` is preserved
- future prompts continue the same session

The interrupted live stream is not resumed as a live stream after restart, but the conversation history survives through Codex.

## Why Not Use history.jsonl as Source of Truth

`C:\Users\TBG\.codex\history.jsonl` may contain useful metadata, but it must not be treated as our database.

Reasons:

- it is an internal Codex persistence format
- it can change independently of our product
- it is vulnerable to race conditions when multiple chats are active
- it is not an explicit contract for application-level session management

Instead, the application should persist its own mapping to `codex_session_id` and use Codex's supported resume mechanism.

## Conversational Run Architecture

Each conversational request creates a run with separate responsibilities.

### Run components

1. `conversation run`
   - the visible answer
   - owns streaming and stop/cancel
   - tied to a single `codex_session_id`

2. `knowledge write`
   - background process
   - writes to `user/` and `assist/`
   - never blocks visible chat completion

3. `task execution`
   - optional side effect if planner detects executable user intent
   - remains separate from the conversational stream

4. `memory promotion`
   - optional background update to profile/preferences/skills
   - should remain independent of the visible answer

### Single-flight rule

Per chat:

- only one active conversational run may execute at a time

Across chats:

- multiple chats may run in parallel
- other tasks may continue in parallel

This applies to:

- desktop chats
- Telegram chats
- continuation chats

## GUI Chat Flow

### Send lifecycle

For local GUI chats:

1. user message appears immediately in the chat
2. UI enters `running` state for that chat only
3. send button turns into a stop control
4. a short acknowledgment appears
5. a separate streaming assistant message is created
6. desktop starts or resumes the Codex session
7. streamed content updates the assistant message progressively
8. acknowledgment is removed once the final streamed answer exists
9. background memory writing starts after or near completion

### UI requirements

- no visible delay between submit and message appearance
- switching tabs or chats must not stop the active run
- minimizing to tray must not stop the active run
- stop only affects the active run of that specific chat
- already streamed text remains after stop

## Telegram Flow

### Device-scoped execution

Telegram conversational requests must be routed to the target desktop device instead of being fully answered inside the bot process.

Flow:

1. user sends a natural-language message to the bot
2. bot resolves the active device
3. server publishes a conversational event for that device
4. desktop receives the event
5. desktop starts or resumes the corresponding Codex session
6. desktop streams output back through the server
7. bot renders the response in Telegram
8. desktop writes long-term knowledge locally in the background

### Telegram visible behavior

Telegram should show:

- a short acknowledgment
- a temporary placeholder or typing-like progress
- the final response replacing or updating the placeholder

If the run is cancelled:

- the already produced text remains visible
- the placeholder is finalized as partial output, not discarded

## Continuation Between Telegram and GUI

Continuation must reuse the same session, not duplicate history.

When the user continues a Telegram thread inside the GUI:

- a local continuation chat is created or reused
- it receives the same `codex_session_id`
- subsequent GUI messages continue the same conversation state

This means Telegram and GUI become two surfaces over one underlying Codex conversation.

## Relationship to Long-Term Knowledge

Codex session memory is not enough on its own.

The system still needs local vault writing:

- `assist/profile`
- `assist/preferences`
- `assist/docs/websites`
- `assist/docs/papers`
- `assist/docs/registry`
- `assist/skills`
- `user/...`

The long-term memory writer should continue to:

- extract user facts
- extract preferences and interests
- extract URLs and sources
- create and update topic notes
- create approval drafts for significant skill updates

Codex sessions solve dialogue continuity, not durable knowledge organization.

## Required New Components

### Desktop

- `chatSessionStore`
  - persists `chat_id -> codex_session_id`
  - persists `telegram_chat_id -> codex_session_id`
  - persists run/interrupted metadata

- `codexConversationRunner`
  - start persistent conversation session
  - resume existing session
  - stream incremental output
  - cancel running process safely

- `conversationRunCoordinator`
  - manages one active run per chat
  - emits UI updates
  - coordinates acknowledgment, streaming, completion, cancellation

### Server

- conversational event queue for devices
- conversational stream update endpoint or equivalent message delivery channel
- durable event acknowledgement path

### Bot

- route natural-language conversation to device-scoped conversational events
- stop trying to be the final conversational brain for device-owned threads
- remain responsible for rendering Telegram messages and controls

## Existing Components to Simplify

The following should be reduced from “primary memory mechanism” to support roles:

- manual `history_context` scaffolding for normal chats
- bot-side final conversational reasoning for device-owned threads
- prompt-level memory compensation for every conversational turn

They may remain as fallback or testing tools, but should no longer be the main design.

## Risks

### Streaming integration complexity

Codex conversational output must be streamable or incrementally observable enough for good UX.

If exact token streaming is not available from the CLI path, chunk-based progressive rendering from incremental subprocess output is acceptable.

### Concurrency

Two simultaneous prompts into one session must be prevented.

### Telegram delivery fragility

Intermediate placeholder and final edit logic must be resilient to message deletion/edit failures.

### Background side effects

Knowledge writes and task side effects must never block the user-visible answer.

## Rollout Strategy

1. implement desktop session store and codex conversation runner
2. switch local GUI chats to codex-native sessions
3. preserve vault writes as background work
4. add Telegram conversational events routed to desktop
5. wire Telegram streaming/final delivery
6. add continuation chat reuse of the same `codex_session_id`
7. reduce obsolete prompt-history scaffolding

## Success Criteria

- GUI local chats preserve dialogue continuity through Codex sessions
- Telegram conversational threads preserve continuity through the same device-owned sessions
- continuation from Telegram into GUI reuses the same session
- stopping a run leaves partial output in place
- minimizing to tray does not stop an active run
- knowledge vault continues to accumulate profile/preferences/docs/user notes in the background
- visible conversational quality no longer depends on our custom reconstructed history windows
