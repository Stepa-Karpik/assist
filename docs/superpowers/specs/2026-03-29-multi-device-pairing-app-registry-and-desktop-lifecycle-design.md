## Summary

This spec fixes two live regressions and defines the next stable architecture step for Karpik:

- `/pair` must stop depending on desktop-only transient state
- linked applications must save reliably and be visible to Telegram flows
- one shared server and one shared Telegram bot must support multiple local PCs, each with its own assistant context
- desktop startup and tray behavior must be reliable and user-configurable

The chosen direction is **multi-device tenancy**:

- one shared server
- one shared Telegram bot
- many local desktop clients
- each desktop client is identified by a `device_id`
- trust, pairing, tasks, app catalog, and presence are isolated by `device_id`

The desktop remains the owner of machine-local secrets and absolute launch paths. The server becomes the owner of all shared routing and trust decisions.

## Current problems

### `/pair` is too local

Current pairing is initiated on desktop and partly resolved through desktop-local memory. That creates several failures:

- trusted Telegram users are not a durable cross-system source of truth
- desktop restarts can invalidate effective trust state
- one server with multiple PCs cannot route pairing cleanly
- the bot has no canonical server-owned mapping from Telegram user to device

### Application registry appears unreliable

The local registry file persists on disk, but the product behavior is still wrong from the operator perspective:

- saving/removing linked apps is not consistently reflected in Telegram flows
- discovered apps and linked apps are mixed in a confusing way
- the server and bot do not have a clean, device-scoped application catalog as their source of truth

### Desktop lifecycle needs to be explicit

The intended behavior is:

- the app can auto-start with Windows
- the app can start hidden in the tray
- closing the main window may keep the process alive in tray
- only explicit exit should terminate the assistant process

This behavior already exists partially, but it must become a verified product contract, not an assumption.

## Goals

### Functional goals

- fix `/pair`
- fix linked application save/remove behavior
- support multiple local PCs on one shared server and one shared Telegram bot
- preserve one-assistant-per-PC behavior
- support desktop auto-start and tray lifecycle through app settings

### Product goals

- a user with one PC should not need to learn a more complex flow
- a user with multiple PCs should be able to target the correct device explicitly
- Telegram requests must always resolve to a single target `device_id`
- the desktop app must remain the owner of sensitive local-only data
- the desktop UI must hide infrastructure details that ordinary users do not need, such as server IPs, raw feed URLs, and internal identifiers

### Non-goals

- multi-user sessions inside one desktop client
- full SaaS-style organizations/accounts/teams
- changing local file/workspace ownership from desktop to server

## Chosen model

The unit of isolation is **device**, not account.

Each local desktop client is one assistant runtime and one `device_id`.

The server owns shared state for every device:

- pairing sessions
- trusted Telegram users per device
- Telegram user active/default device bindings
- task queues
- challenges
- presence
- public application catalog

The desktop owns machine-local state:

- password hash
- TOTP secret
- local workspaces
- local owner profile
- local cache and local chat history
- application launch paths and shortcut targets
- desktop behavior settings

## Data ownership

### Server-owned entities

#### `devices`

Fields:

- `device_id`
- `device_label`
- `owner_label`
- `status` (`online` or `offline`)
- `last_seen_at`
- `created_at`
- `updated_at`

Purpose:

- canonical registry of assistant runtimes known to the server
- base anchor for all other scoped state

#### `device_trust`

Fields:

- `device_id`
- `telegram_user_id`
- `created_at`
- `granted_via` (`pairing`)

Purpose:

- canonical answer to "which Telegram users may operate this device"

#### `telegram_device_bindings`

Fields:

- `telegram_user_id`
- `active_device_id`
- `updated_at`

Purpose:

- default routing target for ordinary Telegram messages
- avoids forcing single-device users to specify a target every time

#### `pairing_sessions`

Fields:

- `device_id`
- `code`
- `status`
- `expires_at`
- `created_at`

Purpose:

- authoritative active pairing window for one device

#### `tasks`, `challenges`, `deliveries`, `presence`, `app_catalog`

All of these become strictly `device_id` scoped.

`app_catalog` stores **public metadata only**:

- `device_id`
- `app_id`
- `display_name`
- `aliases`
- `linked`
- `source`

It must not store absolute desktop launch paths.

### Desktop-owned entities

#### Local auth state

- password hash
- TOTP secret

Never moved to server.

#### Local app registry

Fields remain local:

- `appId`
- `displayName`
- `launchPath`
- `aliases`
- `linked`
- `source`

Desktop publishes a **filtered public catalog** to server after every effective change.

#### Desktop behavior settings

- `launchAtLogin`
- `startHiddenOnLaunch`
- `closeToTrayOnClose`
- notification preferences

These remain local and are not server-synced.

## Pairing design

### New source of truth

Pairing becomes **server-owned**.

Desktop still generates the pairing code locally, but that code is immediately published to the server as the active pairing session for the current `device_id`.

The authoritative pairing lifecycle is then managed on the server.

### Open pairing flow

1. Desktop opens a local pairing session and shows the code in UI.
2. Desktop calls server `pairing/open` with:
   - `device_id`
   - `code`
   - `expires_at`
3. Server stores the session as the active pairing session for that device.

### `/pair` flow

1. Telegram user sends `/pair <code>`.
2. Bot sends the code and Telegram identity to server.
3. Server resolves the active pairing session by code.
4. If valid:
   - server writes `device_trust`
   - server writes `telegram_device_bindings.active_device_id` if none exists yet, or updates it to the newly paired device
