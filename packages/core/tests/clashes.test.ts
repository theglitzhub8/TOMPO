import { test } from "node:test";
import assert from "node:assert/strict";
import { clashOptions, findClashes } from "../src/clashes.ts";
import type { Routine, Task } from "../src/model.ts";

// 2026-11-16 is a Monday.
const cls: Routine = { id: "cls", title: "Class", start: "08:00", duration: 120, days: [1, 3], protected: true };
const gym: Routine = { id: "gym", title: "Gym", start: "10:30", duration: 60, days: [1], protected: true };
const dentist: Task = {
  id: "d", title: "Dentist", duration: 30, projectId: null, status: "pending",
  scheduledAt: "2026-11-17T09:00:00.000Z", completedAt: null, fixed: true,
};
const ctx = { routines: [cls, gym], tasks: [dentist], timezone: "UTC" };

test("a time inside a weekly task or appointment clashes; free time doesn't", () => {
  assert.deepEqual(findClashes({ day: "2026-11-16", clock: "09:00", duration: 60 }, ctx).map((c) => c.id), ["cls"]);
  assert.deepEqual(findClashes({ day: "2026-11-17", clock: "08:45", duration: 30 }, ctx).map((c) => c.id), ["d"]);
  assert.equal(findClashes({ day: "2026-11-16", clock: "10:00", duration: 30 }, ctx).length, 0);
  // Skipping class this Monday frees the slot.
  const skipped = { ...ctx, routines: [{ ...cls, skippedDays: ["2026-11-16"] }, gym] };
  assert.equal(findClashes({ day: "2026-11-16", clock: "09:00", duration: 60 }, skipped).length, 0);
});

test("options skip past back-to-back blocks and find the next free day", () => {
  // After class (10:00) a 60-minute task would hit gym at 10:30, so it lands after gym.
  const options = clashOptions({ day: "2026-11-16", clock: "09:00", duration: 60 }, ctx);
  assert.deepEqual(options.after, { day: "2026-11-16", clock: "11:30", duration: 60 });
  // Tuesday 9:00 has the dentist and Wednesday has class: Thursday is free.
  assert.deepEqual(options.nextDay, { day: "2026-11-19", clock: "09:00", duration: 60 });
  assert.equal(clashOptions({ day: "2026-11-16", clock: "12:00", duration: 30 }, ctx).clashes.length, 0);
});
