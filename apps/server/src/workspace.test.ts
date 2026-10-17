import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { Store } from "./store.ts";
import { createTempoServer } from "./server.ts";
import { Auth } from "./auth.ts";

test(
  "real PostgreSQL account storage and isolation",
  { skip: !process.env.TEST_DATABASE_URL },
  async (t) => {
    const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const schema = "tempo_test_" + randomBytes(8).toString("hex");
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(process.env.TEST_DATABASE_URL!);
    url.searchParams.set("options", `-c search_path=${schema},public`);
    let store = new Store(url.href);
    await store.migrate();
    let server = createTempoServer(store);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    let base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const call = async (
      path: string,
      token: string | null = null,
      body?: unknown,
      method?: string,
    ) => {
      const response = await fetch(base + path, {
        method: method || (body === undefined ? "GET" : "POST"),
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, data: await response.json() };
    };
    let a: any, b: any;
    const task = (title: string) => ({
      id: "same-task-id",
      title,
      duration: 30,
      projectId: null,
      status: "pending",
      scheduledAt: null,
      completedAt: null,
      fixed: false,
      plannedDay: "2026-10-17",
      steps: ["First step"],
    });
    try {
      await t.test(
        "anonymous users cannot plan, read workspaces, or access profiles",
        async () => {
          for (const path of ["/v1/workspace", "/v1/auth/me", "/v1/connection"])
            assert.equal((await call(path)).status, 401);
          assert.equal(
            (
              await call("/v1/plan", null, {
                text: "Read",
                day: "2026-10-17",
                timezone: "UTC",
              })
            ).status,
            401,
          );
          assert.equal(
            (await call("/v1/workspace", null, { revision: 0, changes: [] }))
              .status,
            401,
          );
        },
      );
      await t.test(
        "signup persists profile and a hashed password and issues a revocable session",
        async () => {
          const first = await call("/v1/auth/register", null, {
            name: "Account A",
            email: "account-a@example.test",
            password: "test-password-account-a",
          });
          assert.equal(first.status, 201);
          a = first.data;
          const second = await call("/v1/auth/register", null, {
            name: "Account B",
            email: "account-b@example.test",
            password: "test-password-account-b",
          });
          assert.equal(second.status, 201);
          b = second.data;
          const saved = await store.pool.query(
            "SELECT email,password_hash FROM users WHERE id=$1",
            [a.user.id],
          );
          assert.equal(saved.rows[0].email, "account-a@example.test");
          assert.notEqual(
            saved.rows[0].password_hash,
            "test-password-account-a",
          );
          assert.match(saved.rows[0].password_hash, /^[a-f0-9]+:[a-f0-9]+$/);
          assert.equal(
            (
              await call("/v1/auth/register", null, {
                name: "Duplicate",
                email: "account-a@example.test",
                password: "test-password-account-a",
              })
            ).status,
            400,
          );
        },
      );
      await t.test(
        "saved tasks and preferences restore in a new session",
        async () => {
          const changes = [
            {
              kind: "task",
              id: "same-task-id",
              payload: task("A private task"),
            },
            {
              kind: "preferences",
              id: "singleton",
              payload: {
                timezone: "Asia/Shanghai",
                mode: "Gentle",
                quietStart: "22:00",
                quietEnd: "07:00",
                onboardingComplete: true,
                dayEnd: "20:00",
              },
            },
          ];
          assert.equal(
            (await call("/v1/workspace", a.token, { revision: 0, changes }))
              .status,
            200,
          );
          const login = await call("/v1/auth/login", null, {
            email: "account-a@example.test",
            password: "test-password-account-a",
          });
          assert.equal(login.status, 200);
          const restored = await call("/v1/workspace", login.data.token);
          assert.equal(restored.data.records.length, 2);
          assert.equal(restored.data.revision, 1);
          assert.equal(
            restored.data.records.find((r: any) => r.kind === "task").payload
              .title,
            "A private task",
          );
        },
      );
      await t.test(
        "two accounts cannot read or overwrite each other even with the same record ID",
        async () => {
          assert.deepEqual(
            (await call("/v1/workspace", b.token)).data.records,
            [],
          );
          assert.equal(
            (
              await call("/v1/workspace", b.token, {
                userId: a.user.id,
                revision: 0,
                changes: [
                  {
                    kind: "task",
                    id: "same-task-id",
                    payload: task("B private task"),
                  },
                ],
              })
            ).status,
            200,
          );
          assert.equal(
            (await call("/v1/workspace", a.token)).data.records.find(
              (r: any) => r.kind === "task",
            ).payload.title,
            "A private task",
          );
          assert.equal(
            (await call("/v1/workspace", b.token)).data.records[0].payload
              .title,
            "B private task",
          );
        },
      );
      await t.test(
        "invalid batches and cross-account project references roll back completely",
        async () => {
          assert.equal(
            (
              await call("/v1/workspace", a.token, {
                revision: 1,
                changes: [
                  {
                    kind: "task",
                    id: "same-task-id",
                    payload: task("Should roll back"),
                  },
                  {
                    kind: "task",
                    id: "bad",
                    payload: { ...task("Bad"), id: "bad", duration: 0 },
                  },
                ],
              })
            ).status,
            400,
          );
          const project = { id: "b-project", title: "B project" };
          assert.equal(
            (
              await call("/v1/workspace", b.token, {
                revision: 1,
                changes: [
                  { kind: "project", id: project.id, payload: project },
                ],
              })
            ).status,
            200,
          );
          assert.equal(
            (
              await call("/v1/workspace", a.token, {
                revision: 1,
                changes: [
                  {
                    kind: "task",
                    id: "same-task-id",
                    payload: {
                      ...task("Wrong project"),
                      projectId: project.id,
                    },
                  },
                ],
              })
            ).status,
            400,
          );
          const read = await call("/v1/workspace", a.token);
          assert.equal(read.data.revision, 1);
          assert.equal(
            read.data.records.find((r: any) => r.kind === "task").payload.title,
            "A private task",
          );
        },
      );
      await t.test(
        "concurrent edits detect stale revisions instead of silently losing work",
        async () => {
          const results = await Promise.all(
            ["Edit one", "Edit two"].map((title) =>
              call("/v1/workspace", a.token, {
                revision: 1,
                changes: [
                  { kind: "task", id: "same-task-id", payload: task(title) },
                ],
              }),
            ),
          );
          assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
          assert.equal(
            results.find((r) => r.status === 409)!.data.workspace.revision,
            2,
          );
        },
      );
      await t.test(
        "deletion and recreation stay isolated and survive a server restart",
        async () => {
          assert.equal(
            (
              await call("/v1/workspace", a.token, {
                revision: 2,
                changes: [{ kind: "task", id: "same-task-id", payload: null }],
              })
            ).status,
            200,
          );
          assert.equal(
            (
              await call("/v1/workspace", a.token, {
                revision: 3,
                changes: [
                  {
                    kind: "task",
                    id: "same-task-id",
                    payload: task("Restored A task"),
                  },
                ],
              })
            ).status,
            200,
          );
          await new Promise<void>((resolve, reject) =>
            server.close((e) => (e ? reject(e) : resolve())),
          );
          await store.pool.end();
          store = new Store(url.href);
          await store.migrate();
          server = createTempoServer(store);
          await new Promise<void>((resolve) =>
            server.listen(0, "127.0.0.1", resolve),
          );
          base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
          assert.equal(
            (await call("/v1/workspace", a.token)).data.records.find(
              (r: any) => r.kind === "task",
            ).payload.title,
            "Restored A task",
          );
          assert.equal(
            (await call("/v1/workspace", b.token)).data.records.find(
              (r: any) => r.kind === "task",
            ).payload.title,
            "B private task",
          );
        },
      );
      await t.test(
        "profile changes persist and logout invalidates the session",
        async () => {
          const profile = await call(
            "/v1/auth/me",
            a.token,
            { name: "Updated A" },
            "PATCH",
          );
          assert.equal(profile.status, 200);
          assert.equal(profile.data.user.name, "Updated A");
          assert.equal(
            (await call("/v1/auth/logout", a.token, {})).status,
            200,
          );
          assert.equal((await call("/v1/workspace", a.token)).status, 401);
          const login = await call("/v1/auth/login", null, {
            email: "account-a@example.test",
            password: "test-password-account-a",
          });
          assert.equal(login.data.user.name, "Updated A");
          assert.equal(
            (await call("/v1/workspace", login.data.token)).status,
            200,
          );
          assert.equal(
            (
              await call("/v1/auth/login", null, {
                email: "account-a@example.test",
                password: "wrong-password-value",
              })
            ).status,
            400,
          );
        },
      );
      await t.test("expired sessions cannot access cloud data", async () => {
        await store.pool.query(
          "UPDATE sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1",
          [b.user.id],
        );
        assert.equal((await call("/v1/workspace", b.token)).status, 401);
      });
      await t.test(
        "a session write failure never leaves a half-created account",
        async () => {
          await store.pool.query(
            `CREATE FUNCTION fail_session() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test session failure'; END $$; CREATE TRIGGER fail_session BEFORE INSERT ON sessions FOR EACH ROW EXECUTE FUNCTION fail_session();`,
          );
          await assert.rejects(
            new Auth(store.pool).register({
              name: "Rollback",
              email: "rollback@example.test",
              password: "test-password-rollback",
            }),
          );
          assert.equal(
            (
              await store.pool.query("SELECT id FROM users WHERE email=$1", [
                "rollback@example.test",
              ])
            ).rows.length,
            0,
          );
        },
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await store.pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
