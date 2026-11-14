import { test } from "node:test";
import assert from "node:assert/strict";
import { planReminders } from "../src/reminders.ts";
import { defaults, type Task } from "../src/model.ts";

const prefs = { ...defaults, mode: "Gentle" as const, timezone: "UTC", quietStart: "22:00", quietEnd: "07:00" };
const now = new Date("2026-10-18T09:00:00.000Z");
const task = (over: Partial<Task> = {}): Task => ({
  id: "t1",
  title: "Team meeting",
  projectId: null,
  duration: 60,
  status: "pending",
  scheduledAt: "2026-10-18T14:00:00.000Z",
  completedAt: null,
  fixed: true,
  ...over,
});

test("a task gets a heads-up, a start reminder and an end check-in", () => {
  const plan = planReminders([task({ note: "Bring the slides." })], prefs, now);
  assert.deepEqual(
    plan.map((r) => [r.kind, r.at.toISOString()]),
    [
      ["headsup", "2026-10-18T13:30:00.000Z"],
      ["start", "2026-10-18T14:00:00.000Z"],
      ["end", "2026-10-18T15:00:00.000Z"],
    ],
  );
  assert.equal(plan[0].body, "14:00. Bring the slides.");
  assert.equal(plan[1].title, "It’s time: Team meeting");
  assert.match(plan[1].body, /^14:00 · 60 min\./);
});

test("the ladder climbs with the mode and stops once the task is started", () => {
  const ladder = (mode: "Gentle" | "Firm" | "Strict", over: Partial<Task> = {}) =>
    planReminders([task(over)], { ...prefs, mode }, now)
      .filter((r) => r.kind === "followup")
      .map((r) => [r.at.toISOString(), !!r.urgent]);
  assert.deepEqual(ladder("Gentle"), []);
  assert.deepEqual(ladder("Firm"), [["2026-10-18T14:05:00.000Z", false]]);
  assert.deepEqual(ladder("Strict"), [
    ["2026-10-18T14:05:00.000Z", false],
    ["2026-10-18T14:15:00.000Z", true],
  ]);
  assert.deepEqual(ladder("Strict", { startedAt: "2026-10-18T14:01:00.000Z" }), []);
  // A 10-minute task ends before the check-in would fire.
  assert.deepEqual(ladder("Strict", { duration: 10 }), [["2026-10-18T14:05:00.000Z", false]]);
});

test("done, unscheduled, past and far-off tasks get nothing", () => {
  assert.equal(planReminders([task({ status: "completed", completedAt: now.toISOString() })], prefs, now).length, 0);
  assert.equal(planReminders([task({ scheduledAt: null })], prefs, now).length, 0);
  assert.equal(planReminders([task({ scheduledAt: "2026-10-18T07:00:00.000Z", duration: 30 })], prefs, now).length, 0);
  assert.equal(planReminders([task({ scheduledAt: "2026-10-25T14:00:00.000Z" })], prefs, now).length, 0);
});

test("a task already running still gets its end check-in", () => {
  const plan = planReminders([task({ scheduledAt: "2026-10-18T08:30:00.000Z" })], prefs, now);
  // Already under way: no heads-up, no start.
  assert.deepEqual(plan.map((r) => r.kind), ["end"]);
});

test("the chosen start time always fires; quiet hours silence only nudges", () => {
  const late = task({ scheduledAt: "2026-10-18T22:30:00.000Z", duration: 30 });
  const plan = planReminders([late], { ...prefs, mode: "Strict" }, now);
  assert.deepEqual(plan.map((r) => r.kind), ["start"]);
});

test("shared tasks name the teammate, and the list is capped in time order", () => {
  const shared = planReminders([{ ...task(), with: "Ada" }], prefs, now);
  assert.match(shared[1].body, /with Ada/);
  const many = Array.from({ length: 40 }, (_, i) =>
    task({ id: `t${i}`, scheduledAt: new Date(now.getTime() + (i + 1) * 3600000).toISOString(), duration: 15 }),
  );
  const capped = planReminders(many, prefs, now, 48, 60);
  assert.equal(capped.length, 60);
  assert.ok(capped.every((r, i) => i === 0 || r.at >= capped[i - 1].at));
});
