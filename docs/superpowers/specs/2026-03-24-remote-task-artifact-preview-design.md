# Remote Task Artifact Preview

## Goal

Show remote task artifacts inside the desktop operator UI so the human can
review screenshots and other result media without leaving the app.

## Scope

- Render task artifacts from the shared task snapshot.
- Start with `image_base64`, which is the only artifact kind currently
  supported end-to-end.
- Show previews in:
  - `Чаты Telegram`
  - `Невыполненное`

## Intended Behavior

- When a task snapshot item contains an image artifact, the desktop UI renders
  an inline preview and optional file name.
- Artifact previews appear alongside the existing textual result/error status.
- Tasks without artifacts render exactly as before.
- Local chat artifact rendering remains unchanged; this slice only extends the
  remote-task views.

## Non-Goals

- No new artifact transport format.
- No download/export flow.
- No video/audio/document preview support in this slice.
