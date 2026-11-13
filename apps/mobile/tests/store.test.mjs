import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const data = (code) =>
  "data:text/javascript;base64," + Buffer.from(code).toString("base64");
const session = data(
  "const values=new Map(); export async function getItemAsync(k){return values.get(k)||null} export async function setItemAsync(k,v){values.set(k,v)} export async function deleteItemAsync(k){values.delete(k)}",
);
const api = data(
  'export class ApiError extends Error {constructor(message,status,data){super(message);this.status=status;this.data=data}} export async function apiBase(){return "http://test"} export async function request(...args){return globalThis.tempoStoreTestRequest(...args)}',
);
const hafrik = data("export async function hafrikTicket(){return null}");
let source = await readFile(
  new URL("../src/data/store.ts", import.meta.url),
  "utf8",
);
source = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;
source = source
  .replace(
    /from "zustand"/g,
    `from "${new URL("../node_modules/zustand/esm/index.mjs", import.meta.url).href}"`,
  )
  .replace(/from "\.\.\/lib\/session"/g, `from "${session}"`)
  .replace(/from "\.\.\/lib\/api"/g, `from "${api}"`)
  .replace(/from "\.\.\/lib\/hafrik"/g, `from "${hafrik}"`)
  .replace(
    /from "\.\.\/\.\.\/\.\.\/\.\.\/packages\/core\/src\/([^".]+)"/g,
    (_, name) =>
      `from "${new URL(`../../../packages/core/src/${name}.ts`, import.meta.url).href}"`,
  );
let backend = { revision: 0, records: [], savedAt: new Date().toISOString() };
let saves = 0;
globalThis.tempoStoreTestRequest = async (_base, path, _token, input) => {
  if (path === "/v1/auth/login")
    return {
      user: { id: "test-user", name: "Test", email: "test@example.test" },
      token: "a".repeat(64),
    };
  if (path === "/v1/shares") return { incoming: [], outgoing: [] };
  if (path === "/v1/auth/logout") return { ok: true };
  if (path === "/v1/workspace") {
    if (input) {
      assert.equal(input.revision, backend.revision);
      saves++;
      for (const change of input.changes) {
        backend.records = backend.records.filter(
          (r) => !(r.kind === change.kind && r.id === change.id),
        );
        if (change.payload) backend.records.push(structuredClone(change));
      }
      backend.revision++;
      backend.savedAt = new Date().toISOString();
    }
    return structuredClone(backend);
  }
  throw new Error("Unexpected test API path");
};
const { useTempo } = await import(data(source));
const task = {
  id: "task",
  title: "Write",
  projectId: null,
  duration: 30,
  status: "pending",
  scheduledAt: null,
  completedAt: null,
  fixed: false,
  plannedDay: "2026-10-19",
};
test("actual mobile store supports undo, rejects stale reviewed plans, and clears account data", async () => {
  const store = () => useTempo.getState();
  await store().authenticate("login", {
    name: "Test",
    email: "test@example.test",
    password: "test-password",
  });
  await store().save("task", task);
  assert.equal(store().tasks.length, 1);
  assert.ok(store().undoEntry);
  await store().undo();
  assert.equal(store().tasks.length, 0);
  assert.equal(store().undoEntry, null);
  await store().save("task", task);
  const revision = store().revision;
  await store().save("task", {
    ...task,
    status: "completed",
    completedAt: new Date().toISOString(),
  });
  const before = saves;
  await assert.rejects(
    () =>
      store().saveReviewedPlan(
        [{ ...task, title: "Stale" }],
        "21:00",
        revision,
      ),
    /Review it again/,
  );
  assert.equal(saves, before);
  assert.equal(store().tasks[0].status, "completed");
  await store().undo();
  assert.equal(store().tasks[0].status, "pending");
  await store().remove("task", "task");
  assert.equal(store().undoEntry, null);
  await store().signOut();
  assert.equal(store().user, null);
  assert.equal(store().tasks.length, 0);
  assert.equal(store().undoEntry, null);
});
