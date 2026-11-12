import { test } from "node:test";
import assert from "node:assert/strict";
import { planReminders } from "../src/reminders.ts";
import { defaults, type Task } from "../src/model.ts";

const prefs = { ...defaults, timezone: "UTC", quietStart: "22:00", quietEnd: "07:00" };
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

test("a task gets a start reminder and an end check-in", () => {
  const plan = planReminders([task()], prefs, now);
  assert.deepEqual(
    plan.map((r) => [r.kind, r.at.toISOString()]),
    [
      ["start", "2026-10-18T14:00:00.000Z"],
      ["end", "2026-10-18T15:00:00.000Z"],
    ],
  );
  assert.equal(plan[0].title, "It’s time: Team meeting");
  assert.match(plan[0].body, /^14:00 · 60 min\./);
});

test("follow-ups follow the accountability mode", () => {
  const kinds = (mode: "Gentle" | "Firm" | "Strict") =>
    planReminders([task()], { ...prefs, mode }, now).filter((r) => r.kind === "followup").length;
  assert.equal(kinds("Gentle"), 0);
  assert.equal(kinds("Firm"), 1);
  assert.equal(kinds("Strict"), 2);
  const strict = planReminders([task()], { ...prefs, mode: "Strict" }, now);
  assert.deepEqual(
    strict.filter((r) => r.kind === "followup").map((r) => r.at.toISOString()),
    ["2026-10-18T14:10:00.000Z", "2026-10-18T14:20:00.000Z"],
  );
});

test("done, unscheduled, past and far-off tasks get nothing", () => {
  assert.equal(planReminders([task({ status: "completed", completedAt: now.toISOString() })], prefs, now).length, 0);
  assert.equal(planReminders([task({ scheduledAt: null })], prefs, now).length, 0);
  assert.equal(planReminders([task({ scheduledAt: "2026-10-18T07:00:00.000Z", duration: 30 })], prefs, now).length, 0);
  assert.equal(planReminders([task({ scheduledAt: "2026-10-25T14:00:00.000Z" })], prefs, now).length, 0);
});

test("a task already running still gets its end check-in", () => {
  const plan = planReminders([task({ scheduledAt: "2026-10-18T08:30:00.000Z" })], prefs, now);
  assert.deepEqual(plan.map((r) => r.kind), ["end"]);
});

test("the chosen start time always fires; quiet hours silence only nudges", () => {
  const late = task({ scheduledAt: "2026-10-18T22:30:00.000Z", duration: 30 });
  const plan = planReminders([late], { ...prefs, mode: "Strict" }, now);
  assert.deepEqual(plan.map((r) => r.kind), ["start"]);
});

test("shared tasks name the teammate, and the list is capped in time order", () => {
  const shared = planReminders([{ ...task(), with: "Ada" }], prefs, now);
  assert.match(shared[0].body, /with Ada/);
  const many = Array.from({ length: 40 }, (_, i) =>
    task({ id: `t${i}`, scheduledAt: new Date(now.getTime() + (i + 1) * 3600000).toISOString(), duration: 15 }),
  );
  const capped = planReminders(many, prefs, now, 48, 60);
  assert.equal(capped.length, 60);
  assert.ok(capped.every((r, i) => i === 0 || r.at >= capped[i - 1].at));
});
