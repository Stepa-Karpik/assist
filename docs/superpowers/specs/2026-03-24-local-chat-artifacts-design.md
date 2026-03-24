# 2026-03-24 Local Chat Artifacts Design

## Goal

Make local desktop chats show binary task results, starting with screenshot
artifacts returned by the local executor.

## Scope

- persist optional artifact metadata on local chat messages
- attach executor artifacts to successful assistant messages
- render image previews in `Чаты`

## Rules

- first supported artifact kind is `image_base64`
- screenshot results still keep their text summary
- artifact preview is local-only; this slice does not change Telegram delivery

## Out of Scope

- arbitrary file downloads
- rich artifact galleries
- artifact support in quick popup or activity log
