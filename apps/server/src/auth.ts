import {
  randomBytes,
  scrypt as derive,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import type { Pool, PoolClient } from "pg";
const scrypt = promisify(derive);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [salt, hex] = hash.split(":");
  if (!salt || !hex) return false;
  const key = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hex, "hex");
  return expected.length === key.length && timingSafeEqual(key, expected);
}
export function credentials(input: any) {
  if (typeof input?.email !== "string" || typeof input?.password !== "string")
    throw new Error("Email and password are required");
  const email = input.email.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    input.password.length < 12 ||
    input.password.length > 128
  )
    throw new Error("Use a valid email and a password of 12–128 characters");
  return { email, password: input.password };
}
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export class Auth {
  private pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }
  async session(userId: string, db: Pool | PoolClient = this.pool) {
    const token = randomBytes(32).toString("hex");
    await db.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 days')",
      [digest(token), userId],
    );
    return token;
  }
  async authenticate(token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const r = await this.pool.query(
      "SELECT u.id,u.email,u.display_name AS name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()",
      [digest(token)],
    );
    return r.rows[0] ?? null;
  }
  async logout(token: string) {
    await this.pool.query("DELETE FROM sessions WHERE token_hash=$1", [
      digest(token),
    ]);
  }
  async register(input: any) {
    const { email, password } = credentials(input);
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name || name.length > 80)
      throw new Error("Enter a name of 1–80 characters");
    const hash = await hashPassword(password);
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const r = await c.query(
        "INSERT INTO users(external_id,email,display_name,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id,email,display_name AS name",
        [`email:${email}`, email, name, hash],
      );
      if (!r.rows[0]) throw new Error("Unable to register with these details");
      const token = await this.session(r.rows[0].id, c);
      await c.query("COMMIT");
      return { user: r.rows[0], token };
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  async login(input: any) {
    const { email, password } = credentials(input);
    const r = await this.pool.query(
      "SELECT id,email,display_name AS name,password_hash FROM users WHERE email=$1",
      [email],
    );
    const user = r.rows[0];
    const fallback = await hashPassword("dummy-password-for-timing");
    if (
      !(await verifyPassword(password, user?.password_hash ?? fallback)) ||
      !user
    )
      throw new Error("Invalid email or password");
    return {
      user: { id: user.id, email: user.email, name: user.name },
      token: await this.session(user.id),
    };
  }
}
