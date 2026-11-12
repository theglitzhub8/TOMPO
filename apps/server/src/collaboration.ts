import type { Pool } from "pg";
import type { Push } from "./push.js";
export class TeamError extends Error {}
const identifier = (v: unknown): string => {
  if (typeof v !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,199}$/.test(v))
    throw new TeamError("Choose a valid record.");
  return v;
};
const uuid = (v: unknown): string => {
  if (
    typeof v !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
  )
    throw new TeamError("Choose a valid person.");
  return v;
};
export class Collaboration {
  constructor(
    private pool: Pool,
    private push: Push,
  ) {}
  async projectAccess(user: string, owner: string, project: string) {
    const r = await this.pool.query(
      `SELECT p.payload->>'title' AS title FROM entities p WHERE p.user_id=$1 AND p.kind='project' AND p.entity_id=$2
      AND ($3::uuid=$1 OR EXISTS(SELECT 1 FROM project_members m WHERE m.owner_id=$1 AND m.project_id=$2 AND m.member_id=$3 AND m.status='accepted'))`,
      [owner, project, user],
    );
    if (!r.rows.length)
      throw new TeamError("This project is not available to your account.");
    return r.rows[0].title as string;
  }
  async taskAccess(user: string, owner: string, task: string) {
    const r = await this.pool.query(
      `SELECT e.payload FROM entities e WHERE e.user_id=$1 AND e.kind='task' AND e.entity_id=$2 AND
      ($3::uuid=$1 OR EXISTS(SELECT 1 FROM task_shares s WHERE s.owner_id=$1 AND s.task_id=$2 AND s.member_id=$3 AND s.status='accepted') OR
      EXISTS(SELECT 1 FROM project_members m WHERE m.owner_id=$1 AND m.project_id=e.payload->>'projectId' AND m.member_id=$3 AND m.status='accepted'))`,
      [owner, task, user],
    );
    if (!r.rows.length)
      throw new TeamError("This task is not available to your account.");
    return r.rows[0].payload;
  }
  async list(user: string) {
    const r = await this.pool.query(
      `SELECT p.user_id AS "ownerId",p.entity_id AS "projectId",p.payload->>'title' AS title,u.display_name AS "ownerName",
      CASE WHEN p.user_id=$1 THEN 'owner' ELSE m.status END AS status FROM entities p JOIN users u ON u.id=p.user_id
      LEFT JOIN project_members m ON m.owner_id=p.user_id AND m.project_id=p.entity_id AND m.member_id=$1
      WHERE p.kind='project' AND (p.user_id=$1 OR m.status IN ('pending','accepted')) ORDER BY p.payload->>'title'`,
      [user],
    );
    const busy = await this.pool.query(
      `SELECT id,starts_at AS start,duration FROM busy_blocks WHERE user_id=$1 AND starts_at+duration*interval '1 minute'>now() ORDER BY starts_at LIMIT 100`,
      [user],
    );
    return { projects: r.rows, busy: busy.rows };
  }
  async detail(user: string, owner: string, project: string) {
    await this.projectAccess(user, owner, project);
    const members = await this.pool.query(
      `SELECT m.member_id AS id,u.display_name AS name,m.status FROM project_members m JOIN users u ON u.id=m.member_id
      WHERE m.owner_id=$1 AND m.project_id=$2 AND ($3::uuid=$1 OR m.status='accepted')`,
      [owner, project, user],
    );
    const tasks = await this.pool.query(
      `SELECT e.entity_id AS id,jsonb_build_object('title',e.payload->'title','duration',e.payload->'duration','status',e.payload->'status',
      'scheduledAt',e.payload->'scheduledAt','dueDay',e.payload->'dueDay') AS task,a.member_id AS "assigneeId",u.display_name AS "assigneeName"
      FROM entities e LEFT JOIN task_assignments a ON a.owner_id=e.user_id AND a.task_id=e.entity_id LEFT JOIN users u ON u.id=a.member_id
      WHERE e.user_id=$1 AND e.kind='task' AND e.payload->>'projectId'=$2 ORDER BY e.payload->>'scheduledAt' NULLS LAST`,
      [owner, project],
    );
    return { members: members.rows, tasks: tasks.rows };
  }
  async invite(user: string, input: any) {
    const project = identifier(input.projectId);
    const title = await this.projectAccess(user, user, project);
    if (typeof input.email !== "string" || input.email.length > 254)
      throw new TeamError("Enter a teammate’s email.");
    const r = await this.pool.query("SELECT id FROM users WHERE email=$1", [
      input.email.trim().toLowerCase(),
    ]);
    const member = r.rows[0]?.id;
    if (!member || member === user)
      throw new TeamError("Choose another person with a Tempo account.");
    const count = await this.pool.query(
      "SELECT count(*)::int AS n FROM project_members WHERE owner_id=$1 AND project_id=$2",
      [user, project],
    );
    if (count.rows[0].n >= 20)
      throw new TeamError("A project can have up to 20 teammates.");
    await this.pool.query(
      `INSERT INTO project_members(owner_id,project_id,member_id) VALUES($1,$2,$3) ON CONFLICT(owner_id,project_id,member_id) DO UPDATE SET status='pending' WHERE project_members.status='declined'`,
      [user, project, member],
    );
    await this.push.notify(
      [member],
      "Project invitation",
      `You’ve been invited to ${title}.`,
      { type: "project", ownerId: user, projectId: project },
    );
    return { ok: true };
  }
  async respond(user: string, input: any) {
    const owner = uuid(input.ownerId),
      project = identifier(input.projectId);
    if (typeof input.accept !== "boolean")
      throw new TeamError("Choose accept or decline.");
    const r = await this.pool.query(
      "UPDATE project_members SET status=$4 WHERE owner_id=$1 AND project_id=$2 AND member_id=$3 AND status='pending' RETURNING member_id",
      [owner, project, user, input.accept ? "accepted" : "declined"],
    );
    if (!r.rowCount)
      throw new TeamError("This invitation is no longer pending.");
    await this.push.notify(
      [owner],
      input.accept
        ? "Project invitation accepted"
        : "Project invitation declined",
      "Your teammate responded to the project invitation.",
      { type: "project", ownerId: owner, projectId: project },
    );
    return { ok: true };
  }
  async remove(user: string, input: any) {
    const owner = uuid(input.ownerId),
      project = identifier(input.projectId),
      member = uuid(input.memberId);
    if (user !== owner && user !== member)
      throw new TeamError("Only the owner can remove another teammate.");
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT 1 FROM users WHERE id=$1 FOR UPDATE", [owner]);
      await c.query(
        "DELETE FROM project_members WHERE owner_id=$1 AND project_id=$2 AND member_id=$3",
        [owner, project, member],
      );
      await c.query(
        "DELETE FROM task_assignments a USING entities e WHERE a.owner_id=$1 AND a.member_id=$3 AND e.user_id=a.owner_id AND e.entity_id=a.task_id AND e.kind='task' AND e.payload->>'projectId'=$2",
        [owner, project, member],
      );
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
    return { ok: true };
  }
  async assign(user: string, input: any) {
    const task = identifier(input.taskId);
    let payload: any;
    const member = input.memberId === null ? null : uuid(input.memberId);
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT 1 FROM users WHERE id=$1 FOR UPDATE", [user]);
      payload = await this.taskAccess(user, user, task);
      if (member && member !== user) {
        const r = await c.query(
          "SELECT 1 FROM project_members WHERE owner_id=$1 AND project_id=$2 AND member_id=$3 AND status='accepted' FOR UPDATE",
          [user, payload.projectId, member],
        );
        if (!r.rows.length)
          throw new TeamError("Assign work only to accepted project members.");
      }
      if (member)
        await c.query(
          "INSERT INTO task_assignments(owner_id,task_id,member_id) VALUES($1,$2,$3) ON CONFLICT(owner_id,task_id) DO UPDATE SET member_id=EXCLUDED.member_id",
          [user, task, member],
        );
      else
        await c.query(
          "DELETE FROM task_assignments WHERE owner_id=$1 AND task_id=$2",
          [user, task],
        );
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
    if (member && member !== user)
      await this.push.notify([member], "A task for you", payload.title, {
        type: "project",
        ownerId: user,
        projectId: payload.projectId,
        taskId: task,
      });
    return { ok: true };
  }
  async done(user: string, input: any) {
    const owner = uuid(input.ownerId),
      task = identifier(input.taskId);
    if (typeof input.done !== "boolean")
      throw new TeamError("Choose done or not done.");
    const c = await this.pool.connect();
    let payload: any;
    try {
      await c.query("BEGIN");
      await c.query("SELECT 1 FROM users WHERE id=$1 FOR UPDATE", [owner]);
      // Membership checks take place under the same owner lock as removal/workspace changes.
      payload = await this.taskAccess(user, owner, task);
      await c.query(
        "UPDATE entities SET payload=payload || jsonb_build_object('status',$3::text,'completedAt',$4::text),revision=revision+1 WHERE user_id=$1 AND kind='task' AND entity_id=$2",
        [
          owner,
          task,
          input.done ? "completed" : "pending",
          input.done ? new Date().toISOString() : null,
        ],
      );
      await c.query(
        "UPDATE users SET workspace_revision=workspace_revision+1 WHERE id=$1",
        [owner],
      );
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
    const members = await this.pool.query(
      `SELECT member_id AS id FROM project_members WHERE owner_id=$1 AND project_id=$2 AND status='accepted'
      UNION SELECT member_id AS id FROM task_shares WHERE owner_id=$1 AND task_id=$3 AND status='accepted'`,
      [owner, payload.projectId, task],
    );
    await this.push.notify(
      [...new Set([owner, ...members.rows.map((r) => r.id)])].filter(
        (id) => id !== user,
      ),
      input.done ? "Shared work completed" : "Shared work reopened",
      payload.title,
      {
        type: "project",
        ownerId: owner,
        taskId: task,
        projectId: payload.projectId,
      },
    );
    return { ok: true };
  }
  async comments(user: string, owner: string, task: string) {
    await this.taskAccess(user, owner, task);
    const r = await this.pool.query(
      "SELECT c.id,c.message,c.created_at AS at,u.display_name AS name FROM task_comments c JOIN users u ON u.id=c.author_id WHERE c.owner_id=$1 AND c.task_id=$2 ORDER BY c.created_at DESC LIMIT 100",
      [owner, task],
    );
    return { comments: r.rows.reverse() };
  }
  async comment(user: string, input: any) {
    const owner = uuid(input.ownerId),
      task = identifier(input.taskId);
    const payload = await this.taskAccess(user, owner, task);
    if (
      typeof input.message !== "string" ||
      !input.message.trim() ||
      input.message.length > 2000
    )
      throw new TeamError("Write a comment of 1–2,000 characters.");
    await this.pool.query(
      "INSERT INTO task_comments(owner_id,task_id,author_id,message) VALUES($1,$2,$3,$4)",
      [owner, task, user, input.message.trim()],
    );
    const members = await this.pool.query(
      `SELECT member_id AS id FROM task_shares WHERE owner_id=$1 AND task_id=$2 AND status='accepted'
      UNION SELECT member_id AS id FROM project_members WHERE owner_id=$1 AND project_id=$3 AND status='accepted'`,
      [owner, task, payload.projectId],
    );
    await this.push.notify(
      [...new Set([owner, ...members.rows.map((r) => r.id)])].filter(
        (id) => id !== user,
      ),
      "New task comment",
      `New comment on ${payload.title}.`,
      {
        type: "comment",
        ownerId: owner,
        taskId: task,
        projectId: payload.projectId,
      },
    );
    return this.comments(user, owner, task);
  }
  async busy(user: string, input: any) {
    if (input.removeId) {
      await this.pool.query(
        "DELETE FROM busy_blocks WHERE id=$1 AND user_id=$2",
        [uuid(input.removeId), user],
      );
      return { ok: true };
    }
    const start =
      typeof input.start === "string" ? Date.parse(input.start) : NaN;
    if (
      !Number.isFinite(start) ||
      start < Date.now() - 60000 ||
      start > Date.now() + 90 * 86400000 ||
      !Number.isInteger(input.duration) ||
      input.duration < 1 ||
      input.duration > 1440
    )
      throw new TeamError(
        "Choose a future time within 90 days and 1–1,440 minutes.",
      );
    const n = await this.pool.query(
      "SELECT count(*)::int AS n FROM busy_blocks WHERE user_id=$1 AND starts_at>now()",
      [user],
    );
    if (n.rows[0].n >= 100)
      throw new TeamError("You can save up to 100 future busy blocks.");
    await this.pool.query(
      "INSERT INTO busy_blocks(user_id,starts_at,duration) VALUES($1,$2,$3)",
      [user, new Date(start).toISOString(), input.duration],
    );
    return { ok: true };
  }
  async planning(user: string) {
    const r = await this.pool.query(
      `SELECT DISTINCT b.id,b.starts_at AS start,b.duration,m.project_id AS "projectId" FROM busy_blocks b
      JOIN project_members m ON m.member_id=b.user_id AND m.owner_id=$1 AND m.status='accepted'
      JOIN entities p ON p.user_id=m.owner_id AND p.kind='project' AND p.entity_id=m.project_id
      WHERE b.starts_at+duration*interval '1 minute'>now() AND b.starts_at<now()+interval '14 days' LIMIT 1000`,
      [user],
    );
    return { busy: r.rows };
  }
}
