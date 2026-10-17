# Accounts, cloud storage, and branding

## Delivered

- Tempo app-icon master, standalone transparent mark, horizontal logo, palette/usage guide, prompt provenance, and a downloadable ZIP in `apps/mobile/assets/brand`.
- Branding wired into app headers, sign-up, loading, favicon, iOS app icon, Android adaptive/themed icon, and the light splash screen.
- Sign-up/sign-in required for every planner route, including direct links. Account restoration is verified by the server before the workspace opens.
- Authenticated PostgreSQL storage for name/email, salted password hashes, sessions, tasks, projects, routines, and preferences.
- Cloud-authoritative saving with account ownership, full validation, atomic plan writes, revision conflict detection, session expiry, and logout clearing active account data.
- Old anonymous device SQLite data is preserved; it is not automatically exposed to or assigned to new accounts.

## Verified

- 27 core tests passed.
- 18 server tests passed with a real PostgreSQL instance, using an isolated test schema. These include 10 end-to-end checks under the workspace integration suite, plus its suite-level test and 7 existing tests.
- Mobile TypeScript/ESLint and server TypeScript build passed.
- Production web export passed.
- Browser QA: opening the old planner redirected to sign-up. Blank sign-up showed validation. A disposable QA account signed in to an empty workspace (no anonymous-data leak), generated an authenticated AI plan, saved it online, restored the plan after reload, signed out, and was redirected to sign-up when opening a direct planner link.
- The disposable local QA account and its records were removed after verification. Integration tests remove only their own isolated schema.
- iOS prebuild generated a 1024px AppIcon asset from the new master. The full iOS simulator native build passed, and iOS/Android production JavaScript exports passed. The generated 1024px icon and favicon are included in the brand ZIP.

## Running local services

- PostgreSQL: Docker Compose `postgres`, bound to loopback port 55432, persistent `tempo_tempo_pg` volume.
- Tempo API: loopback port 8787, with mandatory account validation.
- Browser preview: port 8084, proxying `/v1/` to the API.

Provider credentials were preserved. Development database configuration is in ignored local environment files; no secrets are included in source or the brand kit.

## Deployment boundary

These changes update source and the local working preview. The live `tempo-api.hafrik.com` deployment and installed phone app require a known hosting/deployment connection and a new native build rollout. No live-host deployment is claimed by local verification. The domain’s public DNS resolves to an already-known SSH host, but its SSH connection timed out during banner exchange; a working deployment connection is still needed.

Physical-phone microphone verification, release splash appearance, password-reset email, email verification, and background reminder delivery remain outside these changes.
