# Production Handoff Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add repository-owned smoke, backup, restore, and Docker CI automation for the production server stack.

**Architecture:** Keep the operational surface area small and explicit. PowerShell scripts under `infra/scripts` own local operator workflows, while a dedicated GitHub Actions workflow validates the Docker stack contract in CI.

**Tech Stack:** PowerShell, Docker Compose, PostgreSQL tools inside the Docker container, GitHub Actions

---

### Task 1: Add smoke script

**Files:**
- Create: `infra/scripts/server-smoke.ps1`

- [ ] Step 1: Write the script to resolve the env file, start the stack, and verify `/health` plus `/api/health`.
- [ ] Step 2: Run the script locally against `.env.example` and verify it succeeds.

### Task 2: Add PostgreSQL backup and restore scripts

**Files:**
- Create: `infra/scripts/postgres-backup.ps1`
- Create: `infra/scripts/postgres-restore.ps1`

- [ ] Step 1: Implement backup against the running `postgres` container with timestamped dump output.
- [ ] Step 2: Implement restore from a provided dump file back into the running `postgres` container.
- [ ] Step 3: Run a local backup/restore cycle against the active stack and verify the commands complete.

### Task 3: Add Docker stack CI

**Files:**
- Create: `.github/workflows/docker-stack.yml`

- [ ] Step 1: Validate base and Telegram-profile compose configs.
- [ ] Step 2: Build and start the base stack in CI.
- [ ] Step 3: Curl published `/health` and `/api/health`.
- [ ] Step 4: Tear the stack down in an always-run cleanup step.

### Task 4: Sync runbooks

**Files:**
- Modify: `docs/runbooks/server-deploy.md`
- Modify: `docs/runbooks/local-dev.md`
- Modify: `infra/README.md`

- [ ] Step 1: Document the smoke script as the canonical post-deploy check.
- [ ] Step 2: Document backup and restore entry points.
- [ ] Step 3: Align local dev docs with the same commands.

### Task 5: Verify and ship

**Files:**
- Modify: `README.md`

- [ ] Step 1: Run local verification for scripts and compose stack.
- [ ] Step 2: Update the main README operational summary if needed.
- [ ] Step 3: Commit and push the slice.
