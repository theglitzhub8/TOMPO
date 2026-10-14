# Sprint 1 foundation — implementation record

## Changed files

| Location | Purpose |
| --- | --- |
| `package.json`, `.gitignore` | Root verification scripts and artifact exclusions |
| `apps/mobile/package.json`, `package-lock.json` | Expo SDK 57, Router, SQLite, development client, Zustand, Query dependencies |
| `apps/mobile/app.json`, `tsconfig.json`, `metro.config.js`, `eslint.config.js` | iOS/Android identifiers, native plugins, shared-core imports |
| `apps/mobile/src/app/_layout.tsx` | Database initialization gate, providers and stack |
| `apps/mobile/src/app/(tabs)/_layout.tsx` | Five primary tabs |
| `apps/mobile/src/app/(tabs)/*.tsx` | Today, Projects, Tasks/focus, routines and settings |
| `apps/mobile/src/app/{onboarding,planning,assistant,reports,notification-test}.tsx` | Additional routes with honest capability labels |
| `apps/mobile/src/components/{ui,preferences}.tsx` | Provisional design system, reusable forms and error handling |
| `apps/mobile/src/design/tokens.ts` | Modular deep teal / white design tokens from the supplied direction |
| `apps/mobile/src/data/store.ts` | Zustand hydration and Expo SQLite repository adapter |
| `packages/core/src/{model,repository,scheduling}.ts` | Validation, transactional SQLite/outbox, IANA scheduling and reminder policy |
| `packages/core/tests/foundation.test.ts` | Restart persistence, atomic plan rollback, concurrency, scheduling, DST, quiet hours and reminder tests |
| `apps/server/README.md` | Backend scope and security boundary; no server implementation |
| `README.md`, `docs/DEVICE_VERIFICATION.md` | Setup, limitations and remaining device acceptance work |

Removed unused starter routes, components and hooks; default Expo assets are still provisional. Generated native directories, build exports and node_modules are excluded from source control.

## Verification

- 14 core tests pass. Persistence tests close/reopen an actual SQLite file using the same repository and SQL as the Expo adapter.
- Strict TypeScript check and Expo ESLint pass.
- iOS and Android Metro/Hermes exports succeed.
- Expo dependency compatibility check passes; Expo Doctor passes all 21 checks.
- iOS development build compiles successfully (0 errors; 1 Expo development-launcher script warning), installs, and launches on iPhone 17 / iOS 26.5 Simulator.
- All nine routes plus the notification placeholder were opened in the native UI. Project creation, assigned task creation, daily-plan saving, task editing/completion/reopening/postponement, foreground focus start/end, recurring lunch configuration, onboarding save and simulated call connecting/active/ended transitions were exercised.
- Android native build and device behavior remain unverified: Android SDK is absent.
- Native runtime reload retained the assigned project, task schedule/completion, lunch routine, and onboarding preferences. The simulator contains explicit test records (`Sprint verification`, `Verified offline persistence`, `Lunch`); no sample data is seeded into new installs.
- Broader device QA, full process cold-restart and Android testing remain pending. Native notification delivery is unimplemented. Node SQLite close/reopen tests and native runtime-reload checks have distinct coverage.

## Remaining acceptance criteria

Prototype fidelity, native device persistence/navigation QA, local notifications and actual permission reporting, server synchronization, AI integrations, replaceable real calling adapters, durable call history, and focus/history reporting are still pending. No pending capability is labeled as enabled in the UI.

Dependency audit: 29 findings (18 high, 11 moderate) remain in the Expo / React Native transitive dependency tree after a non-breaking `npm audit fix`. Forced remediation suggests incompatible Expo / React Native downgrades; this build is not approved for production release.

## Approved Figma design pass

See `DESIGN_REFERENCE.md` for all nine frame-to-route mappings, changed files, bundled fonts, and functional adaptations. Primary bottom tabs now match Today / Plan / Projects / Tasks / Calls. The core persistence, outbox, timezone and reminder policies retain their existing implementations.
