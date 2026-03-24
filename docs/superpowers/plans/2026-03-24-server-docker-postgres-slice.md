# Server Docker + Postgres Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace JSON durability with PostgreSQL-backed state and add a one-command Docker deployment path for the server stack.

**Architecture:** Keep the current store APIs and move persistence behind a shared `StateBackend` abstraction. Add a Docker Compose stack for `postgres + server + bot + nginx`, using PostgreSQL in deployment and JSON only as a local fallback.

**Tech Stack:** FastAPI, aiogram, psycopg, PostgreSQL, Docker Compose, nginx

---

### Task 1: Add failing tests for backend selection and durable state scope

**Files:**
- Create: `server/tests/test_postgres_state_backend.py`
- Modify: `server/tests/test_state_persistence.py`
- Test: `server/tests/test_postgres_state_backend.py`
- Test: `server/tests/test_state_persistence.py`

- [ ] Add a failing test that expects a PostgreSQL backend to be selected when `KARPIK_DATABASE_URL` is set.
- [ ] Add a failing test for PostgreSQL section read/write behavior using a fake connection factory.
- [ ] Add failing persistence tests for pairing sessions/pair events and active challenge/auth events.
- [ ] Run the focused pytest commands and verify they fail for the expected missing behavior.

### Task 2: Implement the state backend abstraction and PostgreSQL backend

**Files:**
- Modify: `server/app/config.py`
- Modify: `server/app/main.py`
- Modify: `server/app/services/state_backend.py`
- Modify: `server/pyproject.toml`

- [ ] Introduce a shared backend interface/protocol for section reads and writes.
- [ ] Add `PostgresStateBackend` with schema init, retrying startup connect, and atomic upsert semantics.
- [ ] Add config support for `KARPIK_DATABASE_URL` and backend selection.
- [ ] Run the focused pytest commands and make them pass.
- [ ] Install any needed Python dependency in the server environment.

### Task 3: Make pairing and challenge flows fully durable

**Files:**
- Modify: `server/app/services/pairing_store.py`
- Modify: `server/app/services/challenge_store.py`
- Modify: `server/tests/test_state_persistence.py`

- [ ] Persist pairing sessions and pair attempt events.
- [ ] Persist active challenges, auth input events, trust windows, and lockouts.
- [ ] Restore those sections on store startup while keeping waiter objects runtime-only.
- [ ] Run the state persistence tests and confirm they pass.

### Task 4: Add Docker images and compose stack

**Files:**
- Create: `server/Dockerfile`
- Create: `bot/Dockerfile`
- Create: `docker-compose.yml`
- Create: `.env.example`
- Modify: `infra/nginx/karpik.conf`

- [ ] Add a server image that runs `uvicorn app.main:app`.
- [ ] Add a bot image that runs `python -m app.main`.
- [ ] Add compose services for `postgres`, `server`, `bot`, and `nginx`.
- [ ] Wire volumes, health checks, ports, and environment variables for one-command startup.
- [ ] Validate compose configuration.

### Task 5: Update runbooks and deployment docs

**Files:**
- Modify: `docs/runbooks/server-deploy.md`
- Modify: `docs/runbooks/local-dev.md`
- Modify: `infra/README.md`
- Modify: `README.md`

- [ ] Document the new one-command Docker flow.
- [ ] Document the PostgreSQL-backed server runtime.
- [ ] Document required environment variables and the update feed mount path.

### Task 6: Full verification and integration

**Files:**
- Verify only

- [ ] Run `server` test suite.
- [ ] Run `bot` test suite.
- [ ] Run desktop tests if any shared contract changed.
- [ ] Run `docker compose config`.
- [ ] If Docker is available, run `docker compose up -d --build` and verify `GET /health`.
- [ ] Commit logical slices with clear messages.
- [ ] Push `task-6-bot-bootstrap`.
