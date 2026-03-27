# Desktop Operator Preferences Design

## Goal

Make the desktop app behave like an always-on operator tool instead of a manually launched demo window.

This slice adds local-only desktop preferences for:

- launch at login
- start hidden in tray
- close main window to tray instead of quitting

## Scope

The slice is desktop-only:

- persisted preferences store
- IPC + settings UI
- Electron main process behavior wiring

Out of scope:

- notification preferences
- per-workspace launch behavior
- server-side awareness of desktop preferences

## Preferences

Store three boolean flags:

- `launchAtLogin`
- `startHiddenOnLaunch`
- `closeToTrayOnClose`

Defaults:

- `launchAtLogin = false`
- `startHiddenOnLaunch = true`
- `closeToTrayOnClose = true`

## Main Process Behavior

### Launch at login

Use Electron login item settings.

If `launchAtLogin` is enabled:

- enable login item launch
- if `startHiddenOnLaunch` is enabled, include `--start-hidden`

If `launchAtLogin` is disabled:

- disable login item launch

### Start hidden

If the process starts with `--start-hidden`, the main window should not auto-show on first ready event. Tray and quick popup still initialize normally.

### Close to tray

Closing the main window should hide it instead of quitting when:

- the user is not explicitly quitting the app
- `closeToTrayOnClose` is enabled

Quit from tray or OS shutdown should still exit normally.

## UI

Add a dedicated settings card for desktop operator behavior with three checkboxes and one save button.

The UI stays simple:

- load current preferences on settings page mount
- allow editing locally
- save through IPC

## Testing

- unit tests for the preferences store defaults, persistence, and login-item payload
- renderer test for settings UI load + save
- regression through desktop test/typecheck/package
