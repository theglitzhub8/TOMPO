import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWeek } from "../src/week-planner.ts";
import { parseCapture, captureTasks, buildDay } from "../src/day-planner.ts";
import { calendarTasks, calendarText } from "../src/calendar.ts";
import type { Task } from "../src/model.ts";
const day = "2026-10-19",
  zone = "Asia/Shanghai",
  now = new Date("2026-10-19T00:00:00Z");
const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  title: id,
  projectId: null,
  duration: 60,
  status: "pending",
  completedAt: null,
  scheduledAt: null,
  fixed: false,
  plannedDay: day,
  ...extra,
});
test("weekly planning spreads overflow across days, respects deadlines, and leaves fixed/completed tasks alone", () => {
  const fixed = task("meeting", {
    fixed: true,
    scheduledAt: "2026-10-19T00:00:00Z",
  });
  const done = task("done", {
    status: "completed",
    completedAt: "2026-10-19T01:00:00Z",
  });
  const result = buildWeek(
    [
      fixed,
      done,
      task("urgent", { priority: "high", dueDay: day }),
      task("later"),
    ],
    [],
    ["urgent", "later", "meeting", "done"],
    day,
    zone,
    now,
    "10:00",
  );
  assert.equal(
    result.tasks.find((t) => t.id === "urgent")!.scheduledAt,
    "2026-10-19T01:00:00.000Z",
  );
  assert.equal(
    result.tasks.find((t) => t.id === "later")!.plannedDay,
    "2026-10-20",
  );
  assert.deepEqual(
    result.tasks.find((t) => t.id === "meeting"),
    fixed,
  );
  assert.deepEqual(
    result.tasks.find((t) => t.id === "done"),
    done,
  );
});
test("project busy time protects teammates without blocking unrelated work", () => {
  const result = buildWeek(
    [task("shared", { projectId: "p" }), task("private")],
    [],
    ["shared", "private"],
    day,
    zone,
    now,
    "10:00",
    [
      {
        id: "busy",
        projectId: "p",
        start: "2026-10-19T00:00:00Z",
        duration: 120,
      },
    ],
  );
  assert.equal(
    result.tasks.find((t) => t.id === "shared")!.plannedDay,
    "2026-10-20",
  );
  assert.equal(result.tasks.find((t) => t.id === "private")!.plannedDay, day);
});
test("unfittable deadline work is waiting rather than silently scheduled late", () => {
  const plan = buildWeek(
    [task("too-long", { duration: 180, dueDay: day })],
    [],
    ["too-long"],
    day,
    zone,
    now,
    "09:00",
  );
  assert.equal(plan.waiting.length, 1);
  assert.equal(plan.tasks[0].scheduledAt, null);
  assert.match(plan.warnings[0], /deadline/);
});
test("capture retains deadlines, priorities and named projects independently of appointment times", () => {
  const result = parseCapture(
    "Finish report by tomorrow urgent for project Launch for 60 minutes; meeting at 14:00",
    day,
  );
  assert.equal(result.items[0].dueDay, "2026-10-20");
  assert.equal(result.items[0].priority, "high");
  assert.equal(result.items[0].project, "Launch");
  const tasks = captureTasks(result.items, day, zone, () =>
    Math.random().toString(36).slice(2),
  );
  assert.equal(tasks[0].dueDay, "2026-10-20");
  assert.equal(tasks[0].scheduledAt, null);
  assert.equal(tasks[1].fixed, true);
});
test("day planning ranks deadline work and explicit priority before normal flexible work", () => {
  const plan = buildDay(
    [
      task("normal"),
      task("high", { priority: "high" }),
      task("due", { dueDay: day }),
    ],
    [],
    day,
    zone,
    now,
    "09:00",
  );
  assert.ok(plan.tasks.find((t) => t.id === "due")!.scheduledAt);
  assert.equal(plan.tasks.find((t) => t.id === "normal")!.scheduledAt, null);
});
test("calendar import is idempotent, fixed, and safely exports punctuation", () => {
  const events = [
    {
      id: "external-calendar-event",
      title: "Meet, review; plan\nnext",
      start: "2026-10-19T02:00:00Z",
      duration: 30,
    },
  ];
  const added = calendarTasks(events, [], zone);
  assert.equal(added[0].fixed, true);
  assert.equal(calendarTasks(events, added, zone).length, 0);
  const text = calendarText(added);
  assert.match(text, /DTSTART:20261019T020000Z/);
  assert.match(text, /SUMMARY:Meet\\, review\\; plan\\nnext/);
});
test("weekly selection does not schedule unselected waiting work or move repeats off their date", () => {
  const root = task("repeat", {
    plannedDay: "2026-10-21",
    seriesId: "root",
    occurrenceDay: "2026-10-21",
  });
  const untouched = task("waiting", { duration: 1440 });
  const plan = buildWeek(
    [root, untouched, task("selected")],
    [],
    [root.id, "selected"],
    day,
    zone,
    now,
    "09:00",
  );
  assert.equal(plan.tasks.find((t) => t.id === "selected")!.plannedDay, day);
  assert.equal(
    plan.tasks.find((t) => t.id === "repeat")!.plannedDay,
    "2026-10-21",
  );
  assert.equal(plan.tasks.find((t) => t.id === "waiting")!.scheduledAt, null);
});
test("weekly scheduling leaves breathing room and lists each day in time order",()=>{
  const plan=buildWeek([task("later"),task("due",{dueDay:day})],[],["later","due"],day,zone,now,"12:00");
  const items=plan.days[0].tasks;
  assert.equal(items[0].id,"due");
  assert.ok(Date.parse(items[1].scheduledAt!)-Date.parse(items[0].scheduledAt!)>=70*60000);
});
