# Squirrel Installer Branding Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Brand `KarpikSetup.exe` within the current Squirrel packaging stack by adding a custom setup icon and branded loading animation, then rebuild the installer and place it on the Desktop.

**Architecture:** Keep the existing Electron Forge + Squirrel packaging path. Add packaging-only assets under `desktop/build/`, wire them into `forge.config.ts`, and verify with a real `npm run make` build. Do not change installer technology or updater semantics.

**Tech Stack:** Electron Forge, maker-squirrel, Vite, Windows packaging assets, PowerShell/Python for asset generation if needed.

---

### Task 1: Add failing coverage for packaging branding config

**Files:**
- Create: `desktop/src/main/installerBranding.test.ts`
- Modify: `desktop/forge.config.ts`
- Test: `desktop/src/main/installerBranding.test.ts`

- [ ] **Step 1: Write the failing test**

Assert that the loaded Forge config includes `setupIcon` and `loadingGif` under the Squirrel maker, and that both files exist under `desktop/build/`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- installerBranding`
Expected: FAIL because assets/config wiring do not exist yet.

- [ ] **Step 3: Add minimal implementation**

Create packaging assets and wire them into the Squirrel maker config using exact relative paths.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- installerBranding`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop/build desktop/forge.config.ts desktop/src/main/installerBranding.test.ts
git commit -m "feat: brand squirrel installer assets"
```

### Task 2: Generate branded installer assets

**Files:**
- Create: `desktop/build/setup.ico`
- Create: `desktop/build/loading.gif`
- Optional Create: `desktop/build/branding/`

- [ ] **Step 1: Create setup icon**

Use `Desktop/new_design/design-logo.png` as the source mark and generate a Windows `.ico` asset with a dark branded background and good small-size readability.

- [ ] **Step 2: Create loading animation**

Generate a minimal dark branded GIF with centered logo and caption `Подготавливаем Karpik`.

- [ ] **Step 3: Sanity-check generated assets**

Run file inspection to confirm files exist, are non-empty, and live under `desktop/build/`.

- [ ] **Step 4: Commit**

```bash
git add desktop/build
git commit -m "feat: add branded installer media"
```

### Task 3: Rebuild and verify installer output

**Files:**
- Modify: `desktop/package.json` only if build wiring strictly requires it
- Output: `desktop/out/make/squirrel.windows/x64/KarpikSetup.exe`

- [ ] **Step 1: Run focused tests**

Run: `npm run test -- installerBranding`
Expected: PASS

- [ ] **Step 2: Run full desktop verification**

Run:
- `npm run test`
- `npm run typecheck`

Expected: PASS

- [ ] **Step 3: Build installer**

Run: `npm run make`
Expected: PASS and produce `KarpikSetup.exe`, `.nupkg`, and `RELEASES`.

- [ ] **Step 4: Place installer on Desktop**

Copy the generated `KarpikSetup.exe` to `C:\Users\TBG\Desktop\KarpikSetup.exe`.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "build: refresh branded installer artifact"
```
