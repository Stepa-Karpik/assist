# Desktop Update Feed Layout

Windows desktop clients use a static Squirrel feed.

Expected directory:

- `/srv/karpik/desktop-updates/win32/x64/`

Expected files in that directory:

- `RELEASES`
- `KarpikSetup.exe`
- `karpik-<version>-full.nupkg`

These files come from:

- `desktop/out/make/squirrel.windows/x64/`

Current verified artifact names for version `0.1.0`:

- `RELEASES`
- `KarpikSetup.exe`
- `karpik-0.1.0-full.nupkg`
