# TEMPO

China-first personal discipline assistant. This repository implements the first foundation milestone of Sprint 1: Expo Router navigation, approved Figma design tokens, local task/project/routine/preferences persistence, a deterministic planner, and core tests. The approved nine-screen Figma file is now the visual reference. See [design mapping and adaptations](docs/DESIGN_REFERENCE.md).

## Run

Requires Node 24+, npm, Xcode for iOS, and Android Studio / SDK for Android.

```sh
npm --prefix apps/mobile ci
npm test
npm run typecheck
npm --prefix apps/mobile run ios
npm --prefix apps/mobile run android
```

The native commands generate development builds; signing / device setup may be needed. `npm start` runs Metro. Do not use the web preview as proof of native SQLite behavior.

## Layout

- `apps/mobile/src/app`: all nine screens, five main tabs, and notification test route.
- `apps/mobile/src/components`: reusable UI primitives and preference editor. Reusable UI primitives live in `ui.tsx`; colors, typography, spacing, and radii are modular in `src/design/tokens.ts`. These follow the approved Figma file.
- `apps/mobile/src/data`: Zustand store and Expo SQLite adapter. TanStack Query provider is ready for future server queries.
- `packages/core/src`: domain validation, SQLite repository/migration, timezone conversion, protected routine scheduling, reminder policy.
- `packages/core/tests`: real SQLite restart, rollback, concurrent-write, scheduling, timezone, and reminder tests using Node's built-in test runner.
- `apps/server`: reserved backend boundary; no server is running or connected.
- `docs`: milestone status and device verification instructions.

## Functional foundation

Create and rename projects. Create/edit/complete/reopen/postpone tasks and assign projects. Schedule tasks at explicit timezone-local dates/times. Configure protected recurring routines by weekday. Set an IANA timezone, accountability mode, and quiet hours. Create a local day plan around routines and existing scheduled tasks. View local progress and a foreground focus timer. Exercise clearly labeled simulated call states with consent/opt-out.

SQLite entities and their pending synchronization records commit together. UI state updates after persistence succeeds. Writes are serialized, values are validated, and SQL values are parameterized. The outbox is durable but **does not synchronize**: no network endpoint is configured. Local data is unencrypted and device-local; uninstalling the app removes it. No API credentials are present.

## Pending Sprint 1 work

- Complete broader accessibility and device QA.
- Expo Notifications permissions, capability reporting, idempotent local scheduling, Android channels, and device delivery tests. The test route explicitly says permissions have not been queried.
- Real provider-independent voice/telephone adapters, durable call history, delivery recovery. Current demo sends no audio and places no calls.
- Separate AI providers, structured server validation, consent enforcement, and review flows.
- Authenticated Node/TypeScript API, PostgreSQL sync/conflict handling, Redis/BullMQ jobs, push delivery.
- Persistent focus session history and accountability history.
- Signed iOS/Android device validation and release dependency audit remediation.

These are not represented as working features. The full Sprint 1 acceptance criteria are not yet met.
