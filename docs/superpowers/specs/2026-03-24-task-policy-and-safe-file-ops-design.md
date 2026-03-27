# Task Policy And Safe File Ops Design

Date: 2026-03-24

## Goal

Harden remote task intake so Telegram cannot under-declare task risk, and expand
the safe executor with a small set of useful file operations.

## Chosen Approach

Use a server-side minimum-risk classifier plus desktop-side execution for a small
allowlist of capabilities.

Rejected alternatives:

- typed Telegram command grammar first: cleaner long-term, but too much surface
  change for one slice
- desktop-only classification: unsafe because risk gating must happen before the
  task reaches the executor

## Core Rules

- the server computes `effective risk = max(user risk, minimum risk for intent)`
- the desktop executor only runs allowlisted intents
- unknown intents are treated as `high`
- write operations are never `low`

## Intent Policy

### Low

- `status`
- `read <relative-path>`
- `list <relative-path>`

These remain constrained to the runtime `docs/user` subtree.

### Medium

- `write-note <name> :: <content>`

This writes a text note only under:

- `%APPDATA%\\Karpik\\docs\\user\\docs\\notes`

The filename is normalized to a simple basename and must not escape the notes folder.

### High

- any unsupported or unknown remote intent

For now, unsupported intents still fail in the executor after auth. The goal of
this slice is to prevent low-risk bypasses before a richer policy engine exists.

## Architecture

### Server responsibilities

- classify task intent before auth gating
- escalate the task risk when the declared risk is too low
- preserve the existing challenge flow using the escalated risk

### Desktop responsibilities

- implement `list`
- implement `write-note`
- keep strict path normalization and allowlist checks

### Bot responsibilities

- no command-shape change in this slice
- existing `/task low|medium|high ...` flow stays intact
- auth prompts automatically reflect the escalated effective risk

## Message And Result Shape

### `list`

Returns a short newline-delimited list of entries in the requested directory.

### `write-note`

Returns the final note path under `docs/user/docs/notes`.

If a note cannot be written, return a short explicit error message.

## Error Handling

- path traversal is rejected
- invalid note names are rejected
- large note content is accepted, but result text stays short
- unsupported intents still fail with `Unsupported task intent.`

## Testing Strategy

- server tests for risk escalation and auth behavior
- desktop tests for `list` and `write-note`
- full desktop/server/bot regression run afterward

## Non-Goals

- a full task DSL
- per-intent concurrency control
- risk policy persistence
- binary file writes
- screenshot delivery
