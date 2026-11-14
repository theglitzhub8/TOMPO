# Tempo

**Sign up → speak or type everything you need to do → get a realistic day plan → follow one next step.**

Tempo includes one-take voice/text capture, AI task breakdown, fixed appointments, protected routines, breaks, overflow, completion, and replanning. The main app has Today, Projects, Tell Tempo, Tasks, and Settings. The new brand kit lives in `apps/mobile/assets/brand`.

## Day changes, repeats, and wrap-up

- **Today → My day changed:** choose when you’re available and when you want to finish, preview every moved task and waiting count, then save. Fixed appointments, accepted shared work, and completed tasks stay in place. A changed workspace requires another review.
- **Tasks → add/edit → Repeat:** choose Daily, Weekdays, or Weekly. Tempo prepares separate occurrences for the coming seven days when Today opens and during foreground sync. Flexible repeats wait for planning; timed repeats keep their local clock time. Completion belongs to each occurrence. Delete an occurrence to skip that date. Edit the original task to change or stop future generation; already created occurrences remain editable tasks. Generation runs while the app is open, not on a background server timer.
- **Today → wrap-up:** review this day or the previous day, see completed task counts and estimated minutes, and select unfinished flexible tasks to carry to the next day. Appointments and recurring occurrences are handled separately. Carry-forward history keeps the original day’s summary accurate; moving a task does not mark it completed or immediately schedule it.

See `docs/DAY_LIFECYCLE.md` for the initial upgrades and `docs/PRODUCT_UPGRADES.md` for weekly planning, collaboration, calendar, widget, recovery, and verification details.

## Talk to Tempo

**Today → Talk to Tempo** opens a voice assistant backed by Moonshot Kimi (`POST /v1/assistant`). Speak or type; when you stop talking it sends your words with a snapshot of your own tasks. Tempo replies in one to three sentences, read aloud unless voice replies are turned off, and may suggest changes: add, rename, retime, move, complete, reopen or delete tasks, or rearrange the rest of today. Suggestions appear as a list and nothing changes until you tap **Apply changes**, which saves them in one revision. The server discards suggestions that refer to tasks you don't own or have invalid times. It also corrects likely speech-recognition mistakes and writes clean task titles.

Every task the AI creates carries a short **note**: one sentence on why it matters or how to do it well. Notes show on Today and in the timeline, and can be edited on any task.

**Week plans:** in Tell Tempo or Talk to Tempo, say what happens on other days ("On Monday I have…, on Wednesday I need to…"). Those tasks are saved on their dates: timed ones stay fixed, the rest wait as flexible tasks until you plan that day. The AI gets a two-week calendar so weekday names resolve to the right dates.

**Projects by voice:** Projects → **Describe a project** opens Talk to Tempo in project mode. Describe the work and deadline; Tempo proposes the project, its tasks (with notes, steps and durations) spread over the coming days, and creates them when you apply.

Tapping a task reminder (not its action buttons) opens a check-in: Tempo asks how the task went and suggests marking it done, adding time, or moving it.

## Accounts and online storage

An account is required before any planner screen can open, including deep links. The API independently enforces sign-in for planning, profiles, and workspace access.

Names, email addresses, tasks, projects, routines, and preferences are stored in PostgreSQL under the authenticated user’s ID. Passwords use salted scrypt hashes. Native session tokens use SecureStore; browser tokens are scoped to the tab. Signing out clears the active workspace and draft from app memory and revokes the session when the backend is reachable.

**Login with Hafrik** (iOS and Android) opens Hafrik in a secure browser sheet. Accounts are linked by Hafrik `user_id` (`users.external_id = hafrik:<id>`), never by email: a Hafrik email already used by a Tempo account is not attached, and the existing account is untouched. Because Hafrik's OAuth returns no `state`, the app sends `sha256(verifier)` to `/v1/auth/hafrik/start`; the callback (bound to that start by a short-lived cookie) exchanges Hafrik's `auth_key` server-side and returns only a one-time ticket to `tempo://auth/hafrik`, which the app redeems with its verifier at `/v1/auth/hafrik/session`. Hafrik tokens and the App Secret never reach the app. Set `HAFRIK_APP_ID` and `HAFRIK_APP_SECRET` on the backend to enable it.

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

Set `MOONSHOT_API_KEY` (and optionally `MOONSHOT_MODEL`, default `kimi-k3.1-pro`) on the backend to enable AI extraction and the voice assistant. If the provider is unavailable, authenticated users can review a clearly labeled local fallback plan. It recognizes common English lists and explicit appointment times; it does not replace full natural-language AI understanding.

App icon, favicon, Android adaptive/themed icon, and splash configuration use the new brand assets. Native icon/splash changes need a fresh build. `apps/mobile/assets/brand/README.md` documents palette, usage, and the generation prompt set.

Source changes do not deploy the hosted backend or replace an installed phone app. Native reminders and shared-task push delivery have source integrations that still need physical-device verification. Password recovery is implemented and requires a configured Resend sender; email verification is not connected.

## Verify

```sh
npm test
npm run test:mobile-store
npm run typecheck
npm run lint
npm --prefix apps/server test
npm run server:build
```

The real PostgreSQL integration suite additionally requires `TEST_DATABASE_URL` and creates its own isolated schema. See `apps/server/README.md`. Verification covers account creation, password hashing, user isolation, plan restoration, atomic rollback, concurrent edits, deletion/recreation, server restart, logout, expired sessions, and the planner’s scheduling rules.
