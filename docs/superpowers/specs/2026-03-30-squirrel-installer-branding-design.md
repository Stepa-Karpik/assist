# Squirrel Installer Branding Design

Date: 2026-03-30

## Goal

Improve the visual quality of `KarpikSetup.exe` within the limits of the current `Electron Forge + Squirrel` packaging stack, without migrating installer technology and without breaking the existing update flow.

## Constraints

- The current Windows installer is built with `@electron-forge/maker-squirrel`.
- Squirrel does not support a fully custom installer UI with bespoke layouts, controls, or multi-step branded screens.
- The work must stay compatible with the current `RELEASES + .nupkg` update pipeline.
- The requested result is a more polished, branded installer, not a migration to NSIS/Wix.

## Supported Branding Surface

Within Squirrel, the installer can be improved in these areas:

1. `setupIcon`
   - Custom icon for `KarpikSetup.exe`.
   - Should visually match the desktop app and new design language.

2. `loadingGif`
   - Branded loading animation shown during installation.
   - This is the main place where installer personality can be expressed.

3. Product metadata
   - Keep consistent naming and author fields so the product looks coherent in Windows UI.

4. Installed app / update icon family
   - Ensure the setup icon and application icon belong to the same visual system.

## Unsupported Expectations

This slice does **not** attempt to implement:

- a custom installer window layout
- custom buttons, inputs, or multi-step onboarding inside `KarpikSetup.exe`
- a Figma-accurate full-screen installer recreation
- a packaging migration to `electron-builder`, `NSIS`, or `Wix`

If a truly custom installer UI is required later, that must be a separate packaging migration project.

## Visual Direction

Use the existing design assets as branding source:

- source logo: `Desktop/new_design/design-logo.png`
- source visual language: dark shell, soft neon glow, restrained minimalism

### Setup Icon

- Build an `.ico` asset from the existing logo.
- Use a dark background tone aligned with the desktop shell.
- Keep the mark centered and legible at small sizes.
- Prioritize clarity over decorative detail.

### Loading Animation

The loading animation should be minimal and product-like:

- dark background
- centered logo
- soft glow / pulse
- short caption: `Подготавливаем Karpik`
- no fake progress bar
- no dense text

The animation should feel consistent with the modern minimal desktop UI rather than like a generic Windows installer.

## Asset Structure

Store packaging assets in `desktop/build/`.

Expected assets:

- `setup.ico`
- `loading.gif`
- optionally a shared icon source file if needed for future packaging work

## Packaging Integration

Update `desktop/forge.config.ts` to wire the new assets into the Squirrel maker configuration:

- `setupIcon`
- `loadingGif`
- keep existing `setupExe`
- preserve compatibility with current update packaging

## Verification

Success means:

1. `KarpikSetup.exe` uses the branded icon.
2. Running the installer shows the branded loading animation.
3. `npm run make` still succeeds.
4. The produced `RELEASES`, `.nupkg`, and setup executable remain valid for updates.
5. Existing desktop updater behavior is not regressed.

## Out of Scope

- redesigning the installer technology
- altering onboarding flow inside the installer
- changing server-side update feed semantics
- non-Windows packaging work
