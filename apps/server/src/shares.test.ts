import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { Store } from "./store.ts";
import { createTempoServer } from "./server.ts";

test(
  "teammates share tasks through PostgreSQL",
  { skip: !process.env.TEST_DATABASE_URL },
  async (t) => {
    const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const schema = "tempo_test_" + randomBytes(8).toString("hex");
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(process.env.TEST_DATABASE_URL!);
    url.searchParams.set("options", `-c search_path=${schema},public`);
    const store = new Store(url.href);
    await store.migrate();
    const server = createTempoServer(store, { sendPush: null });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const call = async (path: string, token: string | null, body?: unknown) => {
      const response = await fetch(base + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, data: await response.json() };
    };
    const register = async (name: string) => {
      const email = `${name.toLowerCase()}-${randomBytes(4).toString("hex")}@example.test`;
      const r = await call("/v1/auth/register", null, {
        name,
        email,
        password: "correct horse battery",
      });
      assert.equal(r.status, 201);
      return { ...r.data.user, token: r.data.token as string, email };
    };
    try {
      const owner = await register("Ada");
      const member = await register("Grace");
      const stranger = await register("Linus");
      const project = { id: "launch", title: "Website launch" };
      const task = {
        id: "standup",
        title: "Launch standup",
        duration: 30,
        projectId: "launch",
        status: "pending",
        scheduledAt: "2026-10-20T09:00:00.000Z",
        completedAt: null,
        fixed: true,
      };
      const saved = await call("/v1/workspace", owner.token, {
        revision: 0,
        changes: [
          { kind: "project", id: project.id, payload: project },
          { kind: "task", id: task.id, payload: task },
        ],
      });
      assert.equal(saved.status, 200);

      await t.test("invites need a saved task and an existing account", async () => {
        assert.equal(
          (await call("/v1/shares", owner.token, { taskId: "missing", email: member.email })).status,
          400,
        );
        const unknown = await call("/v1/shares", owner.token, {
          taskId: task.id,
          email: "nobody@example.test",
        });
        assert.equal(unknown.status, 400);
        assert.match(unknown.data.error, /No Tempo account/);
        assert.equal(
          (await call("/v1/shares", owner.token, { taskId: task.id, email: owner.email })).status,
          400,
        );
      });

      await t.test("the teammate sees a pending invite without the owner's private fields", async () => {
        const invite = await call("/v1/shares", owner.token, {
          taskId: task.id,
          email: member.email.toUpperCase(),
        });
        assert.equal(invite.status, 200);
        assert.equal(invite.data.member.id, member.id);
        const list = await call("/v1/shares", member.token);
        assert.equal(list.data.incoming.length, 1);
        const [shared] = list.data.incoming;
        assert.equal(shared.status, "pending");
        assert.equal(shared.ownerName, "Ada");
        assert.equal(shared.projectTitle, "Website launch");
        assert.equal(shared.task.title, "Launch standup");
        assert.equal(shared.task.projectId, undefined);
        const outgoing = await call("/v1/shares", owner.token);
        assert.deepEqual(
          outgoing.data.outgoing.map((s: { memberId: string; status: string }) => [s.memberId, s.status]),
          [[member.id, "pending"]],
        );
      });

      await t.test("only accepted teammates can complete it, and the owner's plan updates", async () => {
        const body = { ownerId: owner.id, taskId: task.id, done: true };
        assert.equal((await call("/v1/shares/done", member.token, body)).status, 400);
        assert.equal((await call("/v1/shares/done", stranger.token, body)).status, 400);
        assert.equal(
          (await call("/v1/shares/respond", member.token, { ownerId: owner.id, taskId: task.id, accept: true })).status,
          200,
        );
        assert.equal((await call("/v1/shares/done", member.token, body)).status, 200);
        const workspace = await call("/v1/workspace", owner.token);
        const record = workspace.data.records.find((r: { id: string }) => r.id === task.id);
        assert.equal(record.payload.status, "completed");
        assert.ok(record.payload.completedAt);
        assert.equal(workspace.data.revision, 2);
        const stale = await call("/v1/workspace", owner.token, {
          revision: 1,
          changes: [{ kind: "task", id: task.id, payload: task }],
        });
        assert.equal(stale.status, 409);
      });

      await t.test("strangers cannot remove people; members can leave", async () => {
        const body = { ownerId: owner.id, taskId: task.id, memberId: member.id };
        assert.equal((await call("/v1/shares/remove", stranger.token, body)).status, 400);
        assert.equal((await call("/v1/shares/remove", member.token, body)).status, 200);
        assert.equal((await call("/v1/shares", member.token)).data.incoming.length, 0);
      });

      await t.test("deleting the task removes it from teammates", async () => {
        await call("/v1/shares", owner.token, { taskId: task.id, email: member.email });
        assert.equal((await call("/v1/shares", member.token)).data.incoming.length, 1);
        const workspace = await call("/v1/workspace", owner.token);
        assert.equal(
          (
            await call("/v1/workspace", owner.token, {
              revision: workspace.data.revision,
              changes: [{ kind: "task", id: task.id, payload: null }],
            })
          ).status,
          200,
        );
        assert.equal((await call("/v1/shares", member.token)).data.incoming.length, 0);
        assert.equal((await call("/v1/shares", owner.token)).data.outgoing.length, 0);
      });

      await t.test("declined invites disappear and can be re-sent", async () => {
        await call("/v1/workspace", owner.token, {
          revision: (await call("/v1/workspace", owner.token)).data.revision,
          changes: [{ kind: "task", id: task.id, payload: task }],
        });
        await call("/v1/shares", owner.token, { taskId: task.id, email: member.email });
        await call("/v1/shares/respond", member.token, { ownerId: owner.id, taskId: task.id, accept: false });
        assert.equal((await call("/v1/shares", member.token)).data.incoming.length, 0);
        await call("/v1/shares", owner.token, { taskId: task.id, email: member.email });
        assert.equal((await call("/v1/shares", member.token)).data.incoming[0].status, "pending");
      });
    } finally {
      server.close();
      await store.pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
