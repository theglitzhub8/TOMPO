# Approved Figma implementation

Source: https://www.figma.com/file/ANBNoUJ3W4VZ78q3XfXJg0?node-id=0%3A1

All nine screen frames were read through Figma design context with their rendered screenshots. The page itself is a canvas; implementation used the individual frames rather than the sparse canvas metadata.

| Figma frame | React Native route |
| --- | --- |
| `1:2` Onboarding | `src/app/onboarding.tsx` |
| `1:27` Morning Planning | `src/app/(tabs)/planning.tsx` |
| `1:60` Today | `src/app/(tabs)/index.tsx` |
| `1:95` Projects | `src/app/(tabs)/projects.tsx` |
| `1:134` Tasks | `src/app/(tabs)/tasks.tsx` |
| `1:178` AI Voice Calls | `src/app/(tabs)/assistant.tsx` |
| `1:208` Routines | `src/app/(tabs)/health.tsx` |
| `1:241` Reports | `src/app/reports.tsx` |
| `1:275` Settings | `src/app/(tabs)/settings.tsx` |

## Changes

- `src/design/tokens.ts`: approved pale background, dark teal/mint surfaces, text colors, card radii and Inter font names.
- `assets/fonts/Inter-{Regular,Bold}.ttf`, `assets/fonts/OFL.txt`: bundled Inter fonts, loaded by the existing Expo Font library. Obtained from `@expo-google-fonts/inter` 0.4.2; no extra runtime dependency. Both weights are local and available offline.
- `src/components/ui.tsx`: shared logo/date header, eyebrow/title spacing, rounded cards, dark progress cards, buttons and compact typography. Layout uses flexbox and native safe areas rather than exported absolute positioning.
- `src/components/navigation.tsx`, `src/app/(tabs)/_layout.tsx`: approved Today / Plan / Projects / Tasks / Calls bottom navigation; Plan and Calls are primary tab routes. Routines and Settings remain reachable from Today and Settings links. Secondary screens retain the same bottom navigation.
- `src/components/{task-editor,routine-editor}.tsx`: existing tested forms and focus timer are reused behind compact summary cards.
- `src/components/preferences.tsx`: compact radio-style accountability mode selector.
- All nine screen routes: design layouts connected to persisted data and existing actions. Settings and task/project cards open their editors when tapped.

## Intentional functional adaptations

The prototype's sample projects, tasks, completion percentages and enabled routines are dynamic records, not seeded production data. Empty states are explicit. Dates follow the configured IANA timezone. Native safe areas, scrollable overflow and 44-point interactive targets take precedence over clipped prototype text boxes.

Morning planning accepts one manually entered task per line with editable duration estimates; the planner is labeled local and does not imply AI extraction/ranking. Protected routines and existing appointments are preserved. The call panel is always labeled **SIMULATION** and gated by explicit consent; it does not emulate a system incoming call. Notification/provider availability is stated honestly.

The Figma frames contain native text, Unicode symbols and rounded shapes, with no image or SVG asset downloads returned. The screenshots are visual references only and are not embedded in the app.

## Verification

See `IMPLEMENTATION.md` for foundation test results. Native visual/navigation checks and final bundle/lint/typecheck results for this design pass are recorded after verification.
