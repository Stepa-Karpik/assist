# Codex Read-Only Executor Design

## Goal

Add the first real `codex` capability to `Karpik`: a Telegram task can ask the
desktop app to run `codex exec` against a configured local workspace and return
the final text result back to Telegram.

This slice is intentionally read-only. The point is to prove the local
`codex` integration path without opening remote write access yet.

## Scope

This slice adds:

- a local desktop setting for `codex workspace root`
- a new allowlisted task intent: `codex <prompt>`
- task policy escalation so `codex` requests are always treated as `high`
- desktop execution through `codex exec`
- result delivery through the existing task and Telegram delivery pipeline

This slice does not add:

- automatic file edits through `codex`
- patch/apply flows
- multiple workspaces
- per-chat workspace routing
- streaming output

## Chosen Approach

The desktop app owns the `codex` execution. The server and bot stay unaware of
the `codex` process details and keep treating it as another typed task.

The desktop executor will spawn:

- `codex exec`
- `--ephemeral`
- `--skip-git-repo-check`
- `--sandbox read-only`
- `--full-auto`
- `-C <workspaceRoot>`
- `<prompt>`

Read-only mode is the right first step because:

- it keeps remote Telegram usage inside a safer boundary
- it avoids mixing `codex` editing semantics with the existing safe file ops
- it gives a working "ask the local repo / workspace" loop immediately

## Local Settings

Desktop stores a small local JSON config for codex execution:

- `workspaceRoot: string`

Default:

- `%APPDATA%\\Karpik\\docs\\user`

Rules:

- blank input falls back to the default workspace
- the GUI can overwrite the path
- the executor checks that the path exists before invoking `codex`

## Task Contract

Supported intent:

- `codex <prompt>`

Examples:

- `codex summarize the latest failing tasks`
- `codex inspect docs/notes and tell me what changed`

Rules:

- empty prompt is rejected
- non-`codex` intents keep existing behavior
- `codex` results are trimmed to the existing maximum result length

## Policy

Any `codex` intent is escalated to `high`, regardless of the requested risk.

Reason:

- it exposes local workspace contents to Telegram
- it launches a powerful local agent
- we already have the `password -> totp -> confirm` path for this risk level

## Execution Semantics

Success:

- desktop returns the last `codex` message as task `result_text`

Failure:

- missing workspace path -> explicit error
- missing `codex` CLI -> explicit error
- timeout -> explicit error
- non-zero exit -> trimmed stderr or generic codex failure

The executor remains one-shot and synchronous inside the existing task polling
cycle.

## UI

Settings page gets a new section:

- current workspace root
- editable text input
- save button

No extra navigation is required in this slice.

## Testing

- desktop unit tests for local codex settings persistence
- desktop unit tests for `codex` intent parsing and error paths
- desktop unit tests for task policy escalation through the server API
- desktop UI test for saving the codex workspace path

## Follow-Up

Later slices can build on this with:

- write-enabled `codex` tasks
- patch preview / local approval
- multiple named workspaces
- chat-to-workspace mapping
