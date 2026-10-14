import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repository, type Database } from "../src/repository.ts";
import { defaults, type Task, type Routine } from "../src/model.ts";
import {
  localInstant,
  localParts,
  planDay,
  reminderPlan,
  isQuiet,
  planningStart,
} from "../src/scheduling.ts";
function adapter(db: DatabaseSync): Database {
  return {
    execAsync: async (sql) => {
      db.exec(sql);
    },
    runAsync: async (sql, ...params) => db.prepare(sql).run(...params),
    getAllAsync: async <T>(
      sql: string,
      ...params: (string | number | null)[]
    ) => db.prepare(sql).all(...params) as T[],
  };
}
function task(id = "t1", extra: Partial<Task> = {}): Task {
  return {
    id,
    title: "Write proposal",
    duration: 25,
    projectId: null,
    status: "pending",
    scheduledAt: null,
    completedAt: null,
    ...extra,
  };
}
function routine(extra: Partial<Routine> = {}): Routine {
  return {
    id: "lunch",
    title: "Lunch",
    start: "12:00",
    duration: 60,
    days: [0, 1, 2, 3, 4, 5, 6],
    protected: true,
    ...extra,
  };
}
test("tasks, projects, routines, preferences and outbox survive a real SQLite close and reopen", async () => {
  const folder = mkdtempSync(join(tmpdir(), "tempo-"));
  const path = join(folder, "test.db");
  let db = new DatabaseSync(path);
  try {
    let repo = new Repository(adapter(db));
    await repo.initialize();
    await repo.initialize();
    await repo.save("project", { id: "p1", title: "Client's project" });
    await repo.save("task", task("t1", { projectId: "p1" }));
    await repo.save("routine", routine());
    await repo.save("preferences", { ...defaults, mode: "Strict" });
    await repo.save(
      "task",
      task("t1", {
        projectId: "p1",
        title: "Edited",
        status: "completed",
        completedAt: "2026-10-12T04:00:00Z",
      }),
    );
    db.close();
    db = new DatabaseSync(path);
    repo = new Repository(adapter(db));
    await repo.initialize();
    assert.equal((await repo.list("task"))[0].title, "Edited");
    assert.equal((await repo.list("task"))[0].status, "completed");
    assert.equal((await repo.list("project"))[0].title, "Client's project");
    assert.deepEqual(await repo.list("routine"), [routine()]);
    assert.equal((await repo.preferences()).mode, "Strict");
    assert.equal((await repo.pendingChanges()).length, 5);
    assert.equal((await repo.pendingChanges()).at(-1)?.revision, 2);
  } finally {
    db.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
test("failure to write outbox rolls back entity, and later writes recover", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    const repo = new Repository(adapter(db));
    await repo.initialize();
    db.exec(
      "CREATE TRIGGER fail_outbox BEFORE INSERT ON outbox BEGIN SELECT RAISE(ABORT,'test failure'); END",
    );
    await assert.rejects(repo.save("task", task()));
    assert.deepEqual(await repo.list("task"), []);
    db.exec("DROP TRIGGER fail_outbox");
    await repo.save("task", task());
    assert.equal((await repo.list("task")).length, 1);
  } finally {
    db.close();
  }
});
test("invalid project relationship and invalid task duration never persist", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    const repo = new Repository(adapter(db));
    await repo.initialize();
    await assert.rejects(
      repo.save("task", task("bad", { projectId: "missing" })),
    );
    assert.throws(() => repo.save("task", task("bad", { duration: 0 })));
    assert.deepEqual(await repo.pendingChanges(), []);
  } finally {
    db.close();
  }
});
test("concurrent edits are serialized and revisions increase", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    const repo = new Repository(adapter(db));
    await repo.initialize();
    await Promise.all([
      repo.save("task", task()),
      repo.save("task", task("t1", { title: "Last edit" })),
    ]);
    assert.equal((await repo.list("task"))[0].title, "Last edit");
    assert.deepEqual(
      (await repo.pendingChanges()).map((c) => c.revision),
      [1, 2],
    );
  } finally {
    db.close();
  }
});
test("Asia/Shanghai and date boundary round trips", () => {
  assert.equal(
    localInstant("2026-10-12", "09:00", "Asia/Shanghai").toISOString(),
    "2026-10-12T01:00:00.000Z",
  );
  assert.deepEqual(
    localParts(new Date("2026-10-11T17:00:00Z"), "Asia/Shanghai"),
    { date: "2026-10-12", clock: "01:00" },
  );
});
test("IANA timezone with fractional offset works", () => {
  assert.equal(
    localInstant("2026-10-12", "09:00", "Asia/Kathmandu").toISOString(),
    "2026-10-12T03:15:00.000Z",
  );
});
test("DST missing and ambiguous times, invalid calendar dates and zones reject", () => {
  assert.throws(() => localInstant("2026-03-08", "02:30", "America/New_York"));
  assert.throws(() => localInstant("2026-11-01", "01:30", "America/New_York"));
  assert.throws(() => localInstant("2026-02-30", "09:00", "Asia/Shanghai"));
  assert.throws(() => localInstant("2026-10-12", "09:00", "Mars/Base"));
});
test("planner protects routines and existing appointments and reports overflow", () => {
  const fixed = task("fixed", {
    scheduledAt: "2026-10-12T01:00:00Z",
    duration: 60,
  });
  const result = planDay(
    [
      fixed,
      task("a", { duration: 120 }),
      task("b", { duration: 60 }),
      task("c", { duration: 1440 }),
    ],
    [routine()],
    "2026-10-12",
    "Asia/Shanghai",
  );
  assert.equal(result.scheduled[0].scheduledAt, "2026-10-12T02:00:00.000Z");
  assert.equal(result.scheduled[1].scheduledAt, "2026-10-12T05:00:00.000Z");
  assert.deepEqual(
    result.unscheduled.map((t) => t.id),
    ["c"],
  );
  assert.equal(fixed.scheduledAt, "2026-10-12T01:00:00Z");
});
test("previous-day overnight routine is protected even when today is not enabled", () => {
  const result = planDay(
    [task()],
    [routine({ start: "23:00", duration: 660, days: [0] })],
    "2026-10-12",
    "Asia/Shanghai",
  );
  assert.equal(result.scheduled[0].scheduledAt, "2026-10-12T02:00:00.000Z");
});
test("reminder IDs are deterministic with bounded followups and quiet hour filtering", () => {
  const t = task("t", { scheduledAt: "2026-10-12T01:00:00Z" });
  const now = new Date("2026-10-12T00:00:00Z");
  const gentle = reminderPlan(t, defaults, now);
  assert.equal(gentle.length, 1);
  assert.equal(reminderPlan(t, { ...defaults, mode: "Firm" }, now).length, 2);
  assert.equal(reminderPlan(t, { ...defaults, mode: "Strict" }, now).length, 3);
  assert.deepEqual(reminderPlan(t, defaults, now), gentle);
  assert.equal(
    reminderPlan(
      { ...t, status: "completed", completedAt: now.toISOString() },
      defaults,
      now,
    ).length,
    0,
  );
  assert.equal(
    reminderPlan(t, defaults, new Date("2026-10-13T00:00:00Z")).length,
    0,
  );
  assert.equal(
    reminderPlan(
      task("night", { scheduledAt: "2026-10-12T15:00:00Z" }),
      { ...defaults, mode: "Strict" },
      now,
    ).length,
    0,
  );
});
test("quiet hours boundaries are timezone aware, including equal times", () => {
  assert.equal(isQuiet(new Date("2026-10-12T14:00:00Z"), defaults), true);
  assert.equal(isQuiet(new Date("2026-10-11T23:00:00Z"), defaults), false);
  assert.equal(
    isQuiet(new Date(), {
      ...defaults,
      quietStart: "12:00",
      quietEnd: "12:00",
    }),
    true,
  );
});
test("an oversized task does not prevent smaller tasks fitting earlier gaps", () => {
  const result = planDay(
    [task("large", { duration: 1440 }), task("small")],
    [routine()],
    "2026-10-12",
    "Asia/Shanghai",
  );
  assert.equal(result.scheduled[0].id, "small");
  assert.equal(result.scheduled[0].scheduledAt, "2026-10-12T01:00:00.000Z");
  assert.equal(result.unscheduled[0].id, "large");
});
test("a daily plan commits all tasks and outbox changes atomically", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    const repo = new Repository(adapter(db));
    await repo.initialize();
    await assert.rejects(
      repo.saveMany("task", [
        task("first"),
        task("second", { projectId: "missing" }),
      ]),
    );
    assert.deepEqual(await repo.list("task"), []);
    assert.deepEqual(await repo.pendingChanges(), []);
    await repo.saveMany("task", [task("first"), task("second")]);
    assert.equal((await repo.list("task")).length, 2);
    assert.equal((await repo.pendingChanges()).length, 2);
  } finally {
    db.close();
  }
});

test("today planning starts in the future and handles midnight and past dates", () => {
  assert.equal(
    planningStart(
      "2026-10-12",
      "Asia/Shanghai",
      new Date("2026-10-12T08:15:32Z"),
    ),
    "16:16",
  );
  assert.equal(
    planningStart(
      "2026-10-13",
      "Asia/Shanghai",
      new Date("2026-10-12T08:15:32Z"),
    ),
    "09:00",
  );
  assert.equal(
    planningStart(
      "2026-10-12",
      "Asia/Shanghai",
      new Date("2026-10-12T15:59:30Z"),
    ),
    "23:59",
  );
  assert.throws(() =>
    planningStart(
      "2026-10-11",
      "Asia/Shanghai",
      new Date("2026-10-12T08:15:32Z"),
    ),
  );
});
