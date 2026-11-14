import { test } from "node:test";
import assert from "node:assert/strict";
import { progress } from "../src/progress.ts";
import type { Task } from "../src/model.ts";

let n = 0;
const task = (day: string, done: boolean): Task => ({
  id: `t${n++}`, title: "x", duration: 30, projectId: null, plannedDay: day,
  status: done ? "completed" : "pending", completedAt: done ? `${day}T10:00:00Z` : null, scheduledAt: null,
});

test("the streak counts days that hit 80%, skipping empty days and stopping at a miss", () => {
  const tasks = [
    task("2026-11-14", true), task("2026-11-14", false), // today 50%: not yet counted
    task("2026-11-13", true),
    // 2026-11-12: nothing planned, the run continues
    task("2026-11-11", true), task("2026-11-11", true), task("2026-11-11", true), task("2026-11-11", true), task("2026-11-11", false),
    task("2026-11-10", false), // a miss ends the run
    task("2026-11-09", true),
  ];
  const p = progress(tasks, "2026-11-14", "UTC");
  assert.equal(p.streak, 2);
  assert.deepEqual(p.today, { planned: 2, done: 1, score: 50, met: false });
  // 7 done × 10 + 3 good days (13th, 11th, 9th) × 50
  assert.equal(p.points, 220);
  assert.equal(progress([...tasks, task("2026-11-14", true), task("2026-11-14", true), task("2026-11-14", true)], "2026-11-14", "UTC").streak, 3);
});
