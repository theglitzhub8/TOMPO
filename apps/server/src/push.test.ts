import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { Store } from "./store.ts";
import { createTempoServer } from "./server.ts";
import type { PushMessage, PushTicket } from "./push.ts";

test(
  "teammates get push notifications about shared tasks",
  { skip: !process.env.TEST_DATABASE_URL },
  async (t) => {
    const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const schema = "tempo_test_" + randomBytes(8).toString("hex");
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(process.env.TEST_DATABASE_URL!);
    url.searchParams.set("options", `-c search_path=${schema},public`);
    const store = new Store(url.href);
    await store.migrate();
    const sent: PushMessage[] = [];
    let reply: (m: PushMessage) => PushTicket = () => ({ status: "ok" });
    const server = createTempoServer(store, {
      sendPush: async (messages) => {
        sent.push(...messages);
        return messages.map(reply);
      },
    });
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
      const email = `${name.split(" ")[0].toLowerCase()}-${randomBytes(4).toString("hex")}@example.test`;
      const r = await call("/v1/auth/register", null, { name, email, password: "correct horse battery" });
      return { ...r.data.user, token: r.data.token as string, email };
    };
    // Pushes are sent after the response; give them a moment to land.
    const settle = () => new Promise((r) => setTimeout(r, 150));
    const take = () => sent.splice(0, sent.length);
    try {
      const ada = await register("Ada Okafor");
      const sam = await register("Sam Rivera");
      const adaPhone = "ExponentPushToken[ada-phone-0001]";
      const samPhone = "ExponentPushToken[sam-phone-0001]";
      for (const [who, token] of [[ada, adaPhone], [sam, samPhone]] as const)
        assert.equal(
          (await call("/v1/push/register", who.token, { token, platform: "ios" })).status,
          200,
        );
      assert.equal(
        (await call("/v1/push/register", sam.token, { token: "not-a-token", platform: "ios" })).status,
        400,
      );
      await call("/v1/workspace", sam.token, {
        revision: 0,
        changes: [{ kind: "preferences", id: "singleton", payload: { timezone: "Africa/Lagos", mode: "Gentle", quietStart: "22:00", quietEnd: "07:00", onboardingComplete: true } }],
      });
      const task = {
        id: "review",
        title: "Design review",
        duration: 45,
        projectId: null,
        status: "pending",
        scheduledAt: "2030-01-15T14:00:00.000Z",
        completedAt: null,
        fixed: true,
      };
      await call("/v1/workspace", ada.token, {
        revision: 0,
        changes: [{ kind: "task", id: task.id, payload: task }],
      });

      await t.test("an invite reaches the teammate, in their own timezone", async () => {
        await call("/v1/shares", ada.token, { taskId: task.id, email: sam.email });
        await settle();
        const [message, ...rest] = take();
        assert.equal(rest.length, 0);
        assert.equal(message.to, samPhone);
        assert.equal(message.title, "Ada added you to a task");
        assert.match(message.body, /^Design review · Tue, Jan 15 at 15:00\./);
        assert.equal(message.data.tempoPush, true);
        assert.equal(message.data.type, "invite");
      });

      await t.test("accepting tells the owner", async () => {
        await call("/v1/shares/respond", sam.token, { ownerId: ada.id, taskId: task.id, accept: true });
        await settle();
        const messages = take();
        assert.deepEqual(messages.map((m) => [m.to, m.title]), [[adaPhone, "Sam joined your task"]]);
      });

      await t.test("moving the task tells teammates the new time", async () => {
        const revision = (await call("/v1/workspace", ada.token)).data.revision;
        await call("/v1/workspace", ada.token, {
          revision,
          changes: [{ kind: "task", id: task.id, payload: { ...task, scheduledAt: "2030-01-15T15:30:00.000Z" } }],
        });
        await settle();
        const messages = take();
        assert.deepEqual(messages.map((m) => [m.to, m.title]), [[samPhone, "Ada moved a shared task"]]);
        assert.equal(messages[0].body, "Design review is now Tue, Jan 15 at 16:30.");
      });

      await t.test("finishing it tells the other side", async () => {
        await call("/v1/shares/done", sam.token, { ownerId: ada.id, taskId: task.id, done: true });
        await settle();
        assert.deepEqual(take().map((m) => [m.to, m.title]), [[adaPhone, "Sam finished a shared task"]]);
      });

      await t.test("dead device tokens are dropped", async () => {
        reply = (m) => (m.to === samPhone ? { status: "error", details: { error: "DeviceNotRegistered" } } : { status: "ok" });
        await call("/v1/shares/done", ada.token, { ownerId: ada.id, taskId: task.id, done: false });
        await settle();
        assert.deepEqual(take().map((m) => m.to), [samPhone]);
        const left = await store.pool.query("SELECT token FROM push_tokens ORDER BY token");
        assert.deepEqual(left.rows.map((r) => r.token), [adaPhone]);
        reply = () => ({ status: "ok" });
      });

      await t.test("signing out stops notifications to that phone", async () => {
        await call("/v1/push/register", sam.token, { token: samPhone, platform: "ios" });
        await call("/v1/auth/logout", sam.token, { pushToken: samPhone });
        const left = await store.pool.query("SELECT token FROM push_tokens ORDER BY token");
        assert.deepEqual(left.rows.map((r) => r.token), [adaPhone]);
      });
    } finally {
      server.close();
      await store.pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
