import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { Pool } from "pg";
import { Store } from "./store.ts";
import { Auth } from "./auth.ts";
import { createTempoServer } from "./server.ts";
import type { HafrikFetch } from "./hafrik.ts";

test(
  "Login with Hafrik links by Hafrik user_id and only the starting device can redeem it",
  { skip: !process.env.TEST_DATABASE_URL },
  async (t) => {
    process.env.HAFRIK_APP_ID = "117247196068968";
    process.env.HAFRIK_APP_SECRET = "test-secret";
    const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const schema = `tempo_test_${randomBytes(8).toString("hex")}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(process.env.TEST_DATABASE_URL!);
    url.searchParams.set("options", `-c search_path=${schema},public`);
    const store = new Store(url.href);
    await store.migrate();
    // Fake Hafrik: each auth_key maps to a Hafrik user.
    const people: Record<string, any> = {
      keyA: { user_id: "42", user_name: "ada", user_firstname: "Ada", user_lastname: "Lovelace", user_email: "ada@example.test" },
      keyA2: { user_id: "42", user_name: "ada", user_firstname: "Ada", user_lastname: "Lovelace", user_email: "ada@example.test" },
      keyB: { user_id: "77", user_name: "taken", user_firstname: "", user_lastname: "", user_email: "owner@example.test" },
    };
    const authorized: Record<string, string> = {};
    const hafrikFetch: HafrikFetch = async (input, init) => {
      const target = new URL(input);
      if (target.pathname === "/api/authorize") {
        const form = new URLSearchParams(String(init?.body));
        assert.equal(form.get("app_id"), "117247196068968");
        if (form.get("app_secret") !== "test-secret" || !people[form.get("auth_key")!])
          return Response.json({ error: true, message: "Bad Request, invalid auth_key" });
        const token = randomBytes(8).toString("hex");
        authorized[token] = form.get("auth_key")!;
        return Response.json({ access_token: token });
      }
      if (target.pathname === "/api/get_user_info") {
        const key = authorized[target.searchParams.get("access_token") || ""];
        return Response.json(key ? { user_info: people[key] } : { error: true, message: "Bad Request, invalid access_token" });
      }
      return Response.json({ error: true });
    };
    const server = createTempoServer(store, { sendPush: null, hafrikFetch });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    const go = (path: string, cookie?: string) =>
      fetch(base + path, { redirect: "manual", headers: cookie ? { cookie } : {} });
    const appParams = (response: Response) => {
      const location = response.headers.get("location")!;
      assert.ok(location.startsWith("tempo://auth/hafrik?"), location);
      return new URL(location).searchParams;
    };
    const redeem = (body: unknown) =>
      fetch(`${base}/v1/auth/hafrik/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => ({ status: r.status, data: (await r.json()) as any }));
    const begin = async () => {
      const verifier = randomBytes(32).toString("hex");
      const challenge = createHash("sha256").update(verifier).digest("hex");
      const started = await go(`/v1/auth/hafrik/start?challenge=${challenge}`);
      assert.equal(started.status, 302);
      assert.equal(started.headers.get("location"), "https://hafrik.com/api/oauth?app_id=117247196068968");
      const cookie = /tempo_hafrik=[a-f0-9]{64}/.exec(started.headers.get("set-cookie") || "")![0];
      return { verifier, cookie };
    };
    try {
      await new Auth(store.pool).register({ email: "owner@example.test", name: "Owner", password: "test-owner-password" });

      await t.test("a full login creates one account keyed by Hafrik user_id", async () => {
        const { verifier, cookie } = await begin();
        const back = await go("/v1/auth/hafrik/callback?auth_key=keyA", cookie);
        const ticket = appParams(back).get("ticket")!;
        assert.match(ticket, /^[a-f0-9]{64}$/);
        assert.match(back.headers.get("set-cookie") || "", /Max-Age=0/);
        const signed = await redeem({ ticket, verifier });
        assert.equal(signed.status, 200);
        assert.deepEqual({ name: signed.data.user.name, email: signed.data.user.email }, { name: "Ada Lovelace", email: "ada@example.test" });
        const me = await fetch(`${base}/v1/auth/me`, { headers: { authorization: `Bearer ${signed.data.token}` } }).then((r) => r.json()) as any;
        assert.equal(me.user.id, signed.data.user.id);
        // A second login for the same Hafrik user returns the same account.
        const again = await begin();
        const ticket2 = appParams(await go("/v1/auth/hafrik/callback?auth_key=keyA2", again.cookie)).get("ticket")!;
        const second = await redeem({ ticket: ticket2, verifier: again.verifier });
        assert.equal(second.data.user.id, signed.data.user.id);
        const rows = await store.pool.query("SELECT count(*)::int AS n FROM users WHERE external_id='hafrik:42'");
        assert.equal(rows.rows[0].n, 1);
      });

      await t.test("tickets need the starting verifier and work once", async () => {
        const { verifier, cookie } = await begin();
        const ticket = appParams(await go("/v1/auth/hafrik/callback?auth_key=keyA", cookie)).get("ticket")!;
        assert.equal((await redeem({ ticket, verifier: randomBytes(32).toString("hex") })).status, 400);
        // The failed attempt burned the ticket.
        assert.equal((await redeem({ ticket, verifier })).status, 400);
      });

      await t.test("callbacks without the starting cookie or with a bad auth_key are refused", async () => {
        assert.ok(appParams(await go("/v1/auth/hafrik/callback?auth_key=keyA")).get("error"));
        const { cookie } = await begin();
        assert.ok(appParams(await go("/v1/auth/hafrik/callback?auth_key=nope", cookie)).get("error"));
        // The state was consumed even though Hafrik refused.
        assert.ok(appParams(await go("/v1/auth/hafrik/callback?auth_key=keyA", cookie)).get("error"));
        assert.ok(appParams(await go("/v1/auth/hafrik/start?challenge=short")).get("error"));
      });

      await t.test("a Hafrik email that matches an existing account never links to it", async () => {
        const { verifier, cookie } = await begin();
        const ticket = appParams(await go("/v1/auth/hafrik/callback?auth_key=keyB", cookie)).get("ticket")!;
        const signed = await redeem({ ticket, verifier });
        assert.equal(signed.status, 200);
        assert.equal(signed.data.user.email, "");
        assert.equal(signed.data.user.name, "taken");
        const owner = await store.pool.query("SELECT id,external_id FROM users WHERE email='owner@example.test'");
        assert.equal(owner.rows[0].external_id, "email:owner@example.test");
        assert.notEqual(owner.rows[0].id, signed.data.user.id);
        // Password login cannot open a Hafrik-only account.
        const login = await fetch(`${base}/v1/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "ada@example.test", password: "any-password-at-all" }),
        });
        assert.equal(login.status, 400);
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
      await store.pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