5. Desktop later refreshes trust state from server and updates local UI display.

### Result

The desktop UI no longer depends on its own in-memory trusted-user set to be correct.

`/pair` becomes stable across:

- desktop restarts
- multiple devices
- one shared bot

## Application registry design

### Local registry remains local

Desktop keeps the full launchable registry with local absolute paths.

That is the only safe place for:

- `.exe` paths
- `.lnk` targets
- machine-specific discovery results

### Published server catalog

After local save/remove/discovery refresh, desktop pushes a public catalog for its own `device_id`.

This published catalog contains only:

- `appId`
- `displayName`
- `aliases`
- `linked`
- `source`

### Operator expectations

The product behavior must become:

- saving a linked application updates the local registry immediately
- the linked application appears in `/apps` for that device
- removing a linked application removes it from `/apps` for that device
- discovered-but-unlinked apps remain available as Telegram selection candidates only when the routing flow needs suggestions

### UX requirement

The GUI must make the distinction obvious:

- **linked apps** are explicit operator-approved aliases
- **discovered apps** are suggestions/candidates, not active linked commands

## Bot routing design

### Device resolution

Every user-originated Telegram request must resolve to exactly one target `device_id`.

Resolution order:

1. explicit device override in pending flow, if any
2. user’s `active_device_id`
3. if user has exactly one trusted device, use it automatically
4. otherwise prompt user to choose a device

### Multi-device support

The first milestone does not require a complex device management UI in Telegram, but it must support:

- `/devices`
- `/use <device>`

Single-device users should not need to use either.

### Operator commands

The following bot features become device-aware:

- `/pair`
- `/apps`
- ordinary task messages
- `/status`
- `/queue`
- `/pc`
- `/device`
- auth and challenge flows

## Desktop lifecycle design

### Autostart

When `launchAtLogin = true`, desktop registers itself in Windows login items.

When false, it unregisters itself.

This must be verified as real behavior, not only a saved toggle.

### Start hidden

When `startHiddenOnLaunch = true`, desktop starts without showing the main window and stays available in tray.

### Close to tray

When `closeToTrayOnClose = true`, closing the main window hides it but does not terminate the process.

### Real exit

The assistant process must terminate only on explicit exit:

- tray “Exit”
- explicit quit action
- Windows shutdown/logoff

This preserves background sync and Telegram responsiveness without forcing the user to keep the main window open.

## UI visibility rules

Technical infrastructure details must be hidden from ordinary product surfaces by default.

Examples of data that should not be shown in normal UI:

- raw server IP or base URL
- update feed URL
- internal API prefixes
- low-level device identifiers unless the user is explicitly selecting between devices

Allowed exceptions:

- debug-oriented logs
- developer-only troubleshooting views
- explicit device-selection UX where a human-readable device label is primary and `device_id` is secondary or hidden

The practical rule is:

- user-facing screens should speak in product terms such as "server online", "desktop connected", "updates available", and "this PC"
- infrastructure coordinates should stay out of the visible UI unless they are strictly required for troubleshooting

## Compatibility and migration

### Existing local installs

On first launch after migration:

- desktop registers its `device_id` with server
- desktop publishes current public app catalog
- desktop continues using existing local secrets and preferences unchanged

### Pairing migration

Existing users should be expected to pair once again after the migration.

This is acceptable and preferable to keeping compatibility with the old fragile trust model.

### Single-device users

Current users with one device should see almost no workflow change:

- pair once
- then send tasks as usual

The server will resolve their default device automatically.

## Error handling

### Pairing

If pairing session publish fails:

- desktop closes the newly opened local pairing session
- UI shows a clear error
- no half-open session remains in UI

If `/pair` cannot resolve a valid device:

- bot returns the existing invalid-code style response
- no trust record is created

### App catalog sync

If local save succeeds but server catalog sync fails:

- local state remains saved
- GUI shows a sync error
- desktop retries catalog sync in background or on next relevant lifecycle refresh

The operator must not lose local changes because of transient server errors.

### Device routing

If a Telegram user has multiple trusted devices and no active device binding:

- bot must ask for device selection instead of guessing

## Acceptance criteria

### Pairing

- opening pairing from desktop creates a server-visible device-scoped pairing session
- `/pair <code>` creates durable trust for exactly one `device_id`
- desktop restart does not silently discard effective trust

### Linked apps

- saving a linked app persists locally
- saving a linked app updates server public catalog
- `/apps` shows linked apps for the resolved target device
- removing a linked app removes it from `/apps` for that device

### Multi-device

- one shared server can track multiple active desktop devices
- one Telegram user can pair with more than one device
- ordinary messages route to the user’s active/default device
- device ambiguity results in explicit selection, not silent misrouting

### Desktop lifecycle

- enabling autostart causes desktop to launch with Windows
- disabling autostart stops that behavior
- `startHiddenOnLaunch` starts the app in tray
- `closeToTrayOnClose` hides instead of quitting
- explicit exit still fully terminates the process

## Rollout plan

### Milestone 1

- repair pairing with server-owned device trust
- repair linked app save/remove and public catalog sync
- verify desktop autostart and tray lifecycle

### Milestone 2

- add `/devices`
- add `/use <device>`
- complete multi-device operator routing UX

### Milestone 3

- optional future product polish for richer multi-device administration
