# 2026-03-24 Local Chat Artifacts Slice

1. Add RED coverage for:
   - artifact persistence in `localChatStore`
   - artifact propagation in `localChatRuntime`
   - screenshot preview rendering in `App` chat flow
2. Extend local chat message model with optional artifact fields.
3. Pass successful executor artifacts into assistant messages.
4. Render `image_base64` previews in `ChatsPage`.
5. Verify with:
   - `desktop`: `npm run test`
   - `desktop`: `npm run typecheck`
   - `desktop`: `npm run package`
