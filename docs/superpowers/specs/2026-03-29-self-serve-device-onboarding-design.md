## Summary

This spec upgrades the new multi-device architecture into a real self-serve onboarding flow:

- a user downloads the desktop client on a new PC
- the client generates and persists its own `device_id`
- the user does not configure `KARPIK_DEVICE_ID`
- the user completes a first-run onboarding wizard before entering the main app
- the primary Telegram linking path is a `t.me` deep link using a short-lived onboarding token
- `/pair <code>` remains as a fallback path

The system still uses:

- one shared server
- one shared Telegram bot
- many local desktop clients

The key change is that device registration becomes automatic and Telegram linking becomes part of a guided first-run experience.

## Current problems

### New devices are not self-serve

The current multi-device work still assumes too much operator setup for a new PC:

- `device_id` is still injected from environment
- a new install cannot become a cleanly registered device by itself
- pairing assumes an already prepared runtime

### User-facing onboarding is incomplete

A fresh install can open the app, but the product does not yet enforce the required first-run steps:

- collect owner profile
- register this PC as a distinct device
- link Telegram to this device
- configure local security

### The current `/pair` flow is not the best first-run UX

Manual `/pair <code>` works as a fallback, but it is not the ideal primary path for consumer-like onboarding. A `t.me/...start=pair_<token>` flow is cleaner and avoids forcing the user to manually copy a code when deep linking is available.

## Goals

### Functional goals

- remove `KARPIK_DEVICE_ID` from the normal product path
- generate and persist a unique `device_id` locally on first launch
- register that device on the shared server automatically
- block access to the main app until onboarding completes
- make Telegram linking work through a deep link first and `/pair` second
- persist owner profile data from onboarding
- keep existing installs working through a migration path

### Product goals

- a new user should not need technical setup instructions
- device identity must be invisible as a technical concern
- the onboarding flow should speak in product language, not infrastructure language
- the main app should open only after the PC is linked to Telegram and minimally configured

### Non-goals

- removing the existing `/pair <code>` fallback
- replacing local ownership of password hash, TOTP secret, workspaces, or local app launch paths
- full account/organization/team management

## Chosen model

### Device identity

Each desktop client owns a local persistent device identity record:

- `deviceId`
- `deviceLabel`
- `createdAt`

`deviceId` is generated once and stored locally. It is never entered manually by the user.

`deviceLabel` defaults to the machine hostname and can be edited during onboarding.

### Onboarding gate

The first-run desktop experience becomes a gated wizard. Until onboarding is complete, the user does not enter the main shell.

Wizard stages:

1. owner profile
2. device name confirmation
3. Telegram linking
4. local security bootstrap
5. completion

### Telegram linking

Primary path:

- desktop asks server for a short-lived onboarding token for this `device_id`
- desktop shows a button that opens:
  - `https://t.me/<bot>?start=pair_<token>`
- the bot consumes the token and links the Telegram user to this device

Fallback path:

- desktop can also open a regular pairing session and show a short-lived code
- the user can still send `/pair <code>`

## Data ownership

### Server-owned data

#### `devices`

Fields:

- `device_id`
- `device_label`
- `owner_profile_summary`
- `created_at`
- `updated_at`
- `last_seen_at`

The server becomes the authoritative list of registered devices.

#### `onboarding_tokens`

Fields:

- `token`
- `device_id`
- `expires_at`
- `created_at`
- `consumed_at`

These tokens are used only for Telegram deep-link pairing.

#### `device_trust`

Same as in the multi-device spec, but new devices can now create their trust relation through deep-link onboarding as well as `/pair`.

### Desktop-owned data

#### `deviceIdentityStore`

Fields:

- `deviceId`
- `deviceLabel`
- `createdAt`

This is the local stable identity for the machine.

#### `ownerProfileStore`

Still local, but onboarding requires a minimal subset before entry into the main shell.

Minimum required:

- full name
- gender
- age

