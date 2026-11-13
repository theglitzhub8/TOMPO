import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import type { Pool } from "pg";
import type { Auth } from "./auth.js";

// Login with Hafrik (Sngine OAuth). Hafrik returns only `?auth_key=` to the
// callback and carries no state, so each login is bound to the device that
// started it: the app sends sha256(verifier) to /start, the callback hands the
// app a one-time ticket, and only ticket + verifier can be redeemed for a session.

export type HafrikProfile = { id: string; name: string; email: string | null };
export type HafrikFetch = (input: string, init?: RequestInit) => Promise<Response>;

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const hex64 = /^[a-f0-9]{64}$/;
const START_TTL = 10 * 60000;
const TICKET_TTL = 2 * 60000;
const LIMIT = 5000;

export class HafrikError extends Error {}

export const hafrikConfigured = () =>
  !!(process.env.HAFRIK_APP_ID && process.env.HAFRIK_APP_SECRET);

export class HafrikLogin {
  private starts = new Map<string, { challenge: string; until: number }>();
  private tickets = new Map<string, { userId: string; challenge: string; until: number }>();
  constructor(
    private pool: Pool,
    private auth: Auth,
    private fetcher: HafrikFetch = fetch,
  ) {}
  private get base() {
    return (process.env.HAFRIK_BASE_URL || "https://hafrik.com").replace(/\/$/, "");
  }
  get appRedirect() {
    return process.env.HAFRIK_APP_REDIRECT || "tempo://auth/hafrik";
  }
  private sweep() {
    const now = Date.now();
    for (const [k, v] of this.starts) if (v.until <= now) this.starts.delete(k);
    for (const [k, v] of this.tickets) if (v.until <= now) this.tickets.delete(k);
  }
  /** Returns the Hafrik consent URL and the state to keep in a cookie. */
  start(challenge: string | null) {
    if (!hafrikConfigured()) throw new HafrikError("Login with Hafrik is not configured on this server.");
    if (!challenge || !hex64.test(challenge)) throw new HafrikError("Start Login with Hafrik from the Tempo app.");
    this.sweep();
    if (this.starts.size >= LIMIT) throw new HafrikError("Too many sign-ins in progress. Try again shortly.");
    const state = randomBytes(32).toString("hex");
    this.starts.set(state, { challenge, until: Date.now() + START_TTL });
    return {
      state,
      location: `${this.base}/api/oauth?app_id=${encodeURIComponent(process.env.HAFRIK_APP_ID!)}`,
    };
  }
  /** Exchanges Hafrik's auth_key, links the account, and returns a one-time ticket. */
  async callback(state: string | null, authKey: string | null) {
    this.sweep();
    const pending = state && hex64.test(state) ? this.starts.get(state) : undefined;
    if (!pending) throw new HafrikError("This sign-in expired. Start Login with Hafrik again.");
    this.starts.delete(state!);
    if (!authKey || authKey.length > 200 || !/^[A-Za-z0-9]+$/.test(authKey))
      throw new HafrikError("Hafrik did not complete the sign-in.");
    const profile = await this.profile(authKey);
    const userId = await this.link(profile);
    const ticket = randomBytes(32).toString("hex");
    this.tickets.set(sha(ticket), { userId, challenge: pending.challenge, until: Date.now() + TICKET_TTL });
    return ticket;
  }
  /** Redeems a ticket with the app's verifier for a Tempo session. */
  async redeem(input: any) {
    this.sweep();
    const ticket = typeof input?.ticket === "string" && hex64.test(input.ticket) ? input.ticket : "";
    const verifier = typeof input?.verifier === "string" && hex64.test(input.verifier) ? input.verifier : "";
    const entry = ticket ? this.tickets.get(sha(ticket)) : undefined;
    if (!entry || !verifier) throw new HafrikError("This sign-in expired. Start Login with Hafrik again.");
    this.tickets.delete(sha(ticket));
    const expected = Buffer.from(entry.challenge, "hex");
    const actual = Buffer.from(sha(verifier), "hex");
    if (!timingSafeEqual(expected, actual)) throw new HafrikError("This sign-in expired. Start Login with Hafrik again.");
    const r = await this.pool.query(
      "SELECT id,COALESCE(email,'') AS email,display_name AS name FROM users WHERE id=$1",
      [entry.userId],
    );
    if (!r.rows[0]) throw new HafrikError("This sign-in expired. Start Login with Hafrik again.");
    return { user: r.rows[0], token: await this.auth.session(entry.userId) };
  }
  private async call(path: string, init?: RequestInit) {
    let data: any;
    try {
      const response = await this.fetcher(`${this.base}${path}`, { ...init, signal: AbortSignal.timeout(10000) });
      data = await response.json();
    } catch {
      throw new HafrikError("Could not reach Hafrik. Try again.");
    }
    if (!data || data.error) throw new HafrikError("Hafrik did not approve this sign-in. Try again.");
    return data;
  }
  private async profile(authKey: string): Promise<HafrikProfile> {
    const { access_token } = await this.call("/api/authorize", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        app_id: process.env.HAFRIK_APP_ID!,
        app_secret: process.env.HAFRIK_APP_SECRET!,
        auth_key: authKey,
      }).toString(),
    });
    if (typeof access_token !== "string" || !access_token) throw new HafrikError("Hafrik did not approve this sign-in. Try again.");
    const { user_info: u } = await this.call(`/api/get_user_info?access_token=${encodeURIComponent(access_token)}`);
    const id = String(u?.user_id ?? "");
    if (!/^\d{1,20}$/.test(id)) throw new HafrikError("Hafrik did not return an account.");
    const full = [u.user_firstname, u.user_lastname].filter((p) => typeof p === "string" && p.trim()).join(" ").trim();
    const name = (full || (typeof u.user_name === "string" ? u.user_name : "") || "Hafrik user").slice(0, 80);
    const email = typeof u.user_email === "string" && /^\S+@\S+\.\S+$/.test(u.user_email) && u.user_email.length <= 254
      ? u.user_email.trim().toLowerCase()
      : null;
    return { id, name, email };
  }
  // Accounts are linked by Hafrik user_id only. The Hafrik email is kept for
  // display and invites when no other Tempo account uses it, but it never
  // links to or signs in an existing email account.
  private async link(profile: HafrikProfile) {
    const external = `hafrik:${profile.id}`;
    const existing = await this.pool.query("SELECT id FROM users WHERE external_id=$1", [external]);
    if (existing.rows[0]) return existing.rows[0].id as string;
    const created = await this.pool.query(
      `INSERT INTO users(external_id,email,display_name)
       VALUES($1,(SELECT $2::text WHERE NOT EXISTS (SELECT 1 FROM users WHERE email=$2)),$3)
       ON CONFLICT (external_id) DO UPDATE SET external_id=EXCLUDED.external_id
       RETURNING id`,
      [external, profile.email, profile.name],
    );
    return created.rows[0].id as string;
  }
}
