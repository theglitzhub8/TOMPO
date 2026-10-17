# Tempo account API

Node/TypeScript + PostgreSQL. Sign-up/sign-in is mandatory for planning and workspace access. Every request is scoped to the user identified by a server-validated bearer session; client-supplied user IDs are never used for ownership.

## Run

1. Start PostgreSQL (`docker compose up -d postgres` from the repo root; set a private `TEMPO_DB_PASSWORD` in root `.env`).
2. Configure `apps/server/.env` from `.env.example`, with the matching `DATABASE_URL`.
3. `npm --prefix apps/server ci` and `npm run server:dev` from the repo root.

Startup runs additive schema migration before accepting requests. Existing account and entity tables are preserved. Provider secrets stay on the server. In production, use HTTPS, set `NODE_ENV=production`, and configure `CORS_ORIGINS` for the actual browser origin(s).

## Endpoints

Public:

- `GET /health`
- `POST /v1/auth/register` — `{name,email,password}`; normalized email, unique account, salted scrypt hash, atomic account + session creation.
- `POST /v1/auth/login` — `{email,password}`.

All routes below require `Authorization: Bearer <session>`:

- `GET /v1/auth/me`; `PATCH /v1/auth/me` — update `{name}`.
- `POST /v1/auth/logout` — revoke the session.
- `GET /v1/workspace` — account snapshot `{revision,records,savedAt}`.
- `POST /v1/workspace` — `{revision,changes:[{kind,id,payload}]}`; `payload:null` removes a record.
- `POST /v1/plan` — `{text,day,timezone}`; AI extraction for the authenticated account.
- `GET /v1/connection` — account/storage/provider capability status.

Workspace writes validate all fields, protect account ownership, check project relationships, and commit together. Row locking plus a workspace revision prevents concurrent devices from silently overwriting one another. A stale revision returns HTTP 409 and the latest account snapshot. Deletion and recreation work through the same versioned path. The previous unauthenticated planning and legacy sync routes are no longer exposed.

Sessions expire after 30 days; only token hashes are stored in PostgreSQL. The app uses native SecureStore, or tab-scoped session storage on web. Names, emails, and saved planner records are in PostgreSQL; raw passwords and voice recordings are not stored. The current release does not provide email verification or password-reset email delivery.

## Verify

```sh
npm --prefix apps/server test
npm run server:build
```

Set `TEST_DATABASE_URL` to run the real PostgreSQL integration suite. The suite creates a unique schema, exercises real HTTP requests and server restarts, and drops only that test schema afterward. It covers account isolation, atomic writes, stale revisions, persistence, logout and expired sessions. Without that variable, the integration suite is explicitly skipped.

For a local instance already configured with `apps/server/.env`, run the tests from `apps/server` with a private `TEST_DATABASE_URL` pointing at that database; never paste database credentials into chat.
