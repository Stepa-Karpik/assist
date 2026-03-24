# Codex Patch Preview Design

## Goal

Add the first safe write-capable `codex` flow to `Karpik`: a Telegram task can
ask the desktop app to prepare file edits, but the real workspace is not
changed until a local user approves the preview in the GUI.

## Scope

This slice adds:

- a new task intent: `codex-write <prompt>`
- desktop execution in an isolated temp workspace with `codex exec --sandbox workspace-write`
- a persisted local approval queue with preview metadata
- local `Approve` / `Reject` actions in the desktop GUI
- task lifecycle transitions through `awaiting_local_approval`
- final completion or rejection delivery back to Telegram

This slice does not add:

- automatic write access without local approval
- multi-workspace routing
- chat-to-workspace mapping
- streaming codex output
- merge conflict resolution beyond simple drift detection

## Chosen Approach

The desktop app creates a temporary preview workspace under its runtime state
directory, copies the configured workspace into it, and runs `codex exec`
there in `workspace-write` mode.

If `codex` produces file changes:

- the desktop computes a change manifest
- builds a diff-like preview text
- moves the task to `awaiting_local_approval`
- shows the preview in the `Невыполненное` page

If the local user approves:

- the desktop verifies the original workspace still matches the recorded
  pre-change file hashes
- applies the staged file changes from the preview workspace into the real
  workspace
- marks the task as `done`

If the local user rejects:

- the desktop drops the preview workspace
- marks the task as `blocked`

This approach is preferred over direct writes because it preserves a concrete,
reviewable artifact and avoids re-running `codex` at approval time.

## Task Contract

Supported write intent:

- `codex-write <prompt>`

Examples:

- `codex-write add a compact README section for the Telegram task flow`
- `codex-write fix the failing desktop test and update the docs`

Rules:

- blank prompts are rejected
- the configured workspace root must exist
- `codex-write` is always treated as `high`
- if `codex-write` produces no file changes, the task completes immediately
  with the final `codex` message

Existing `codex <prompt>` stays read-only.

## Preview Artifact

For every pending local approval the desktop stores:

- `task_id`
- original workspace root
- preview workspace root
- codex summary text
- preview text for the GUI
- changed file list
- per-file pre-change hash for drift detection

The preview artifact is local-only and never sent to the server.

## Apply Semantics

Local approval must be safe against unrelated workspace edits.

Before applying a pending preview, the desktop re-reads every touched target
path in the original workspace:

- if the current file hash matches the recorded pre-change hash, apply is allowed
- if any touched path drifted, apply is rejected with a local error and the
  preview stays pending for manual rejection or later handling

The initial apply mode is file-level:

- copy added/modified files from preview workspace into the real workspace
- delete files that were removed in the preview

## Server Lifecycle

The server remains unaware of patch details, but gains explicit task
transitions:

- `running -> awaiting_local_approval`
- `awaiting_local_approval -> done`
- `running|awaiting_local_approval -> blocked`

When a locally rejected task is blocked, it should still fan out through the
existing Telegram delivery pipeline as a failure-style event.

## Desktop UI

`Невыполненное` becomes the local review surface for pending write previews.

For `awaiting_local_approval` tasks with a local preview artifact, show:

- summary text
- changed file list
- preview text
- `Approve` button
- `Reject` button

Tasks without a local preview artifact still render as plain blocked cards.

## Error Handling

Expected explicit failures:

- missing workspace root
- unavailable `codex` CLI
- codex timeout
- preview generation failure
- apply drift detected because the real workspace changed
- failed server transition while publishing local approval state

Any failure before the task reaches `awaiting_local_approval` should leave no
orphaned local preview artifact.

## Testing

- desktop unit tests for preview generation and manifest handling
- desktop unit tests for task runtime transition into `awaiting_local_approval`
- desktop unit tests for local approval store apply/reject behavior
- desktop UI tests for rendering and invoking local approval actions
- server tests for the new task lifecycle transitions

## Follow-Up

Later slices can extend this with:

- named workspaces
- diff rendering improvements
- selective file approval
- richer codex task typing
- PostgreSQL-backed task state
