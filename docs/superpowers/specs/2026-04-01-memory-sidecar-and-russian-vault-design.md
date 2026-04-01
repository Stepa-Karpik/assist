# Memory Sidecar And Russian Vault Design

## Summary

This subproject strengthens the local long-term memory system without changing the visible assistant contract.

The assistant reply path remains independent and fast.

Memory extraction, promotion, and markdown writing become a separate background sidecar that:

- extracts richer user facts and preferences
- separates confirmed facts from observations
- writes visible vault data in Russian only
- avoids blocking chat responses
- avoids corrupting or over-writing existing user data

## Goals

- capture substantially more useful information from rich self-description messages
- keep reply generation and memory writing decoupled
- normalize visible markdown vault output to Russian only
- add a safe promotion path from temporary observations to stable profile/preferences
- preserve Obsidian-friendly structure and links
- support later backfill of existing chats

## Non-Goals

- replacing Codex as the responding model
- moving long-term memory to the server
- making memory extraction block chat replies
- exposing internal machine keys to the user-facing vault
- introducing a second visible assistant

## Core Principles

### Reply path and memory path are separate

The assistant must answer the user even if memory extraction fails.

Memory write failures must degrade to logs, not user-visible chat failures.

### Visible vault is Russian only

All visible markdown files under `user/` and `assist/` should use Russian titles, headings, and labels.

Mixed entries such as:

- `preferred_environment: Тишина`

must be replaced by Russian-only presentation such as:

- `Предпочитаемая среда: Тишина`

### One theme, one file

If a suitable note already exists, the sidecar appends or updates that note instead of creating duplicates.

### Observations are not facts

Soft inferences and patterns should go to `assist/observations/...` first.

Only confirmed or repeated information should move into:

- `assist/profile/...`
- `assist/preferences/...`

## Target Vault Structure

### `assist/profile/`

- `Личность.md`
- `Образование.md`
- `Деятельность.md`
- `Устройства и железо.md`

### `assist/preferences/`

- `Стек и технологии.md`
- `Стиль общения.md`
- `Условия работы.md`
- `Карьерные ориентиры.md`
- `Досуг и интересы.md`

### `assist/observations/`

- `Поведенческие наблюдения.md`
- `Эмоциональные сигналы.md`
- `Гипотезы о предпочтениях.md`

These files are user-visible in Obsidian but must remain separate from the permanent knowledge graph until promoted.

### `user/`

Thematic notes remain under user-facing domains such as:

- `user/AI/...`
- `user/Backend/...`
- `user/Программирование/...`
- `user/Проекты/...`

Self-description should not be dumped into `user/` unless it naturally contributes to a user-facing theme, such as a project vision or a technical note.

## Extraction Scope

The sidecar should support extracting the following from conversational messages:

- full name
- gender
- age
- city
- language
- university
- faculty / department
- degree area
- course / year of study
- occupation and current activity
- project names and recurring personal projects
- technical stack
- interests and hobbies
- career goals
- values and aversions
- work and communication preferences
- hardware profile
- source URLs and article links

## Promotion Rules

### Write immediately

Write immediately when the statement is direct and explicit:

- `Я учусь в ДГТУ`
- `Мне нравится изучать нейросети`
- `У меня AMD Radeon RX 5700 XT`
- `Предпочитаю быть в тишине`

### Write as observation first

Write as observation first when the information is inferential:

- user seems to value autonomy
- user tends toward a calm period of life
- user may prefer simpler wording

### Promote later

Promotion from `assist/observations` to stable profile/preferences should require repeated evidence or explicit confirmation.

## Runtime Behavior

1. User sends a message.
2. Chat responds normally.
3. Background memory sidecar receives:
   - current prompt
   - assistant answer
   - recent conversation context
4. Sidecar produces:
   - structured memory candidates
   - structured vault write plan
5. Writer updates markdown notes idempotently.
6. Any failure is logged and does not affect the reply.

## Backfill

The design must allow later backfill:

- load past chat history
- run improved extraction
- update the vault safely

Backfill is not required in this subproject, but the architecture should not block it.

## Success Criteria

- rich self-description messages update multiple memory files instead of a single preference field
- observations are stored separately from confirmed profile/preferences
- visible markdown files under the vault use Russian-only labels and headings
- chat replies continue to work even if the memory sidecar fails
- no duplicate note explosion for repeated topics
