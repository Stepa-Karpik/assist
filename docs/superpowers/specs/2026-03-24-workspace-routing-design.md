# Workspace Routing Design

## Goal

Add multiple named `codex` workspaces and local Telegram chat routing so each
Telegram conversation can run `codex` and `codex-write` tasks against the
correct local project root.

## Scope

This slice adds:

- a local registry of named workspaces
- one default workspace
- local `chat_id -> workspace_id` bindings
- desktop-side workspace resolution for `codex` and `codex-write`
- GUI management in `Настройки` and `Чаты Telegram`

This slice does not add:

- server-side knowledge of workspace identities
- Telegram commands that select a workspace explicitly
- per-task workspace overrides in the message text
- cross-device workspace sync

## Chosen Approach

Workspace routing stays fully local on the desktop.

The server continues to store only Telegram metadata that already exists:

- `chat_id`
- `telegram_user_id`
- task `intent`

The desktop resolves the effective workspace when it executes a `codex` or
`codex-write` task:

- if the Telegram chat has a local binding, use that workspace
- otherwise use the default workspace
- local desktop-origin tasks also use the default workspace

This is the right approach because workspace roots are local machine concerns,
not server concerns. Sending workspace names through the server would add a new
distributed contract without giving the server anything useful to do with it.

## Local Settings Model

`codex.json` evolves from one path into three fields:

- `workspaces`
- `defaultWorkspaceId`
- `chatBindings`

Each workspace entry contains:

- `id`
- `name`
- `rootPath`

Rules:

- at least one workspace always exists
- the first bootstrapped workspace is `Default`
- removing a workspace also clears bindings that pointed to it
- missing or invalid bindings fall back to the default workspace

## Migration

Existing installs may already have the old single-root config:

- `workspaceRoot`

That config is migrated on load into:

- one workspace named `Default`
- `defaultWorkspaceId` pointing to it
- empty `chatBindings`

This keeps current users working without manual cleanup.

## Routing Rules

Routing applies only to:

- `codex <prompt>`
- `codex-write <prompt>`

All existing safe file operations keep their current runtime root behavior.

Resolution order:

1. Telegram task with bound chat -> bound workspace
2. Telegram task without binding -> default workspace
3. Desktop-origin task -> default workspace

If the resolved workspace path does not exist, the task fails with the existing
explicit workspace error.

## Desktop UI

### Settings

`Настройки` becomes the place where the user manages the workspace registry:

- list existing workspaces
- edit workspace name
- edit workspace root path
- add a workspace
- remove a non-default workspace
- pick the default workspace

This remains a local-only settings surface.

### Telegram Chats

`Чаты Telegram` becomes the place where the user maps chats to workspaces.

For each seen Telegram chat:

- show `chat_id`
- show the latest task status
- show the current resolved workspace
- show a selector with available workspaces
- save the binding locally

The page does not need full message history yet; it only needs enough chat
context to make workspace routing understandable and controllable.

## Data Flow

1. Telegram creates a task as before.
2. Server keeps only the existing task metadata.
3. Desktop polling receives the queued task.
4. Executor resolves the workspace from local codex settings plus `chat_id`.
5. `codex` or `codex-write` runs in that workspace.

No server API changes are required for the routing itself.

## Error Handling

Expected explicit failures:

- binding references a removed workspace -> fallback to default
- default workspace id is invalid -> first valid workspace becomes default
- resolved workspace path missing -> existing workspace missing error
- no Telegram tasks yet for a chat mapping view -> show empty state

## Testing

- desktop store tests for migration, workspace CRUD normalization, and binding cleanup
- desktop executor tests for routing `codex` tasks by `chat_id`
- desktop UI tests for settings workspace management
- desktop UI tests for saving a Telegram chat binding

## Follow-Up

Later slices can build on this with:

- workspace badges in local approval previews
- Telegram-side workspace hints
- chat continuation into local desktop chats with the same workspace context
- persisted local chat memory per workspace
