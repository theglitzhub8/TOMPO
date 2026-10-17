# Tempo

**Sign up → speak or type everything you need to do → get a realistic day plan → follow one next step.**

Tempo includes one-take voice/text capture, AI task breakdown, fixed appointments, protected routines, breaks, overflow, completion, and replanning. The main app has Today, Tell Tempo, and Settings. The new brand kit lives in `apps/mobile/assets/brand`.

## Accounts and online storage

An account is required before any planner screen can open, including deep links. The API independently enforces sign-in for planning, profiles, and workspace access.

Names, email addresses, tasks, projects, routines, and preferences are stored in PostgreSQL under the authenticated user’s ID. Passwords use salted scrypt hashes. Native session tokens use SecureStore; browser tokens are scoped to the tab. Signing out clears the active workspace and draft from app memory and revokes the session when the backend is reachable.

The backend is the source of truth. Sign in on another device to restore the workspace, or use Settings → Refresh saved plan. Saves require a connection and succeed only after the backend commits. Failed writes show an error; conflicting device edits return the latest saved version for review. Old anonymous SQLite files are preserved but are not automatically assigned to a new account.

## Run locally

Requires Node 24+, npm, Docker for local PostgreSQL, and platform tools for native builds.

```sh
npm --prefix apps/mobile ci
npm --prefix apps/server ci
# Set a private TEMPO_DB_PASSWORD in root .env.
docker compose up -d postgres
# Configure apps/server/.env from .env.example, matching the database password.
npm run server:dev
```

In another terminal:

```sh
# iOS simulator uses this computer’s loopback API:
EXPO_PUBLIC_TEMPO_API_URL=http://127.0.0.1:8787 npm start
npm --prefix apps/mobile run ios
```

Android emulator uses `http://10.0.2.2:8787`. A physical phone needs an accessible HTTPS API. Without an override, the app targets `https://tempo-api.hafrik.com`. A saved API URL is also supported; an explicit build environment override takes precedence.

For a browser preview with the local backend:

```sh
cd apps/mobile
EXPO_PUBLIC_TEMPO_API_URL=http://localhost:8084 npx expo export --platform web --output-dir /tmp/tempo-rebuild-web
cd ../..
python3 scripts/preview-web.py /tmp/tempo-rebuild-web --port 8084
```

Open `http://localhost:8084`. The local preview proxy forwards `/v1/` account/API requests to port 8787, including authentication headers. Use a reachable HTTPS backend and configured CORS origins for a hosted browser deployment.

## Voice, AI, and assets

Voice uses `expo-speech-recognition` with microphone/speech permissions and a visible listening state. It requires a rebuilt native app. Speech-service availability, network needs, and session limits vary by device; typing and keyboard dictation remain available. Tempo does not save audio recordings.

Set `ANTHROPIC_API_KEY` on the backend to enable AI extraction. If the provider is unavailable, authenticated users can review a clearly labeled local fallback plan. It recognizes common English lists and explicit appointment times; it does not replace full natural-language AI understanding.

App icon, favicon, Android adaptive/themed icon, and splash configuration use the new brand assets. Native icon/splash changes need a fresh build. `apps/mobile/assets/brand/README.md` documents palette, usage, and the generation prompt set.

Source changes do not deploy the hosted backend or replace an installed phone app. Background reminders, password-reset email, and email verification are not connected.

## Verify

```sh
npm test
npm run typecheck
npm run lint
npm --prefix apps/server test
npm run server:build
```

The real PostgreSQL integration suite additionally requires `TEST_DATABASE_URL` and creates its own isolated schema. See `apps/server/README.md`. Verification covers account creation, password hashing, user isolation, plan restoration, atomic rollback, concurrent edits, deletion/recreation, server restart, logout, expired sessions, and the planner’s scheduling rules.
