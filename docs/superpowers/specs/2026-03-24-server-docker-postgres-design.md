# Server Docker + Postgres

## Goal

Finish the server-side production path for `Karpik` so the full control-plane
stack can be started with one Docker command and durable state no longer depends
on a local JSON file.

## Context

The current server works, but production gaps remain:

- durable state is backed by `server/.tmp/runtime-state.json`
- active challenge/pairing state is only partially persisted
- there is no containerized stack for `server + bot + postgres + nginx`

The desktop and bot already speak stable HTTP APIs, so the safest path is to
preserve those APIs and swap out the server persistence/deployment layer under
them.

## Approaches Considered

### 1. Full relational rewrite now

Replace the in-memory stores with a new normalized PostgreSQL data model and
rewrite all store logic around SQL queries.

Pros:

- strongest long-term model
- easier future scaling and analytics

Cons:

- highest risk and largest diff
- large regression surface across task, pairing, challenge, and delivery flows
- unnecessary for the current single-instance production target

### 2. PostgreSQL-backed section state backend

Keep the current store APIs and state shapes, but replace the JSON file backend
with a PostgreSQL backend that stores named sections in a durable table.

Pros:

- minimal change to proven task/challenge/pairing logic
- easy fallback to JSON for local development
- fast path to one-command Docker deploy

Cons:

- not horizontally scalable across multiple server replicas
- state remains store-oriented rather than fully normalized

### 3. Dockerize only, keep JSON durability

Containerize the current stack without changing server persistence.

Pros:

- smallest immediate deployment diff

Cons:

- does not solve the largest remaining production risk
- JSON file durability in a containerized server is still weak and awkward

## Recommendation

Use approach 2.

It gets us to a production-ready single-instance control plane without rewriting
stable business logic. The stores keep their current behavior, but the backend
becomes PostgreSQL-backed and fully durable for the states that matter. Docker
then becomes a packaging/deployment layer on top of that backend.

## Architecture

### State backend

Introduce a `StateBackend` interface with two implementations:

- `JsonStateBackend` for local/dev fallback
- `PostgresStateBackend` for server deployment

`PostgresStateBackend` stores named sections in a single durable table:

- `section_name text primary key`
- `payload jsonb not null`
- `updated_at timestamptz not null`

This keeps the current stores unchanged at their public boundaries while
providing atomic section reads/writes in PostgreSQL.

### Backend selection

Server config adds `KARPIK_DATABASE_URL`.

- if `KARPIK_DATABASE_URL` is set, use `PostgresStateBackend`
- otherwise use `JsonStateBackend`

This preserves the local development path and unlocks a production compose
stack without forks in the API layer.

### Durable state scope

Durability should cover all state that must survive a server restart in the
single-instance deployment model:

- tasks
- delivery outbox
- trusted Telegram users
- active pairing sessions and pending pair events
- auth configuration
- active challenges and pending auth input events
- trust windows and lockouts
- device presence heartbeat timestamps

Waiter primitives remain in memory; they are rebuilt as needed around reloaded
events.

### Container stack

Add a root Docker Compose stack with these services:

- `postgres`
- `server`
- `bot`
- `nginx`

Behavior:

- `postgres` exposes only the internal Docker network
- `server` uses `KARPIK_DATABASE_URL=postgresql://...@postgres/...`
- `bot` talks to `http://server:8000`
- `nginx` fronts `/api/` and `/desktop-updates/`

The primary operator command becomes:

```bash
docker compose up -d --build
```

## Error Handling

- PostgreSQL backend startup retries database connect/schema init briefly so
  compose startup does not race the database
- missing required bot token should fail fast and visibly
- if database access fails at runtime, server errors are surfaced rather than
  silently falling back to lossy behavior

## Testing

Testing should prove:

- backend selection chooses Postgres when configured
- PostgreSQL backend reads/writes named sections correctly
- pairing/challenge persistence survives store recreation
- existing server and bot behavior remains green
- Docker compose configuration is valid

## Non-Goals

- no multi-replica server coordination in this slice
- no ORM rewrite
- no staged deployment system or Kubernetes layer
