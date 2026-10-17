import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  parseCapture,
  validateCapture,
  captureTasks,
  buildDay,
} from "../src/day-planner.ts";
import { localParts } from "../src/scheduling.ts";
import { Repository, type Database } from "../src/repository.ts";
import { defaults, type Task, type Routine } from "../src/model.ts";
const zone = "Asia/Shanghai";
const day = "2026-10-17";
const now = new Date("2026-10-17T00:00:00Z");
function extract(text: string) {
  let i = 0;
  return captureTasks(parseCapture(text).items, day, zone, () => `t-${i++}`);
}
function time(t: Task) {
  return t.scheduledAt && localParts(new Date(t.scheduledAt), zone).clock;
}

test("one spoken paragraph becomes distinct tasks with a fixed afternoon meeting", () => {
  const capture = parseCapture(
    "I need to wash clothes, finish my proposal, buy groceries, and call Mum. I have a meeting at 2pm.",
  );
  assert.deepEqual(
    capture.items.map((i) => i.title),
    [
      "Wash clothes",
      "Finish my proposal",
      "Buy groceries",
      "Call Mum",
      "Meeting",
    ],
  );
  assert.equal(capture.items[4].clock, "14:00");
  assert.equal(capture.items[1].duration, 60);
  assert.equal(capture.items[3].duration, 15);
  assert.equal(capture.source, "local");
});
test("duration and explicit 24-hour appointment times survive extraction", () => {
  const tasks = extract(
    "Write proposal for 2 hours; meeting at 14:30 for 45 minutes; call Mum for 10 minutes",
  );
  assert.deepEqual(
    tasks.map((t) => t.duration),
    [120, 45, 10],
  );
  assert.equal(time(tasks[1]), "14:30");
  assert.equal(tasks[1].fixed, true);
});
test("ambiguous afternoon time is visible as an assumption", () => {
  const capture = parseCapture("Meeting at 2");
  assert.equal(capture.items[0].clock, "14:00");
  assert.ok(capture.notes.some((n) => n.includes("Assumed")));
});
test("invalid times, task lengths, blank and oversized inputs are rejected", () => {
  for (const input of [
    "",
    "Meeting at 25:00",
    "Meeting at 12:70",
    "Meeting at 14pm",
    "Read for 0 minutes",
    "Read for 25 hours",
    "x".repeat(12001),
  ])
    assert.throws(() => parseCapture(input));
});
test("provider content is validated before it can become saved tasks", () => {
  for (const response of [
    { tasks: [] },
    { tasks: [{ title: "Read", duration: -1, clock: null, steps: [] }] },
    { tasks: [{ title: "Read", duration: 30, clock: "29:00", steps: [] }] },
    { tasks: [{ title: "Read", duration: 30, clock: null, steps: [23] }] },
  ])
    assert.throws(() => validateCapture(response));
  assert.equal(
    validateCapture({
      tasks: [
        {
          title: "Read",
          duration: 30,
          clock: null,
          steps: ["Choose a chapter"],
        },
      ],
    }).length,
    1,
  );
});
test("fixed appointments, routines, breaks and existing future dates are respected", () => {
  const tasks = extract(
    "Read for 60 minutes; meeting at 9am for 30 minutes; buy groceries for 45 minutes",
  );
  const routines: Routine[] = [
    {
      id: "meal",
      title: "Breakfast",
      start: "08:00",
      duration: 30,
      days: [6],
      protected: true,
    },
  ];
  const future = {
    ...tasks[0],
    id: "future",
    plannedDay: "2026-10-18",
    scheduledAt: "2026-10-18T01:00:00Z",
    fixed: true,
  };
  const plan = buildDay([...tasks, future], routines, day, zone, now);
  assert.equal(time(plan.tasks[0]), "09:30");
  assert.equal(time(plan.tasks[1]), "09:00");
  assert.equal(time(plan.tasks[2]), "10:40");
  assert.equal(plan.tasks[3].scheduledAt, future.scheduledAt);
  assert.ok(plan.blocks.some((b) => b.kind === "break" && b.duration === 10));
});
test("late days keep overflow saved and never schedule flexible work in the past", () => {
  const tasks = extract("Study for 120 minutes; call Mum for 10 minutes");
  const late = new Date("2026-10-17T12:30:01Z");
  const plan = buildDay(tasks, [], day, zone, late);
  assert.equal(plan.overflow.length, 1);
  assert.equal(time(plan.tasks[1]), "20:35");
  assert.equal(plan.tasks[0].scheduledAt, null);
  assert.equal(
    buildDay(tasks, [], day, zone, new Date("2026-10-17T15:59:59Z")).overflow
      .length,
    2,
  );
});
test("replanning leaves completed work, fixed appointments and other days intact", () => {
  const first = buildDay(
    extract("Read for 30 minutes; call Mum; meeting at 2pm"),
    [],
    day,
    zone,
    now,
  );
  first.tasks[0].status = "completed";
  first.tasks[0].completedAt = now.toISOString();
  const revised = buildDay(
    first.tasks,
    [],
    day,
    zone,
    new Date("2026-10-17T03:01:00Z"),
    "21:00",
    true,
  );
  assert.equal(time(revised.tasks[0]), time(first.tasks[0]));
  assert.equal(time(revised.tasks[1]), "11:05");
  assert.equal(time(revised.tasks[2]), "14:00");
});
test("overlapping appointments and routines produce an actionable conflict", () => {
  const p = buildDay(
    extract("Meeting at 2pm for 60 minutes; dentist at 2:30pm for 30 minutes"),
    [],
    day,
    zone,
    now,
  );
  assert.ok(p.warnings.some((w) => w.includes("overlaps")));
});
test("loading a saved plan never creates duplicate tasks or changes existing times", () => {
  const initial = buildDay(extract("Read; call Mum"), [], day, zone, now);
  const reload = buildDay(
    initial.tasks,
    [],
    day,
    zone,
    new Date("2026-10-17T01:00:00Z"),
  );
  assert.deepEqual(reload.tasks, initial.tasks);
  assert.equal(new Set(reload.tasks.map((t) => t.id)).size, 2);
});
test("task metadata and end time save atomically and survive reopening the repository", async () => {
  const db = new DatabaseSync(":memory:");
  const adapter: Database = {
    execAsync: async (sql) => {
      db.exec(sql);
    },
    runAsync: async (sql, ...params) => db.prepare(sql).run(...params),
    getAllAsync: async <T>(
      sql: string,
      ...params: (string | number | null)[]
    ) => db.prepare(sql).all(...params) as T[],
  };
  try {
    let repo = new Repository(adapter);
    await repo.initialize();
    const task = {
      ...extract("Finish proposal")[0],
      steps: ["Outline", "Draft", "Review"],
    };
    db.exec(
      "CREATE TRIGGER fail_plan BEFORE INSERT ON entities WHEN NEW.kind='preferences' BEGIN SELECT RAISE(ABORT,'disk failure'); END;",
    );
    await assert.rejects(
      repo.saveBatch([
        { kind: "task", entity: task },
        { kind: "preferences", entity: { ...defaults, dayEnd: "18:00" } },
      ]),
    );
    assert.equal((await repo.list("task")).length, 0);
    assert.equal((await repo.pendingChanges()).length, 0);
    db.exec("DROP TRIGGER fail_plan");
    await repo.saveBatch([
      { kind: "task", entity: task },
      { kind: "preferences", entity: { ...defaults, dayEnd: "18:00" } },
    ]);
    repo = new Repository(adapter);
    await repo.initialize();
    assert.deepEqual((await repo.list("task"))[0], task);
    assert.equal((await repo.preferences()).dayEnd, "18:00");
  } finally {
    db.close();
  }
});
test("a previous day’s overnight appointment still protects the next morning", () => {
  const overnight = {
    ...extract("Night shift for 600 minutes")[0],
    id: "overnight",
    scheduledAt: "2026-10-16T15:00:00Z",
    plannedDay: "2026-10-16",
    fixed: true,
  };
  const plan = buildDay(
    [overnight, ...extract("Call Mum")],
    [],
    day,
    zone,
    now,
  );
  assert.equal(time(plan.tasks[1]), "09:00");
  assert.ok(
    plan.blocks.some(
      (b) => b.id === overnight.id && b.start === overnight.scheduledAt,
    ),
  );
});
test("shorter end times leave overflow saved when replanning a full day", () => {
  const initial = buildDay(
    extract("Read for 60 minutes; study for 120 minutes"),
    [],
    day,
    zone,
    now,
  );
  const replanned = buildDay(
    initial.tasks,
    [],
    day,
    zone,
    new Date("2026-10-17T01:15:00Z"),
    "10:00",
    true,
  );
  assert.equal(replanned.overflow.length, 2);
  assert.ok(replanned.tasks.every((t) => t.scheduledAt === null));
});
