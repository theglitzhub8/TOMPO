CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), external_id text UNIQUE NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS entities (user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind text NOT NULL, entity_id text NOT NULL, payload jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,kind,entity_id));
CREATE TABLE IF NOT EXISTS sync_events (id bigserial PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind text NOT NULL, entity_id text NOT NULL, payload jsonb NOT NULL, revision integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,kind,entity_id,revision));
CREATE INDEX IF NOT EXISTS entities_user_kind ON entities(user_id,kind);
