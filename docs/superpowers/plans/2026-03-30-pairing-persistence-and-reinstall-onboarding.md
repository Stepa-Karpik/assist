# Pairing Persistence and Reinstall Onboarding Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make pairing server-owned and durable per PC, preserve pairing across reinstall, and re-show onboarding after reinstall without creating a new device.

**Architecture:** Introduce a durable local device identity store, move pairing code validation fully to the server, and add a separate onboarding state gate that can reset independently from the device identity. The desktop renderer will show onboarding until installation setup is complete, while server trust remains tied to the stable `device_id`.

**Tech Stack:** Electron, React, TypeScript, FastAPI, Python, Vitest, Pytest

---

### Task 1: Durable Device Identity Store

**Files:**
- Create: `desktop/src/main/deviceIdentityStore.ts`
- Test: `desktop/src/main/deviceIdentityStore.test.ts`
- Modify: `desktop/src/main/main.ts`

- [ ] **Step 1: Write the failing test**

Add tests that prove:
- first load creates a stable non-empty `device_id`
- second load from the same root returns the same `device_id`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- deviceIdentityStore`
Expected: FAIL because the store does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement a small JSON-backed store under the existing desktop data root that:
- loads `device-identity.json`
- generates a UUID-like id if missing
- persists it immediately

- [ ] **Step 4: Wire `main.ts` to use the store**

Replace normal runtime reads of `process.env.KARPIK_DEVICE_ID ?? "desktop-local"` with the store-backed value.

- [ ] **Step 5: Run tests to verify it passes**

Run: `npm run test -- deviceIdentityStore`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add desktop/src/main/deviceIdentityStore.ts desktop/src/main/deviceIdentityStore.test.ts desktop/src/main/main.ts
git commit -m "feat: add durable desktop device identity"
```

### Task 2: Server-Owned Pairing Session

**Files:**
- Modify: `server/app/models/pairing.py`
- Modify: `server/app/api/pairing.py`
- Modify: `server/app/services/pairing_store.py`
- Test: `server/tests/test_pairing_api.py`
- Modify: `desktop/src/main/syncClient.ts`
- Modify: `desktop/src/main/pairingStore.ts`
- Modify: `desktop/src/main/main.ts`
- Test: `desktop/src/main/pairingStore.test.ts`
- Test: `desktop/src/main/syncClient.test.ts`

- [ ] **Step 1: Write failing server tests**

Add tests for:
- opening a pairing session with `{ device_id, code, expires_at }`
- reading pairing state by `device_id`
- resolving pair attempt entirely from server state

- [ ] **Step 2: Run server tests to verify they fail**

Run: `..\server\.venv\Scripts\python.exe -m pytest server/tests/test_pairing_api.py -q`
Expected: FAIL

- [ ] **Step 3: Implement minimal server changes**

Add `code` to pairing session payload/model and add a read endpoint for pairing state.

- [ ] **Step 4: Write failing desktop tests**

Add tests proving:
- desktop open pairing sends the local code to the server
- local pairing state no longer owns the trusted-user truth

- [ ] **Step 5: Run desktop tests to verify they fail**

Run: `npm run test -- pairingStore syncClient`
Expected: FAIL

- [ ] **Step 6: Implement minimal desktop changes**

Make pairing store a UI cache around server-backed session data.

- [ ] **Step 7: Run focused tests**

Run:
- `npm run test -- pairingStore syncClient`
- `..\server\.venv\Scripts\python.exe -m pytest server/tests/test_pairing_api.py -q`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add server/app/models/pairing.py server/app/api/pairing.py server/app/services/pairing_store.py server/tests/test_pairing_api.py desktop/src/main/syncClient.ts desktop/src/main/pairingStore.ts desktop/src/main/main.ts desktop/src/main/pairingStore.test.ts desktop/src/main/syncClient.test.ts
git commit -m "feat: move pairing state fully to server"
```

### Task 3: Reinstall-Friendly Onboarding Gate

**Files:**
- Create: `desktop/src/main/onboardingStateStore.ts`
- Test: `desktop/src/main/onboardingStateStore.test.ts`
- Modify: `desktop/src/main/main.ts`
- Modify: `desktop/src/preload/index.ts`
- Modify: `desktop/src/renderer/window.d.ts`
- Modify: `desktop/src/renderer/App.tsx`
- Test: `desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Write failing tests**

