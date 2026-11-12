import type { Pool } from "pg";
import type { Push } from "./push.js";

/** A user-facing sharing error: safe to return to the client as-is. */
export class ShareError extends Error {}

const taskId = (value: unknown) => {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,199}$/.test(value))
    throw new ShareError("Choose a valid task.");
  return value;
};
const userId = (value: unknown) => {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
    throw new ShareError("Choose a valid teammate.");
  return value;
};

// Only these task fields leave the owner's account.
const visibleTask = `jsonb_build_object(
  'title', e.payload->'title', 'duration', e.payload->'duration',
  'status', e.payload->'status', 'scheduledAt', e.payload->'scheduledAt',
  'completedAt', e.payload->'completedAt', 'steps', e.payload->'steps',
  'plannedDay', e.payload->'plannedDay', 'fixed', e.payload->'fixed')`;

const first = (name: string) => name.trim().split(/\s+/)[0] || name;

export class Shares {
  constructor(
    private pool: Pool,
    private push?: Push,
  ) {}

  private async names(ids: string[]) {
    const r = await this.pool.query(
      "SELECT id, display_name AS name FROM users WHERE id = ANY($1::uuid[])",
      [ids],
    );
    return new Map<string, string>(r.rows.map((u) => [u.id, u.name]));
  }

  private async taskPayload(owner: string, task: string) {
    const r = await this.pool.query(
      "SELECT payload FROM entities WHERE user_id=$1 AND kind='task' AND entity_id=$2",
      [owner, task],
    );
    return r.rows[0]?.payload as { title: string; scheduledAt: string | null } | undefined;
  }

  private async members(owner: string, task: string, except: string) {
    const r = await this.pool.query(
      "SELECT member_id FROM task_shares WHERE owner_id=$1 AND task_id=$2 AND status='accepted' AND member_id<>$3",
      [owner, task, except],
    );
    return r.rows.map((row) => row.member_id as string);
  }

  async list(user: string) {
    const outgoing = await this.pool.query(
      `SELECT s.task_id AS "taskId", s.member_id AS "memberId", s.status,
              u.display_name AS name, u.email
         FROM task_shares s JOIN users u ON u.id = s.member_id
        WHERE s.owner_id = $1
        ORDER BY s.created_at`,
      [user],
    );
    const incoming = await this.pool.query(
      `SELECT s.owner_id AS "ownerId", s.task_id AS "taskId", s.status,
              u.display_name AS "ownerName", u.email AS "ownerEmail",
              p.payload->>'title' AS "projectTitle",
              ${visibleTask} AS task
         FROM task_shares s
         JOIN users u ON u.id = s.owner_id
         JOIN entities e ON e.user_id = s.owner_id AND e.kind = 'task' AND e.entity_id = s.task_id
         LEFT JOIN entities p ON p.user_id = s.owner_id AND p.kind = 'project'
              AND p.entity_id = e.payload->>'projectId'
        WHERE s.member_id = $1 AND s.status <> 'declined'
        ORDER BY s.created_at`,
      [user],
    );
    return { outgoing: outgoing.rows, incoming: incoming.rows };
  }

