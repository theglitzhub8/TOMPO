import { randomBytes, createHash } from "node:crypto";
import type { Pool } from "pg";
import { credentials, hashPassword } from "./auth.js";
export type ResetMailer = (email: string, token: string) => Promise<void>;
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const mailConfigured = () =>
  !!(process.env.RESEND_API_KEY && process.env.TEMPO_MAIL_FROM);
export const sendReset: ResetMailer = async (email, token) => {
  if (!mailConfigured())
    throw new Error(
      "Password recovery email is not configured on this server.",
    );
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.TEMPO_MAIL_FROM,
      to: [email],
      subject: "Reset your Tempo password",
      text: `Your Tempo password reset code is:\n\n${token}\n\nOpen Tempo, choose Forgot password, and paste this code with your new password. This code expires in 30 minutes. If you did not request it, ignore this email.`,
    }),
  });
  if (!response.ok)
    throw new Error("Could not deliver recovery email. Try again later.");
};
export class Recovery {
  constructor(
    private pool: Pool,
    private send: ResetMailer = sendReset,
  ) {}
  async request(input: any) {
    if (
      !input ||
      typeof input.email !== "string" ||
      input.email.length > 254 ||
      !/^\S+@\S+\.\S+$/.test(input.email)
    )
      throw new Error("Enter a valid email address.");
    if (this.send === sendReset && !mailConfigured())
      throw new Error(
        "Password recovery email is not configured on this server.",
      );
    const email = input.email.trim().toLowerCase();
    const r = await this.pool.query("SELECT id FROM users WHERE email=$1", [
      email,
    ]);
    if (r.rows.length) {
      const token = randomBytes(32).toString("hex");
      await this.pool.query(
        "DELETE FROM password_resets WHERE user_id=$1 OR expires_at<now()",
        [r.rows[0].id],
      );
      await this.pool.query(
        "INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 minutes')",
        [hash(token), r.rows[0].id],
      );
      // Delivery failures stay generic, preserving account-existence privacy.
      try {
        await this.send(email, token);
      } catch {
        await this.pool.query(
          "DELETE FROM password_resets WHERE token_hash=$1",
          [hash(token)],
        );
      }
    }
    return {
      message:
        "If an account uses that email, a reset code will arrive shortly.",
    };
  }
  async reset(input: any) {
    if (
      !input ||
      typeof input.token !== "string" ||
      !/^[a-f0-9]{64}$/.test(input.token)
    )
      throw new Error("Enter the reset code from your email.");
    const { password } = credentials({
      email: "reset@example.test",
      password: input.password,
    });
    const passwordHash = await hashPassword(password);
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const r = await c.query(
        "SELECT user_id FROM password_resets WHERE token_hash=$1 AND expires_at>now() FOR UPDATE",
        [hash(input.token)],
      );
      if (!r.rows.length)
        throw new Error(
          "This reset code is invalid or expired. Request a new one.",
        );
      const user = r.rows[0].user_id;
      await c.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
        passwordHash,
        user,
      ]);
      await c.query("DELETE FROM sessions WHERE user_id=$1", [user]);
      await c.query("DELETE FROM push_tokens WHERE user_id=$1", [user]);
      await c.query("DELETE FROM password_resets WHERE user_id=$1", [user]);
      await c.query("COMMIT");
      return { message: "Password updated. Sign in with your new password." };
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
}
