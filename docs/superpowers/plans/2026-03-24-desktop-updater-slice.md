# Desktop Updater Slice

1. Add RED unit tests for updater state transitions and disabled-mode behavior.
2. Add RED renderer test for update controls on the Services page.
3. Implement an updater service around Electron `autoUpdater`.
4. Wire updater IPC in `main.ts` and expose it through preload.
5. Render update state and action buttons in the Services page.
6. Add release/update runbook and nginx sample config for hosting the feed.
7. Update stale project status docs to reflect the non-bootstrap state.
8. Run desktop tests, typecheck, package, and release `make`.
