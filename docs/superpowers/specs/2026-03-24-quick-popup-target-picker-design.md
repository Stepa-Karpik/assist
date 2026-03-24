# Quick Popup Target Picker Design

## Goal

Let the operator choose which local chat receives a quick popup request.

## Scope

- expose recent local chats in quick access state
- allow quick popup to choose the target chat
- preserve current fallback behavior when no explicit target is chosen

## Behavior

- if a target chat is selected, `submitQuickRequest` sends into that chat
- if no target is selected, the current most recent chat stays the default
- if there are no chats yet, the existing auto-create behavior remains

## Non-goals

- no search UI in the picker
- no pinning/favorites
- no remote chat selection in this slice
