# Device acceptance checklist

Run on both iOS and Android development builds; bundle export alone is not a launch test.

1. Launch, open preferences, save Asia/Shanghai and quiet hours. Relaunch and verify preferences persist.
2. Create a project and a task with apostrophes / Chinese text; assign the project. Edit task title, estimate and local start. Complete/reopen/postpone it. Force-close and reopen; inspect the saved state.
3. Configure sleep 23:00 for 480 minutes, daily lunch, and exercise on selected days. Generate a day plan; confirm no overlaps, existing scheduled tasks unchanged, and overflow remains unscheduled.
4. Navigate Today, onboarding, planning, Projects, Tasks/focus, assistant simulation, Health/routines, Reports, Settings and notification test. Verify back navigation, keyboard behavior, large fonts and safe areas.
5. Start and end simulation, then opt out. Confirm it is visibly labeled and no microphone / telephone activity occurs.
6. Try a New York DST gap and ambiguous time; verify an actionable error. Test date boundaries in Shanghai and fractional offsets in Kathmandu.
7. Disable network and repeat persistence tests. Changes should stay local; no server sync success should be claimed.

Notification delivery checks are deferred until the native notification integration exists. Current notification route must show that permission status has not been queried, rather than inventing permission state.
