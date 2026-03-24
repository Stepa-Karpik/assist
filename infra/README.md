# Infra

This folder contains deployment-related assets for `Karpik`.

Included assets:

- `nginx/karpik.conf` - reverse proxy and desktop update feed routing baked into the nginx image
- `nginx/Dockerfile` - nginx image used by `docker compose up -d --build`
- `desktop-updates/README.md` - expected layout for the Windows Squirrel feed
- `env/desktop.env.example` - example desktop environment variables

Current deployment split:

- `/health` and `/api/health` are published health endpoints through nginx
- `/api/` is served by the FastAPI control plane
- `/desktop-updates/win32/x64/` is a static directory with `RELEASES`,
  `KarpikSetup.exe`, and `.nupkg` artifacts produced by `desktop/npm run make`
- base Docker command starts `postgres + server + nginx`
- Telegram ingress is enabled with `docker compose --profile telegram up -d --build`
