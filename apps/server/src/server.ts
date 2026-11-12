import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { Collaboration, TeamError } from "./collaboration.js";
import { Recovery, type ResetMailer } from "./recovery.js";
import { Auth } from "./auth.js";
import { Store, WorkspaceConflict } from "./store.js";
import { PlanningLimit, planCapture } from "./planning.js";
import { ShareError, Shares } from "./shares.js";
import { Push, expoSender, type PushSender } from "./push.js";

async function body(req: IncomingMessage) {
  const buffers: Buffer[] = [];
  let size = 0;
  for await (const piece of req) {
    const buffer = Buffer.from(piece);
    size += buffer.length;
    if (size > 262144) throw new Error("Request too large");
    buffers.push(buffer);
  }
  return JSON.parse(Buffer.concat(buffers).toString("utf8") || "{}");
}
export function createTempoServer(
  store: Store,
  options: { sendPush?: PushSender | null; sendReset?: ResetMailer } = {},
) {
  const auth = new Auth(store.pool);
  const authLimits = new Map<string, { count: number; until: number }>();
  const planningLimit = new PlanningLimit();
  const push = new Push(
    store.pool,
    options.sendPush === undefined ? expoSender : options.sendPush,
  );
  const shares = new Shares(store.pool, push);
  const team = new Collaboration(store.pool, push);
  const recovery = new Recovery(store.pool, options.sendReset);
  store.onSharedChange = (changes) => {
    void (async () => {
      const names = await store.pool.query(
        "SELECT display_name AS name FROM users WHERE id=$1",
        [changes[0].ownerId],
      );
      const who = String(names.rows[0]?.name ?? "Your teammate").split(/\s+/)[0];
      for (const c of changes) {
        const title = String(c.before.title ?? "A shared task");
        if (!Object.keys(c.before).length && c.after) {
          await push.notify(c.members, `${who} added shared work`, String(c.after.title), { type: "changed", ownerId: c.ownerId, taskId: c.taskId, projectId: c.after.projectId });
          continue;
        }
        const data = { type: "changed", ownerId: c.ownerId, taskId: c.taskId, projectId: c.after?.projectId ?? c.before.projectId };
        if (!c.after) {
          await push.notify(c.members, `${who} removed a shared task`, `${title} is no longer on your day.`, data);
          continue;
        }
        if (c.after.status !== c.before.status)
          await push.notify(
            c.members,
            c.after.status === "completed" ? `${who} finished a shared task` : `${who} reopened a shared task`,
            `${title}${c.after.status === "completed" ? " is done." : " is back on the list."}`,
            data,
          );
        if (c.after.scheduledAt !== c.before.scheduledAt)
          await push.notify(
            c.members,
            `${who} moved a shared task`,
            async (user) => `${String(c.after!.title)} is now ${await push.when(user, c.after!.scheduledAt)}.`,
            data,
          );
        else if (c.after.title !== c.before.title || c.after.duration !== c.before.duration)
          await push.notify(c.members, `${who} updated a shared task`, `${String(c.after.title)} · ${String(c.after.duration)} min.`, data);
      }
    })().catch(() => undefined);
  };
  // Invites look accounts up by email, so cap how fast one account can try.
  const inviteLimits = new Map<string, { count: number; until: number }>();
  const allowInvite = (user: string) => {
    const now = Date.now();
    for (const [k, v] of inviteLimits) if (v.until <= now) inviteLimits.delete(k);
    const limit = inviteLimits.get(user) || { count: 0, until: now + 600000 };
    limit.count++;
    inviteLimits.set(user, limit);
    return limit.count <= 30;
  };
  const json = (res: ServerResponse, status: number, data: unknown) => {
    res.writeHead(status, {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    res.end(JSON.stringify(data));
  };
  return createServer(async (req, res) => {
    const url = new URL(
      req.url || "/",
      `http://${req.headers.host || "localhost"}`,
    );
    const origin = req.headers.origin;
    const allowed = (process.env.CORS_ORIGINS || "").split(",").filter(Boolean);
    const local =
      process.env.NODE_ENV !== "production" &&
      !!origin &&
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (origin && (allowed.includes(origin) || local)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PATCH, OPTIONS",
      );
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    try {
      if (req.method === "GET" && url.pathname === "/health")
        return json(res, 200, {
          ok: true,
          service: "tempo-server",
          accountsRequired: true,
        });
      if (
        req.method === "POST" &&
        ["/v1/auth/register", "/v1/auth/login", "/v1/auth/forgot", "/v1/auth/reset"].includes(url.pathname)
      ) {
        const now = Date.now(),
          ip = req.socket.remoteAddress || "unknown";
        for (const [k, v] of authLimits)
          if (v.until <= now) authLimits.delete(k);
        if (authLimits.size >= 10000 && !authLimits.has(ip))
          return json(res, 429, { error: "Try again shortly." });
        const limit = authLimits.get(ip) || { count: 0, until: now + 60000 };
        limit.count++;
        authLimits.set(ip, limit);
        if (limit.count > 10)
          return json(res, 429, {
            error: "Too many attempts. Try again in a minute.",
          });
        let input;
        try {
          input = await body(req);
        } catch {
          return json(res, 400, { error: "Invalid account request." });
        }
        if (url.pathname.endsWith("forgot") || url.pathname.endsWith("reset")) {
          try { return json(res, 200, await (url.pathname.endsWith("forgot") ? recovery.request(input) : recovery.reset(input))); }
          catch(e) { return json(res, 400, { error: e instanceof Error ? e.message : "Could not recover this account." }); }
        }
        try {
          return json(
            res,
            url.pathname.endsWith("register") ? 201 : 200,
            await (url.pathname.endsWith("register")
              ? auth.register(input)
              : auth.login(input)),
          );
        } catch {
          return json(res, 400, {
            error: url.pathname.endsWith("register")
              ? "Could not create the account. Use a valid email, a name, and a 12–128 character password. If you already have an account, sign in."
              : "Email or password is incorrect.",
          });
        }
      }
      const token = String(req.headers.authorization || "").replace(
        /^Bearer /,
        "",
      );
      if (!/^[a-f0-9]{64}$/.test(token))
        return json(res, 401, { error: "Sign in to use Tempo." });
      const account = await auth.authenticate(token);
      if (!account)
        return json(res, 401, {
          error: "Your session has ended. Please sign in again.",
        });
      if (req.method === "GET" && url.pathname === "/v1/auth/me")
        return json(res, 200, { user: account });
      if (req.method === "POST" && url.pathname === "/v1/auth/logout") {
        // Stop sending this account's notifications to the device that signed out.
        const input = await body(req).catch(() => ({}));
        await push.unregister(account.id, input.pushToken);
        await auth.logout(token);
        return json(res, 200, { ok: true });
      }
      if (req.method === "PATCH" && url.pathname === "/v1/auth/me") {
        const input = await body(req);
        const name = typeof input.name === "string" ? input.name.trim() : "";
        if (!name || name.length > 80)
          return json(res, 400, { error: "Use a name of 1–80 characters." });
        const result = await store.pool.query(
          "UPDATE users SET display_name=$1 WHERE id=$2 RETURNING id,email,display_name AS name",
          [name, account.id],
        );
        return json(res, 200, { user: result.rows[0] });
      }
      if (req.method === "GET" && url.pathname === "/v1/workspace")
        return json(res, 200, await store.workspace(account.id));
      if (req.method === "POST" && url.pathname === "/v1/workspace") {
        const input = await body(req);
        try {
          return json(
            res,
            200,
            await store.saveWorkspace(
              account.id,
              input.revision,
              input.changes,
            ),
          );
        } catch (e) {
          if (e instanceof WorkspaceConflict)
            return json(res, 409, {
              error: e.message,
              workspace: await store.workspace(account.id),
            });
          return json(res, 400, {
            error: e instanceof Error ? e.message : "Could not save your plan.",
          });
        }
      }
      if (req.method === "POST" && url.pathname === "/v1/push/register") {
        try {
          return json(res, 200, await push.register(account.id, await body(req)));
        } catch {
          return json(res, 400, { error: "Could not register this device for notifications." });
        }
      }
      if (req.method === "GET" && url.pathname === "/v1/shares")
        return json(res, 200, await shares.list(account.id));
      if (req.method === "POST" && url.pathname.startsWith("/v1/shares")) {
        const action = url.pathname.slice("/v1/shares".length);
        if (!["", "/respond", "/remove", "/done"].includes(action))
          return json(res, 404, { error: "Not found" });
        if (action === "" && !allowInvite(account.id))
          return json(res, 429, {
            error: "You’ve added a lot of people recently. Try again in a few minutes.",
          });
        let input;
        try {
          input = await body(req);
        } catch {
          return json(res, 400, { error: "Invalid sharing request." });
        }
        try {
          const result =
            action === ""
              ? await shares.invite(account.id, input)
              : action === "/respond"
                ? await shares.respond(account.id, input)
                : action === "/remove"
                  ? await shares.remove(account.id, input)
                  : await shares.setDone(account.id, input);
          return json(res, 200, result);
        } catch (e) {
          if (e instanceof ShareError) return json(res, 400, { error: e.message });
          throw e;
        }
      }
      if (url.pathname.startsWith("/v1/team")) {
        try {
          if(req.method === "GET") {
            if(url.pathname === "/v1/team") return json(res,200,await team.list(account.id));
            if(url.pathname === "/v1/team/planning") return json(res,200,await team.planning(account.id));
            const owner=url.searchParams.get("owner") || "", record=url.searchParams.get("id") || "";
            if(!/^[a-f0-9-]{36}$/i.test(owner) || !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,199}$/.test(record)) return json(res,400,{error:"Choose a valid record."});
            if(url.pathname === "/v1/team/project") return json(res,200,await team.detail(account.id,owner,record));
            if(url.pathname === "/v1/team/comments") return json(res,200,await team.comments(account.id,owner,record));
          }
          if(req.method === "POST") {
            if(!allowInvite(account.id)) return json(res,429,{error:"Too many updates. Try again in a few minutes."});
            const input=await body(req);
            const actions: Record<string, (user:string,input:any)=>Promise<unknown>> = {
              "/v1/team/invite":team.invite.bind(team), "/v1/team/respond":team.respond.bind(team),
              "/v1/team/remove":team.remove.bind(team), "/v1/team/assign":team.assign.bind(team),
              "/v1/team/done":team.done.bind(team), "/v1/team/comments":team.comment.bind(team), "/v1/team/busy":team.busy.bind(team),
            };
            if(actions[url.pathname]) return json(res,200,await actions[url.pathname](account.id,input));
          }
          return json(res,404,{error:"Not found"});
        } catch(e) { if(e instanceof TeamError) return json(res,400,{error:e.message}); throw e; }
      }
      if(req.method === "GET" && url.pathname === "/v1/inbox") {
        const r=await store.pool.query("SELECT id::text,title,message,data,created_at AS at,read_at AS read FROM activities WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",[account.id]);
        return json(res,200,{items:r.rows});
      }
      if(req.method === "POST" && url.pathname === "/v1/inbox/read") {
        await store.pool.query("UPDATE activities SET read_at=now() WHERE user_id=$1 AND read_at IS NULL",[account.id]);
        return json(res,200,{ok:true});
      }
      if (req.method === "GET" && url.pathname === "/v1/connection")
        return json(res, 200, {
          connected: true,
          database: true,
          aiConfigured: !!process.env.ANTHROPIC_API_KEY,
          cloudStorage: true,
          account,
        });
      if (req.method === "POST" && url.pathname === "/v1/plan") {
        if (!planningLimit.allow(account.id))
          return json(res, 429, {
            error:
              "You’ve made several plans. Try again later; your saved plan is still available.",
          });
        try {
          return json(res, 200, await planCapture(await body(req)));
        } catch {
          return json(res, 400, {
            error:
              "Could not create an AI plan. Check your input or try again.",
          });
        }
      }
      return json(res, 404, { error: "Not found" });
    } catch {
      return json(res, 503, {
        error:
          "Tempo is temporarily unavailable. Your saved data is safe; please try again.",
      });
    }
  });
}