  async invite(owner: string, input: { taskId?: unknown; email?: unknown }) {
    const task = taskId(input.taskId);
    const email =
      typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254)
      throw new ShareError("Enter your teammate’s email address.");
    const exists = await this.pool.query(
      "SELECT 1 FROM entities WHERE user_id=$1 AND kind='task' AND entity_id=$2",
      [owner, task],
    );
    if (!exists.rows.length)
      throw new ShareError("Save this task before adding people to it.");
    const member = await this.pool.query(
      "SELECT id, display_name AS name, email FROM users WHERE email=$1",
      [email],
    );
    const found = member.rows[0];
    if (!found)
      throw new ShareError(
        "No Tempo account uses that email yet. Ask them to sign up, then add them.",
      );
    if (found.id === owner) throw new ShareError("You’re already on this task.");
    const count = await this.pool.query(
      "SELECT count(*)::int AS total FROM task_shares WHERE owner_id=$1 AND task_id=$2",
      [owner, task],
    );
    if (count.rows[0].total >= 20)
      throw new ShareError("A task can have up to 20 people.");
    // Re-inviting someone who declined asks them again.
    const added = await this.pool.query(
      `INSERT INTO task_shares(owner_id, task_id, member_id) VALUES($1,$2,$3)
       ON CONFLICT (owner_id, task_id, member_id)
       DO UPDATE SET status='pending' WHERE task_shares.status='declined'`,
      [owner, task, found.id],
    );
    if (added.rowCount && this.push) {
      const [payload, names] = await Promise.all([
        this.taskPayload(owner, task),
        this.names([owner]),
      ]);
      const push = this.push;
      void push.notify(
        [found.id],
        `${first(names.get(owner) ?? "A teammate")} added you to a task`,
        async (user) => `${payload?.title ?? "A task"} · ${await push.when(user, payload?.scheduledAt)}. Open Tempo to add it to your day.`,
        { type: "invite", ownerId: owner, taskId: task },
      );
    }
    return { member: { id: found.id, name: found.name, email: found.email } };
  }

  async respond(
    member: string,
    input: { ownerId?: unknown; taskId?: unknown; accept?: unknown },
  ) {
    if (typeof input.accept !== "boolean")
      throw new ShareError("Choose accept or decline.");
    const result = await this.pool.query(
      "UPDATE task_shares SET status=$4 WHERE owner_id=$1 AND task_id=$2 AND member_id=$3",
      [
        userId(input.ownerId),
        taskId(input.taskId),
        member,
        input.accept ? "accepted" : "declined",
      ],
    );
    if (!result.rowCount) throw new ShareError("This invitation is no longer available.");
    if (this.push) {
      const owner = String(input.ownerId);
      const [payload, names] = await Promise.all([
        this.taskPayload(owner, String(input.taskId)),
        this.names([member]),
      ]);
      const who = first(names.get(member) ?? "Your teammate");
      void this.push.notify(
        [owner],
        input.accept ? `${who} joined your task` : `${who} can’t make it`,
        input.accept
          ? `${payload?.title ?? "Your task"} is now on ${who}’s day.`
          : `${who} declined ${payload?.title ?? "your task"}.`,
        { type: "response", taskId: input.taskId },
      );
    }
    return { ok: true };
  }

  /** The owner removes anyone; a member can only remove themselves. */
  async remove(
    user: string,
    input: { ownerId?: unknown; taskId?: unknown; memberId?: unknown },
  ) {
    const owner = userId(input.ownerId);
    const member = userId(input.memberId);
    if (user !== owner && user !== member)
      throw new ShareError("You can’t change who is on this task.");
    await this.pool.query(
      "DELETE FROM task_shares WHERE owner_id=$1 AND task_id=$2 AND member_id=$3",
      [owner, taskId(input.taskId), member],
    );
    return { ok: true };
  }

  /** The owner or an accepted member marks the shared task done or not done. */
  async setDone(
    user: string,
    input: { ownerId?: unknown; taskId?: unknown; done?: unknown },
  ) {
    const owner = userId(input.ownerId);
    const task = taskId(input.taskId);
    if (typeof input.done !== "boolean") throw new ShareError("Choose done or not done.");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Same lock as workspace saves, so the owner's revision stays consistent.
      await client.query("SELECT 1 FROM users WHERE id=$1 FOR UPDATE", [owner]);
      if (user !== owner) {
        const allowed = await client.query(
          "SELECT 1 FROM task_shares WHERE owner_id=$1 AND task_id=$2 AND member_id=$3 AND status='accepted'",
          [owner, task, user],
        );
        if (!allowed.rows.length)
          throw new ShareError("Accept this task before updating it.");
      }
      const updated = await client.query(
        `UPDATE entities
            SET payload = payload || jsonb_build_object('status', $3::text, 'completedAt', $4::text),
                revision = revision + 1, updated_at = now()
          WHERE user_id=$1 AND kind='task' AND entity_id=$2`,
        [owner, task, input.done ? "completed" : "pending", input.done ? new Date().toISOString() : null],
      );
      if (!updated.rowCount) throw new ShareError("This task no longer exists.");
      await client.query(
        "UPDATE users SET workspace_revision=workspace_revision+1 WHERE id=$1",
        [owner],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    if (this.push) {
      const [payload, names, members] = await Promise.all([
        this.taskPayload(owner, task),
        this.names([user]),
        this.members(owner, task, user),
      ]);
      const who = first(names.get(user) ?? "A teammate");
      void this.push.notify(
        user === owner ? members : [owner, ...members],
        input.done ? `${who} finished a shared task` : `${who} reopened a shared task`,
        `${payload?.title ?? "A task"}${input.done ? " is done." : " is back on the list."}`,
        { type: "done", ownerId: owner, taskId: task },
      );
    }
    return { ok: true };
  }
}
