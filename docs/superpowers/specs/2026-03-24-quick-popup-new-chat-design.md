# Quick Popup New Chat Design

## Goal

Make the quick popup header action actually useful by allowing the operator to
start a fresh local chat directly from the popup.

## Scope

- wire the existing `+` button to `createDesktopChat`
- refresh quick popup state after creation
- update the visible target chat in the popup

## Non-goals

- no chat rename/delete in this slice
- no target-chat picker in the popup
- no new backend APIs
