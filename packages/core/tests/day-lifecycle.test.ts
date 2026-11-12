import { test } from "node:test";
import assert from "node:assert/strict";
import { recurringOccurrences, skipOccurrences, carryForward, dayReview, reviseDay, shiftDay } from "../src/day-lifecycle.ts";
import { validate, type Task } from "../src/model.ts";
const day = "2026-10-19";
const zone = "Asia/Shanghai";
const task = (changes: Partial<Task> = {}): Task => ({ id: "task-1", title: "Write", duration: 30, status: "pending",
  completedAt: null, projectId: null, scheduledAt: null, plannedDay: day, fixed: false, ...changes });

test("recurrences have stable IDs, independent status and no duplicate generation", () => {
  const root = task({ recurrence: { startDay: day, days: [0,1,2,3,4,5,6] }, status: "completed", completedAt: "2026-10-19T02:00:00Z" });
  const generated = recurringOccurrences([root], day, zone);
  assert.equal(generated.length, 6);
  assert.ok(generated.every(t => t.status === "pending" && t.completedAt === null && !t.recurrence));
  assert.equal(recurringOccurrences([root, ...generated], day, zone).length, 0);
  assert.deepEqual(recurringOccurrences([root], day, zone), generated);
  assert.equal(recurringOccurrences([{ ...root, recurrence: undefined }, ...generated], shiftDay(day, 7), zone).length, 0);
});

test("weekdays, weekly repeats, future starts and local fixed clocks are respected", () => {
  const root = task({ fixed: true, scheduledAt: "2026-10-19T01:00:00Z", recurrence: { startDay: day, days: [1,2,3,4,5] } });
  const generated = recurringOccurrences([root], day, zone);
  assert.equal(generated.length, 4);
  assert.equal(generated[0].scheduledAt, "2026-10-20T01:00:00.000Z");
  assert.equal(recurringOccurrences([{ ...root, recurrence: { startDay: "2026-11-01", days: [1] } }], day, zone).length, 0);
  assert.equal(recurringOccurrences([{ ...root, recurrence: { startDay: day, days: [1] } }], shiftDay(day, 1), zone)[0].plannedDay, "2026-10-26");
});

test("recurrence uses the same wall clock across DST rather than adding 24 hours", () => {
  const root = task({ plannedDay: "2026-10-31", fixed: true, scheduledAt: "2026-10-31T13:00:00Z",
    recurrence: { startDay: "2026-10-31", days: [0,1,2,3,4,5,6] } });
  assert.equal(recurringOccurrences([root], "2026-11-01", "America/New_York")[0].scheduledAt, "2026-11-01T14:00:00.000Z");
});

test("carry forward keeps identity and history, and rejects appointments and repeat occurrences", () => {
  const original = task();
  const [moved] = carryForward([original], [original.id], day, zone);
  assert.equal(moved.id, original.id);
  assert.equal(moved.plannedDay, "2026-10-20");
  assert.deepEqual(moved.carriedFrom, [day]);
  assert.equal(moved.scheduledAt, null);
  assert.equal(original.plannedDay, day);
  for (const invalid of [task({ fixed: true }), task({ seriesId: "root", occurrenceDay: day }), task({ recurrence: { startDay: day, days: [1] } })])
    assert.throws(() => carryForward([invalid], [invalid.id], day, zone));
  assert.throws(() => carryForward([moved], [moved.id], day, zone));
});

test("wrap-up retains carried work in the original day without counting tomorrow’s completion", () => {
  const [moved] = carryForward([task()], ["task-1"], day, zone);
  const done = { ...moved, status: "completed" as const, completedAt: "2026-10-20T02:00:00Z" };
  const review = dayReview([done], day, zone);
  assert.equal(review.planned.length, 1);
  assert.equal(review.carried.length, 1);
  assert.equal(review.completed.length, 0);
  assert.equal(dayReview([done], "2026-10-20", zone).minutes, 30);
});

test("revised availability preserves fixed/completed work, fits flexible tasks, and surfaces overflow", () => {
  const fixed = task({ id: "meeting", fixed: true, scheduledAt: "2026-10-19T06:00:00Z", duration: 60 });
  const done = task({ id: "done", status: "completed", completedAt: "2026-10-19T01:30:00Z", scheduledAt: "2026-10-19T01:00:00Z" });
  const flexible = task({ scheduledAt: "2026-10-19T02:00:00Z" });
  const plan = reviseDay([fixed, done, flexible, task({ id: "overflow", duration: 120 })], [], day, zone,
    new Date("2026-10-19T04:00:00Z"), "13:30", "15:00");
  assert.equal(plan.tasks.find(t => t.id === "task-1")!.scheduledAt, "2026-10-19T05:30:00.000Z");
  assert.equal(plan.tasks.find(t => t.id === "meeting")!.scheduledAt, fixed.scheduledAt);
  assert.deepEqual(plan.tasks.find(t => t.id === "done"), done);
  assert.equal(plan.overflow[0].id, "overflow");
  assert.throws(() => reviseDay([flexible], [], day, zone, new Date("2026-10-19T04:00:00Z"), "16:00", "15:00"));
});

test("lifecycle validation rejects malformed metadata and impossible dates", () => {
  assert.throws(() => validate("task", task({ recurrence: { days: [7], startDay: day } })));
  assert.throws(() => validate("task", task({ recurrence: { days: [1], startDay: "2026-02-30" } })));
  assert.throws(() => validate("task", task({ seriesId: "root" })));
  assert.throws(() => validate("task", task({ carriedFrom: ["2026-02-30"] })));
  assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
});

 test("deleting an occurrence records an exception and does not recreate it", () => {
  const root = task({ recurrence: { startDay: day, days: [0,1,2,3,4,5,6] } });
  const generated = recurringOccurrences([root], day, zone);
  const [updatedRoot] = skipOccurrences([root, ...generated], [generated[0].id]);
  const remaining = [updatedRoot, ...generated.slice(1)];
  assert.equal(recurringOccurrences(remaining, day, zone).length, 0);
  assert.deepEqual(updatedRoot.recurrence!.skippedDays, ["2026-10-20"]);
});