Optional:

- city
- contacts
- notes

#### Local auth/workspace/app settings

Remain local exactly as before.

## Desktop onboarding flow

### Step 1: Generate or load local device identity

On startup:

- if local device identity exists, load it
- otherwise generate:
  - `deviceId = "device-" + uuid`
  - `deviceLabel = hostname`
  - `createdAt = now`

### Step 2: Register device with server

Desktop calls a registration endpoint with:

- `device_id`
- `device_label`
- owner profile summary if already available

The server:

- creates the device if missing
- updates its human metadata if it already exists
- returns the current server-side view of the device

### Step 3: Decide whether onboarding is complete

Desktop considers onboarding complete only if all are true:

- required owner profile fields exist
- the device is linked to at least one trusted Telegram user
- local password is configured
- local TOTP is configured

If not complete, the wizard is shown instead of the main app.

### Step 4: Link Telegram

Primary path:

- desktop requests a short-lived onboarding token
- desktop displays a call to action:
  - "Open Telegram"
- the generated URL opens the shared bot with `start=pair_<token>`

Fallback path:

- desktop opens a pairing code
- user sends `/pair <code>`

### Step 5: Configure local security

During wizard completion, the user must set:

- password
- TOTP

This preserves the current local-only secret model.

## Bot behavior

### `/start pair_<token>`

The bot must:

- detect a `pair_<token>` payload
- send token to server
- if token is valid:
  - link current `telegram_user_id` to the device
  - set the device as active/default for this Telegram user
  - acknowledge success in Russian
- if token is invalid or expired:
  - show a clear Russian error

### `/pair <code>`

Remains the fallback pairing mechanism.

### Normal post-onboarding behavior

Once linked, the rest of the device-aware routing remains unchanged:

- active device resolution
- `/devices`
- `/use`
- task routing

## API changes

### `POST /api/devices/register`

Purpose:

- create or refresh a device record from desktop

Input:

- `device_id`
- `device_label`
- `owner_profile_summary`

Output:

- canonical registered device record

### `GET /api/devices/{device_id}/onboarding`

Purpose:

- return current onboarding status for this device

Output:

- `device_registered`
- `trusted_telegram_user_count`
- `password_configured`
- `totp_configured`
- `owner_profile_complete`
- `completed`

### `POST /api/devices/{device_id}/onboarding-token`

Purpose:

- mint short-lived Telegram deep-link token

Output:

- `token`
- `expires_at`
- `start_link`

### `POST /api/bot/start-link`

Purpose:

- consume onboarding token from Telegram `/start`

Input:

- `token`
- `telegram_user_id`

Output:

- `device_id`
- `device_label`
- `paired`

## Migration

### Existing installs

On first launch after this change:

- desktop creates a local device identity if missing
- if an old env-provided `device_id` had been used before, it is ignored in the new product path
- server registration happens automatically
- existing owner profile, local auth, and workspaces are preserved

### Existing Telegram users

If a device already has trust on the server, onboarding should be considered complete once the remaining required local profile/security fields are satisfied.

Existing users should not be forced to re-pair if the server already knows the device trust.

## Error handling

### Deep-link unavailable

If the Telegram deep link cannot be opened:

- desktop keeps showing the fallback `/pair <code>` path
- onboarding continues after successful fallback pairing

### Token expired

If the onboarding token expires:

- desktop requests a new token
- the UI shows a clear retry path

### Registration failure

If device registration fails:

- main shell remains blocked
- onboarding shows a retryable error
- no partial completion is recorded

## Acceptance criteria

- a fresh desktop install generates its own stable `device_id`
- the user never manually configures `device_id`
- the desktop registers itself with the server
- the main app stays locked until onboarding completes
- Telegram deep-link pairing succeeds through `/start pair_<token>`
- `/pair <code>` still works as fallback
- existing users migrate without losing local settings
- multiple unrelated users can install the same desktop build and use the same server and bot independently
