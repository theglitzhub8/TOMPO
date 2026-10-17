# Planner rebuild verification

2026-10-17

## Product flow

Today → one voice/text capture → editable preview → save → next step and timeline.

Removed the simulated call screen from navigation and reduced the main tabs to Today, Tell Tempo, and Settings. Projects and older records are preserved, with task management available through Settings.

## Checks

- Core suite: 27 tests covering the new planner, overnight appointments, end-time overflow, and existing SQLite/scheduling behavior.
- Server suite: 7 tests covering provider decoding, request validation/rate limits, and existing auth validation.
- Mobile TypeScript and Expo ESLint pass.
- Server TypeScript build passes.
- Expo production exports succeed for iOS, Android, and web, with SQLite worker/WASM support on web.
- Generic iOS simulator target compiled successfully with the new native speech module and permission descriptions. The rebuilt app was installed and launched on an iPhone 17 Pro simulator; native SQLite hydration and the capture screen were verified.
- Browser: a single paragraph produced five tasks, preserved a 14:00 meeting, saved to SQLite, and showed the daily timeline. Completion advanced the next task and persisted after reload. An additional capture used the real AI service. Replanning moved flexible work earlier, kept the 14:00 meeting fixed, retained completion, and fit previously waiting work into the remaining day.
- Local API: a real Anthropic request returned five validated tasks and concrete proposal steps without requiring account storage.

## Remaining device/release checks

The initial CoreSimulator version mismatch recovered during verification. The app then installed, launched, hydrated SQLite, and rendered its capture screen in Device Hub. Physical microphone verification remains outstanding. Verify voice start/stop, partial/final transcripts, interrupted sessions, denied permissions, and speech-service availability on a physical iPhone and Android device.

The hosted API and previously installed phone app are not modified by source/build changes. Deploy the updated backend for the guest planning endpoint, then install a rebuilt native app. Account PostgreSQL was unavailable locally during verification; unauthenticated planning remained functional.
