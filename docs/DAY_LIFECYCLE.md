# Day lifecycle upgrades

2026-10-18

## Delivered

- Replaced immediate “Replan from now” with “My day changed”: availability shortcuts, explicit start/end times, a task-by-task preview, overflow and overlap warnings, then an explicit save. Replanning uses the existing scheduling rules. Workspace revision checks run inside the write queue and again on the server. Saving an old preview recomputes times and requires review if the clock changes the proposal.
- Added daily, weekday, and weekly repeat rules to task editing. Deterministic occurrence IDs prevent duplicates across refreshes/devices; each occurrence has separate completion state. The app prepares the next seven days while open, retaining local wall-clock times across DST. Deleting an occurrence atomically records an exception on the original task so sync cannot recreate it. Existing occurrences remain when the original rule changes or stops; repeat invitations are not copied.
- Added this-day/previous-day wrap-up with completed counts, estimated completed minutes, unfinished tasks, explicit selection, and atomic carry-forward. Carry-forward preserves task identity and day history. Fixed appointments and repeat occurrences are excluded from carry-forward so their dates require an explicit edit and repeats do not multiply.
- Extended client and API validation and cloud serialization for repeat rules, occurrence identity, exceptions, and carry-forward history. These are optional JSON payload fields, so existing tasks need no backfill or SQL schema change.

## Verification

- 41 core tests pass, covering repeat identity, independent completion, weekday/weekly boundaries, future starts, DST wall-clock preservation, deletion exceptions, carry history, revised availability, fixed/completed preservation, and validation.
- 35 server tests pass with the local PostgreSQL database, with no skips. The new lifecycle integration test uses an isolated schema, verifies metadata restoration and stale revision rejection, and removes the schema afterward.
- Mobile TypeScript, ESLint, and server TypeScript build pass.
- Production web export succeeds.

## Remaining verification and rollout

No browser is connected to this agent session, so interactive visual verification was unavailable. Exercise the three flows in the local preview, including large text and narrow layouts, then on rebuilt iOS and Android apps. The changes have not been deployed to the hosted API or shipped to an installed phone app. Deploy the matching backend before rolling out clients, because older backend code strips the new optional task fields.

Repeat generation needs Tempo to be open and online; it does not promise indefinite background scheduling. Local reminder scheduling and push delivery remain subject to their existing device verification requirements.
