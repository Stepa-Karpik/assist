# Capability Help Design

## Goal

Expose the currently supported task formats directly in the product so the user
does not need to infer capabilities from code or old notes.

## Scope

- add `/help` to the Telegram bot
- update `/start` to point users to `/help`
- show supported task examples in desktop settings

## Supported commands to surface

- `/pair <code>`
- `/task low status`
- `/task low screenshot`
- `/task low read docs/notes/<file>`
- `/task low list docs/notes`
- `/task low write-note <name> :: <text>`
- `/task high codex <prompt>`
- `/task high codex-write <prompt>`
- `/status [task_id]`
- `/auth <value>`
- `/confirm`
- `/decline`

## UI/UX

The help text should be concise and action-oriented, not a long manual.

Desktop settings should show a compact card with example intents and a short
note that `codex` and `codex-write` are always treated as high-risk tasks.

## Non-goals

- no parser changes for new task types
- no localization cleanup in this slice
- no markdown-rich help renderer
