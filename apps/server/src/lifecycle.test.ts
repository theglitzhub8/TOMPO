import { test } from "node:test";
import assert from "node:assert/strict";
import { validateChanges } from "./entities.js";
const task = { id: "t1", title: "Read", duration: 25, projectId: null, status: "pending", scheduledAt: null, completedAt: null,
  plannedDay: "2026-10-19", fixed: false };
const change = (payload: object) => [{ kind: "task", id: "t1", payload: { ...task, ...payload } }];
test("API preserves repeat rules, occurrence identity and carry-forward history", () => {
  const rule = { days: [1,2,3,4,5], startDay: "2026-10-19" };
  assert.deepEqual(validateChanges(change({ recurrence: rule }))[0].payload!.recurrence, rule);
  const occurrence = validateChanges(change({ seriesId: "root", occurrenceDay: "2026-10-19", carriedFrom: ["2026-10-18"] }))[0].payload!;
  assert.equal(occurrence.seriesId, "root");
  assert.equal(occurrence.occurrenceDay, "2026-10-19");
  assert.deepEqual(occurrence.carriedFrom, ["2026-10-18"]);
});
test("API rejects malformed lifecycle metadata", () => {
  for (const input of [{ recurrence: { days: [8], startDay: "2026-10-19" } },
    { recurrence: { days: [1], startDay: "2026-02-30" } }, { seriesId: "root" },
    { seriesId: "root", occurrenceDay: "wrong" }, { carriedFrom: ["2026-02-30"] }])
    assert.throws(() => validateChanges(change(input)));
});

test("lifecycle metadata survives PostgreSQL restore and stale writes are rejected", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const { Pool } = await import("pg");
  const { randomBytes } = await import("node:crypto");
  const { Store } = await import("./store.js");
  const { Auth } = await import("./auth.js");
  const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const schema = `tempo_test_${randomBytes(8).toString("hex")}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(process.env.TEST_DATABASE_URL!);
  url.searchParams.set("options", `-c search_path=${schema},public`);
  const store = new Store(url.href);
  try {
    await store.migrate();
    const { user } = await new Auth(store.pool).register({ name: "Lifecycle QA", email: "lifecycle@example.test", password: "disposable-test-password" });
    const recurrence = { days: [1,2,3,4,5], startDay: "2026-10-19", skippedDays: ["2026-10-21"] };
    await store.saveWorkspace(user.id, 0, change({ recurrence }));
    let restored = await store.workspace(user.id);
    assert.deepEqual(restored.records[0].payload.recurrence, recurrence);
    await store.saveWorkspace(user.id, restored.revision, change({ seriesId: "root", occurrenceDay: "2026-10-19", carriedFrom: ["2026-10-18"] }));
    restored = await store.workspace(user.id);
    assert.equal(restored.records[0].payload.seriesId, "root");
    assert.deepEqual(restored.records[0].payload.carriedFrom, ["2026-10-18"]);
    await assert.rejects(() => store.saveWorkspace(user.id, 0, change({})), /changed on another device/);
    assert.equal((await store.workspace(user.id)).revision, restored.revision);
  } finally {
    await store.pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
