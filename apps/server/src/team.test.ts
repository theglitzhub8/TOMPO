import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { Store } from "./store.ts";
import { Auth } from "./auth.ts";
import { createTempoServer } from "./server.ts";

test(
  "shared projects, comments, inbox, busy times and recovery use account-scoped permissions",
  { skip: !process.env.TEST_DATABASE_URL },
  async (t) => {
    const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const schema = `tempo_test_${randomBytes(8).toString("hex")}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(process.env.TEST_DATABASE_URL!);
    url.searchParams.set("options", `-c search_path=${schema},public`);
    const store = new Store(url.href);
    await store.migrate();
    const mailed: { email: string; token: string }[] = [];
    const server = createTempoServer(store, {
      sendPush: null,
      sendReset: async (email, token) => {
        mailed.push({ email, token });
      },
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    const call = async (path: string, token: string | null, body?: unknown) => {
      const response = await fetch(base + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, data: (await response.json()) as any };
    };
    try {
      const auth = new Auth(store.pool);
      const a = await auth.register({
        email: "owner@example.test",
        name: "Owner",
        password: "test-owner-password",
      });
      const b = await auth.register({
        email: "member@example.test",
        name: "Member",
        password: "test-member-password",
      });
      const c = await auth.register({
        email: "stranger@example.test",
        name: "Stranger",
        password: "test-stranger-password",
      });
      const payload = {
        id: "task",
        title: "Team report",
        duration: 30,
        projectId: "project",
        status: "pending",
        scheduledAt: null,
        completedAt: null,
        fixed: false,
        priority: "high",
        dueDay: "2026-10-24",
      };
      await store.saveWorkspace(a.user.id, 0, [
        {
          kind: "project",
          id: "project",
          payload: { id: "project", title: "Launch" },
        },
        { kind: "task", id: "task", payload },
      ]);
      const detail = `/v1/team/project?owner=${a.user.id}&id=project`;
      const comments = `/v1/team/comments?owner=${a.user.id}&id=task`;
      await t.test(
        "pending invitations disclose no tasks; strangers cannot access project or comments",
        async () => {
          assert.equal(
            (
              await call("/v1/team/invite", a.token, {
                projectId: "project",
                email: "member@example.test",
              })
            ).status,
            200,
          );
          const incoming = await call("/v1/team", b.token);
          assert.equal(incoming.data.projects[0].status, "pending");
          assert.equal(incoming.data.projects[0].tasks, undefined);
          assert.equal((await call(detail, b.token)).status, 400);
          assert.equal((await call(detail, c.token)).status, 400);
          assert.equal((await call(comments, c.token)).status, 400);
          assert.equal(
            (
              await call("/v1/team/respond", c.token, {
                ownerId: a.user.id,
                projectId: "project",
                accept: true,
              })
            ).status,
            400,
          );
        },
      );
      await t.test(
        "accepted members can comment and complete work; only owners assign it",
        async () => {
          assert.equal(
            (
              await call("/v1/team/respond", b.token, {
                ownerId: a.user.id,
                projectId: "project",
                accept: true,
              })
            ).status,
            200,
          );
          assert.equal(
            (await call(detail, b.token)).data.tasks[0].task.title,
            "Team report",
          );
          assert.equal(
            (
              await call("/v1/team/assign", b.token, {
                taskId: "task",
                memberId: b.user.id,
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await call("/v1/team/assign", a.token, {
                taskId: "task",
                memberId: c.user.id,
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await call("/v1/team/assign", a.token, {
                taskId: "task",
                memberId: b.user.id,
              })
            ).status,
            200,
          );
          assert.equal(
            (await call(detail, b.token)).data.tasks[0].assigneeId,
            b.user.id,
          );
          const posted = await call("/v1/team/comments", b.token, {
            ownerId: a.user.id,
            taskId: "task",
            message: "First draft ready.",
          });
          assert.equal(posted.status, 200);
          assert.equal(posted.data.comments[0].message, "First draft ready.");
          assert.equal(
            (
              await call("/v1/team/done", c.token, {
                ownerId: a.user.id,
                taskId: "task",
                done: true,
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await call("/v1/team/done", b.token, {
                ownerId: a.user.id,
                taskId: "task",
                done: true,
              })
            ).status,
            200,
          );
          const saved = await store.workspace(a.user.id);
          assert.equal(saved.revision, 2);
          assert.equal(
            saved.records.find((r) => r.kind === "task")!.payload.status,
            "completed",
          );
        },
      );
      await t.test(
        "busy windows are shared only with accepted project owners; inbox is private and persists without push tokens",
        async () => {
          assert.equal(
            (
              await call("/v1/team/busy", b.token, {
                start: new Date(Date.now() + 3600000).toISOString(),
                duration: 60,
              })
            ).status,
            200,
          );
          const planning = await call("/v1/team/planning", a.token);
          assert.equal(planning.data.busy.length, 1);
          assert.equal(planning.data.busy[0].projectId, "project");
          assert.equal(
            (await call("/v1/team/planning", c.token)).data.busy.length,
            0,
          );
          const inbox = await call("/v1/inbox", b.token);
          assert.ok(
            inbox.data.items.some((i: any) => i.title === "Project invitation"),
          );
          assert.equal((await call("/v1/inbox", c.token)).data.items.length, 0);
          await call("/v1/inbox/read", b.token, {});
          assert.ok(
            (await call("/v1/inbox", b.token)).data.items.every(
              (i: any) => i.read,
            ),
          );
          assert.equal((await call("/v1/inbox", null)).status, 401);
        },
      );
      await t.test(
        "new shared tasks notify members; moving work private never sends its new private contents",
        async () => {
          const previous = store.onSharedChange;
          const changes: any[] = [];
          store.onSharedChange = (rows) => changes.push(...rows);
          try {
            let workspace = await store.workspace(a.user.id);
            await store.saveWorkspace(a.user.id, workspace.revision, [
              {
                kind: "task",
                id: "new-task",
                payload: {
                  ...payload,
                  id: "new-task",
                  title: "Shared addition",
                },
              },
            ]);
            assert.ok(
              changes.some(
                (change) =>
                  change.taskId === "new-task" &&
                  change.members.includes(b.user.id) &&
                  change.after.title === "Shared addition",
              ),
            );
            changes.length = 0;
            workspace = await store.workspace(a.user.id);
            await store.saveWorkspace(a.user.id, workspace.revision, [
              {
                kind: "task",
                id: "new-task",
                payload: {
                  ...payload,
                  id: "new-task",
                  projectId: null,
                  title: "Private renamed work",
                },
              },
            ]);
            assert.ok(
              changes.some(
                (change) =>
                  change.members.includes(b.user.id) && change.after === null,
              ),
            );
            assert.ok(
              changes.every(
                (change) =>
                  !JSON.stringify(change).includes("Private renamed work"),
              ),
            );
          } finally {
            store.onSharedChange = previous;
          }
        },
      );
      await t.test(
        "removing membership revokes project/task/comment access and clears assignment",
        async () => {
          assert.equal(
            (
              await call("/v1/team/remove", c.token, {
                ownerId: a.user.id,
                projectId: "project",
                memberId: b.user.id,
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await call("/v1/team/remove", a.token, {
                ownerId: a.user.id,
                projectId: "project",
                memberId: b.user.id,
              })
            ).status,
            200,
          );
          assert.equal((await call(detail, b.token)).status, 400);
          assert.equal((await call(comments, b.token)).status, 400);
          assert.equal(
            (
              await call("/v1/team/done", b.token, {
                ownerId: a.user.id,
                taskId: "task",
                done: false,
              })
            ).status,
            400,
          );
          assert.equal(
            (await call(detail, a.token)).data.tasks[0].assigneeId,
            null,
          );
          assert.equal(
            (await call("/v1/team/planning", a.token)).data.busy.length,
            0,
          );
        },
      );
      await t.test(
        "password reset is generic, single-use, hashed and revokes sessions",
        async () => {
          const missing = await call("/v1/auth/forgot", null, {
            email: "missing@example.test",
          });
          const known = await call("/v1/auth/forgot", null, {
            email: "member@example.test",
          });
          assert.equal(known.status, 200);
          assert.deepEqual(known.data, missing.data);
          assert.equal(mailed.length, 1);
          const raw = await store.pool.query(
            "SELECT token_hash FROM password_resets",
          );
          assert.notEqual(raw.rows[0].token_hash, mailed[0].token);
          const result = await call("/v1/auth/reset", null, {
            token: mailed[0].token,
            password: "new-member-password",
          });
          assert.equal(result.status, 200);
          assert.equal((await call("/v1/auth/me", b.token)).status, 401);
          assert.equal(
            (
              await call("/v1/auth/reset", null, {
                token: mailed[0].token,
                password: "another-new-password",
              })
            ).status,
            400,
          );
          assert.ok(
            (
              await auth.login({
                email: "member@example.test",
                password: "new-member-password",
              })
            ).token,
          );
          await assert.rejects(() =>
            auth.login({
              email: "member@example.test",
              password: "test-member-password",
            }),
          );
          await call("/v1/auth/forgot", null, { email: "owner@example.test" });
          await store.pool.query(
            "UPDATE password_resets SET expires_at=now()-interval '1 minute'",
          );
          assert.equal(
            (
              await call("/v1/auth/reset", null, {
                token: mailed[1].token,
                password: "another-new-password",
              })
            ).status,
            400,
          );
        },
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
      await store.pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
