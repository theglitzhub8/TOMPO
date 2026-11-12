import type { Pool } from "pg";

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  channelId: "tasks";
  data: Record<string, unknown>;
};
export type PushTicket = { status: "ok" | "error"; details?: { error?: string } };
/** Delivers a batch to Expo's push service; returns one ticket per message. */
export type PushSender = (messages: PushMessage[]) => Promise<PushTicket[]>;

export const expoSender: PushSender = async (messages) => {
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(process.env.EXPO_ACCESS_TOKEN
        ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Push service returned ${response.status}`);
  const result = (await response.json()) as { data?: PushTicket[] };
  return Array.isArray(result.data) ? result.data : [];
};

const tokenPattern = /^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{10,200}\]$/;

export class Push {
  constructor(
    private pool: Pool,
    private send: PushSender | null = expoSender,
  ) {}

  async register(user: string, input: { token?: unknown; platform?: unknown }) {
    if (typeof input.token !== "string" || !tokenPattern.test(input.token))
      throw new Error("Invalid push token.");
    if (input.platform !== "ios" && input.platform !== "android")
      throw new Error("Invalid platform.");
    // A device belongs to whoever signed in on it last.
    await this.pool.query(
      `INSERT INTO push_tokens(token, user_id, platform) VALUES($1,$2,$3)
       ON CONFLICT (token) DO UPDATE SET user_id=EXCLUDED.user_id, platform=EXCLUDED.platform, updated_at=now()`,
      [input.token, user, input.platform],
    );
    await this.pool.query(
      `DELETE FROM push_tokens WHERE user_id=$1 AND token NOT IN
         (SELECT token FROM push_tokens WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 10)`,
      [user],
    );
    return { ok: true };
  }

  async unregister(user: string, token: unknown) {
    if (typeof token === "string")
      await this.pool.query("DELETE FROM push_tokens WHERE user_id=$1 AND token=$2", [user, token]);
  }

  /** The person's own timezone, so times in their notifications read right. */
  async timezone(user: string) {
    const r = await this.pool.query(
      "SELECT payload->>'timezone' AS zone FROM entities WHERE user_id=$1 AND kind='preferences' AND entity_id='singleton'",
      [user],
    );
    const zone = r.rows[0]?.zone;
    try {
      new Intl.DateTimeFormat("en", { timeZone: zone }).format();
      return zone as string;
    } catch {
      return "UTC";
    }
  }

  async when(user: string, scheduledAt: unknown) {
    if (typeof scheduledAt !== "string" || !Number.isFinite(Date.parse(scheduledAt)))
      return "flexible time";
    const timeZone = await this.timezone(user);
    const at = new Date(scheduledAt);
    const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(d);
    const clock = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(at);
    if (day(at) === day(new Date())) return `today at ${clock}`;
    const date = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(at);
    return `${date} at ${clock}`;
  }

  /** Best effort: a failed push never fails the request that caused it. */
  async notify(
    users: string[],
    title: string,
    body: string | ((user: string) => Promise<string>),
    data: Record<string, unknown> = {},
  ) {
    if (!users.length) return;
    for (const user of [...new Set(users)]) {
      try { await this.pool.query("INSERT INTO activities(user_id,title,message,data) VALUES($1,$2,$3,$4)", [user,title,typeof body === "string" ? body : await body(user),data]); }
      catch { console.error("Could not record an activity."); }
    }
    if (!this.send) return;
    try {
      const rows = await this.pool.query(
        "SELECT token, user_id FROM push_tokens WHERE user_id = ANY($1::uuid[])",
        [[...new Set(users)]],
      );
      const messages: PushMessage[] = [];
      for (const row of rows.rows)
        messages.push({
          to: row.token,
          title,
          body: typeof body === "string" ? body : await body(row.user_id),
          sound: "default",
          channelId: "tasks",
          data: { tempoPush: true, ...data },
        });
      for (let i = 0; i < messages.length; i += 100) {
        const batch = messages.slice(i, i + 100);
        const tickets = await this.send(batch);
        const gone = batch
          .filter((_, n) => tickets[n]?.details?.error === "DeviceNotRegistered")
          .map((m) => m.to);
        if (gone.length)
          await this.pool.query("DELETE FROM push_tokens WHERE token = ANY($1::text[])", [gone]);
      }
    } catch (e) {
      console.error("Push delivery failed:", e instanceof Error ? e.message : e);
    }
  }
}
