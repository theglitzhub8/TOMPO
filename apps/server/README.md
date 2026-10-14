# Tempo API

Node.js/TypeScript backend for Tempo. It provides a PostgreSQL-backed sync boundary for tasks, projects, routines, and preferences, plus a structured daily-plan proposal endpoint. Every write is transactional and produces an idempotent sync event; the client identifies a user with `x-tempo-user` until production authentication is connected.

## Run locally

```bash
docker compose up -d postgres redis
export DATABASE_URL=postgres://tempo:tempo@localhost:5432/tempo
npm run server:dev
```

The API listens on `http://localhost:8787`.

- `GET /health`
- `GET /v1/:kind` where kind is `task`, `project`, `routine`, or `preferences`
- `POST /v1/sync` with `{ "events": [{ "kind", "entityId", "payload" }] }`
- `GET /v1/sync?after=0`
- `POST /v1/ai` with sections `task-extraction`, `priority-ranking`, `daily-plan`, `rescheduling`, `accountability`, or `performance-review`
- `DELETE /v1/:kind/:id` deletes user-created data

Set `ANTHROPIC_API_KEY` and optionally `ANTHROPIC_MODEL` to enable Claude. Without a key, the endpoint returns an explicitly marked simulation.

Redis is provisioned for the scheduled-job layer; BullMQ workers and push-provider adapters are the next deployment step. No provider credentials are hardcoded.
