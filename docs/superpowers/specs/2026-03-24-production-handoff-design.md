# Production Handoff Design

## Goal

Close the remaining operational gap between a working internal prototype and a
release-ready product by making deployment, smoke validation, and PostgreSQL
backup/restore first-class parts of the repository.

## Context

The product already has:

- a one-command Docker server stack
- PostgreSQL-backed server durability
- Windows desktop packaging and in-place updates
- end-to-end Telegram -> server -> desktop execution flow

What is still missing is the last layer of operational certainty:

- repeatable smoke checks after `docker compose up -d --build`
- repository-owned backup and restore commands for PostgreSQL
- CI that validates the Docker stack itself instead of only unit tests
- explicit runbooks that match the actual operational tooling

## Requirements

1. The repository must provide a scripted smoke check for the Docker control
   plane stack.
2. The repository must provide a scripted PostgreSQL backup path and a matching
   restore path.
3. The smoke and backup scripts must work from the repo root and use the same
   `.env`/`.env.example` conventions as the existing Docker deployment.
4. CI must validate `docker compose` config and perform a live stack smoke run
   on every PR and on pushes to active branches.
5. Docs must explain the operational flow without relying on implicit knowledge.

## Design

### 1. Ops scripts live under `infra/scripts`

Add three PowerShell scripts:

- `infra/scripts/server-smoke.ps1`
- `infra/scripts/postgres-backup.ps1`
- `infra/scripts/postgres-restore.ps1`

They are intentionally repository-owned operational entry points, not ad-hoc
shell snippets in markdown.

### 2. Smoke script owns the post-deploy contract

`server-smoke.ps1` should:

- accept an env file path, defaulting to `.env`
- fall back to `.env.example` for local verification if `.env` does not exist
- run `docker compose --env-file <file> up -d --build`
- verify:
  - `docker compose ps`
  - `http://127.0.0.1:<port>/health`
  - `http://127.0.0.1:<port>/api/health`
- fail fast with non-zero exit code if any check fails

This turns “one-command startup works” into a concrete, automatable contract.

### 3. Backup and restore scripts wrap the Dockerized Postgres

`postgres-backup.ps1` should:

- accept env file path and output directory
- resolve compose service/container from the current stack
- run `pg_dump -Fc` inside the running `postgres` container
- emit a timestamped dump file under a repo-local backup directory by default

`postgres-restore.ps1` should:

- accept env file path and backup file path
- verify the file exists
- copy the dump into the running container
- run `pg_restore --clean --if-exists --no-owner --no-privileges`
- clean up the temporary file inside the container

The scripts should operate against the active Docker stack rather than requiring
manual container name discovery.

### 4. CI validates the Docker contract directly

Add `.github/workflows/docker-stack.yml`:

- run on `push` and `pull_request`
- validate:
  - `docker compose --env-file .env.example config`
  - `docker compose --env-file .env.example --profile telegram config`
- build and start the base stack
- curl published `/health` and `/api/health`
- tear the stack down afterward

The Telegram profile should be config-validated, but not started, because a real
bot token is a runtime secret, not a CI fixture.

### 5. Runbooks become exact mirrors of the scripts

Update runbooks so that:

- deploy verification points to `infra/scripts/server-smoke.ps1`
- backup/restore is documented as an explicit operational routine
- local dev references the same smoke script

## Non-Goals

- No full Kubernetes or cloud-specific deployment layer
- No remote managed backup service integration
- No automatic scheduled backups in this slice
- No change to the current optional Telegram compose profile model

## Success Criteria

- repo contains reproducible smoke, backup, and restore commands
- Docker stack is CI-validated, not only described in docs
- local operator can bring up, verify, back up, and restore the server stack
  without inventing commands manually
