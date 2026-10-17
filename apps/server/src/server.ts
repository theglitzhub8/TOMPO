import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { Auth } from "./auth.js";
import { Store, WorkspaceConflict } from "./store.js";
import { PlanningLimit, planCapture } from "./planning.js";

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
export function createTempoServer(store: Store) {
  const auth = new Auth(store.pool);
  const authLimits = new Map<string, { count: number; until: number }>();
  const planningLimit = new PlanningLimit();
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
        ["/v1/auth/register", "/v1/auth/login"].includes(url.pathname)
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