Add tests proving:
- onboarding appears when installation onboarding state is incomplete
- onboarding can be completed without changing the durable `device_id`
- onboarding can be shown again while pairing stays intact

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- App onboarding`
Expected: FAIL

- [ ] **Step 3: Implement the onboarding state store**

Track install-level onboarding completion separately from device identity.

- [ ] **Step 4: Implement renderer gating**

Route `App.tsx` through onboarding until local setup is complete.

- [ ] **Step 5: Run focused tests**

Run: `npm run test -- App onboarding`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add desktop/src/main/onboardingStateStore.ts desktop/src/main/onboardingStateStore.test.ts desktop/src/main/main.ts desktop/src/preload/index.ts desktop/src/renderer/window.d.ts desktop/src/renderer/App.tsx desktop/src/renderer/App.test.tsx
git commit -m "feat: add reinstall-safe onboarding gate"
```

### Task 4: Pairing UX Integration

**Files:**
- Modify: `desktop/src/renderer/pages/SettingsPage.tsx`
- Modify: `bot/app/handlers/pair.py`
- Modify: `bot/app/handlers/start.py`
- Modify: `bot/app/pairing_client.py`
- Test: `bot/tests/test_pair.py`
- Test: `bot/tests/test_start.py`

- [ ] **Step 1: Write failing bot tests**

Cover:
- `/pair <code>` against server-owned session
- `/start pair_<token>` mapping into pairing flow

- [ ] **Step 2: Run tests to verify they fail**

Run: `..\server\.venv\Scripts\python.exe -m pytest bot/tests/test_pair.py bot/tests/test_start.py -q`
Expected: FAIL

- [ ] **Step 3: Implement minimal bot changes**

Keep `/pair` stable and add the deep-link start path.

- [ ] **Step 4: Update desktop settings messaging**

Show server-backed trust count and accurate onboarding/pairing guidance.

- [ ] **Step 5: Run focused tests**

Run:
- `..\server\.venv\Scripts\python.exe -m pytest bot/tests/test_pair.py bot/tests/test_start.py -q`
- `npm run test -- App`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add bot/app/handlers/pair.py bot/app/handlers/start.py bot/app/pairing_client.py bot/tests/test_pair.py bot/tests/test_start.py desktop/src/renderer/pages/SettingsPage.tsx
git commit -m "feat: align bot pairing and onboarding guidance"
```

### Task 5: Full Verification and Installer Refresh

**Files:**
- Modify: `desktop/package.json`
- Modify: `desktop/package-lock.json`

- [ ] **Step 1: Run full desktop verification**

Run:
- `npm run test`
- `npm run typecheck`

Expected: PASS

- [ ] **Step 2: Run full backend verification**

Run:
- `..\server\.venv\Scripts\python.exe -m pytest server/tests -q`
- `..\server\.venv\Scripts\python.exe -m pytest bot/tests -q`

Expected: PASS

- [ ] **Step 3: Bump desktop version if needed**

Update `desktop/package.json` and `desktop/package-lock.json` so the installer supersedes the previous build.

- [ ] **Step 4: Build installer**

Run: `npm run make`
Expected: PASS and fresh `desktop/out/make/squirrel.windows/x64/KarpikSetup.exe`

- [ ] **Step 5: Copy installer to Desktop**

Copy the new `KarpikSetup.exe` to `C:\Users\TBG\Desktop\KarpikSetup.exe`

- [ ] **Step 6: Commit**

```bash
git add desktop/package.json desktop/package-lock.json
git commit -m "chore: bump desktop version for pairing persistence release"
```
