# Screenshot Delivery Design

## Goal

Add the first non-text remote capability: `screenshot`.

The target flow is:

1. Telegram submits `/task high screenshot`
2. Existing auth flow approves the task
3. Desktop captures the current screen locally
4. Server stores the task result plus a small image artifact payload
5. Bot delivers the result back to Telegram as a photo with a caption

## Scope

This slice is intentionally narrow:

- one new capability: `screenshot`
- one new artifact kind: base64 PNG image
- delivery only from desktop -> server -> Telegram

Out of scope:

- arbitrary file attachments
- multi-image results
- screenshot preview inside desktop UI
- long-term binary storage outside the task/delivery payloads

## Risk and Policy

Screen capture is sensitive. It must always be treated as `high` risk.

If Telegram submits `/task low screenshot` or `/task medium screenshot`, server policy escalates it to `high`. That keeps the current password + TOTP + confirm flow intact without inventing a second security path.

## Data Model

Add an optional task artifact payload:

- `artifact_kind`
- `artifact_mime_type`
- `artifact_file_name`
- `artifact_base64`

For this slice the only supported artifact is:

- `artifact_kind = "image_base64"`
- `artifact_mime_type = "image/png"`

The same optional fields live on both `TaskRecord` and `DeliveryEvent`, so the delivery path can stay simple.

## Desktop Execution

Desktop executor gets a new intent handler:

- `screenshot`

It captures the primary screen locally and returns:

- a short `resultText`
- a PNG artifact payload

The executor remains testable by allowing screenshot capture to be injected in tests.

## Server Flow

`/api/tasks/{task_id}/complete` accepts optional artifact fields together with `result_text`.

Task store persists them on the finished task record.
Delivery outbox copies them into the generated delivery event for Telegram-origin tasks.

## Bot Delivery

Bot delivery loop stops assuming text-only output.

If a delivery event has an image artifact, the bot sends:

- `send_photo(photo=..., caption=render_delivery_text(...))`

Otherwise it keeps the current `send_message` path.

## Testing

Add RED/GREEN coverage across all three layers:

- desktop executor captures screenshot artifact
- server policy escalates screenshot to `high`
- server delivery outbox preserves artifact fields
- bot delivery uses photo sending for image artifacts
