import { Pool, type PoolClient } from "pg";
import { readFile } from "node:fs/promises";
import { validateChanges, type Change, type Kind } from "./entities.js";
export type { Kind } from "./entities.js";
export type Workspace = {
  revision: number;
  records: { kind: Kind; id: string; payload: Record<string, unknown> }[];
  savedAt: string;
};
export class WorkspaceConflict extends Error {
  constructor() {
    super(
      "Your plan changed on another device. Review the latest version and try again.",
    );
  }
}
/** An owner edit to a task that teammates have joined. */
export type SharedChange = {
  ownerId: string;
  taskId: string;
  members: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown> | null;
};
export class Store {
  readonly pool: Pool;
  onSharedChange?: (changes: SharedChange[]) => void;
  constructor(url = process.env.DATABASE_URL) {
    if (!url) throw new Error("DATABASE_URL is required");
    this.pool = new Pool({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 5000,
    });
  }
  async migrate() {
    const sql = await readFile(
      new URL("../migrations/001_initial.sql", import.meta.url),
      "utf8",
    );
    await this.pool.query(sql);
  }
  private async read(client: PoolClient, userId: string): Promise<Workspace> {
    const user = await client.query(
      "SELECT workspace_revision FROM users WHERE id=$1",
      [userId],
    );
    if (!user.rows[0]) throw new Error("Account unavailable");
    const records = await client.query(
      "SELECT kind,entity_id AS id,payload FROM entities WHERE user_id=$1 ORDER BY kind,entity_id",
      [userId],
    );
    return {
      revision: Number(user.rows[0].workspace_revision),
      records: records.rows,
      savedAt: new Date().toISOString(),
    };
  }
  async workspace(userId: string) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const result = await this.read(client, userId);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  private async sharedTasks(client: PoolClient, userId: string, taskIds: string[]) {
    if (!taskIds.length) return [];
    const result = await client.query(`SELECT s.task_id, array_agg(DISTINCT s.member_id) AS members, min(e.payload::text)::jsonb AS payload
               FROM (
                 SELECT owner_id,task_id,member_id,status FROM task_shares WHERE status='accepted'
                 UNION
                 SELECT m.owner_id,t.entity_id AS task_id,m.member_id,m.status FROM project_members m
                 JOIN entities t ON t.user_id=m.owner_id AND t.kind='task' AND t.payload->>'projectId'=m.project_id
                 WHERE m.status='accepted'
               ) s
               JOIN entities e ON e.user_id=s.owner_id AND e.kind='task' AND e.entity_id=s.task_id
              WHERE s.owner_id=$1 AND s.status='accepted' AND s.task_id = ANY($2::text[])
              GROUP BY s.task_id`, [userId, taskIds]);
    return result.rows as { task_id: string; members: string[]; payload: Record<string, unknown> }[];
  }
  async saveWorkspace(userId: string, revision: number, raw: unknown) {
    if (!Number.isSafeInteger(revision) || revision < 0)
      throw new Error("Invalid workspace revision.");
    const changes = validateChanges(raw);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const user = await client.query(
        "SELECT workspace_revision FROM users WHERE id=$1 FOR UPDATE",
        [userId],
      );
      if (!user.rows[0]) throw new Error("Account unavailable");
      if (Number(user.rows[0].workspace_revision) !== revision)
        throw new WorkspaceConflict();
      const taskIds = changes.filter((c) => c.kind === "task").map((c) => c.id);
      const shared = await this.sharedTasks(client, userId, taskIds);
      for (const e of changes) {
        if (e.payload === null)
          await client.query(
            "DELETE FROM entities WHERE user_id=$1 AND kind=$2 AND entity_id=$3",
            [userId, e.kind, e.id],
          );
        else
          await client.query(
            `INSERT INTO entities(user_id,kind,entity_id,payload) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,kind,entity_id) DO UPDATE SET payload=EXCLUDED.payload,revision=entities.revision+1,updated_at=now()`,
            [userId, e.kind, e.id, e.payload],
          );
      }
      const orphan = await client.query(
        `SELECT 1 FROM entities t WHERE t.user_id=$1 AND t.kind='task' AND t.payload->>'projectId' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM entities p WHERE p.user_id=t.user_id AND p.kind='project' AND p.entity_id=t.payload->>'projectId') LIMIT 1`,
        [userId],
      );
      if (orphan.rows.length)
        throw new Error(
          "A task refers to a project that is not in this account. Reassign it first.",
        );
      // People stay on a task only while the owner still has it.
      await client.query(
        `DELETE FROM task_shares s WHERE s.owner_id=$1 AND NOT EXISTS (SELECT 1 FROM entities e WHERE e.user_id=s.owner_id AND e.kind='task' AND e.entity_id=s.task_id)`,
        [userId],
      );
      await client.query(`DELETE FROM project_members m WHERE m.owner_id=$1 AND NOT EXISTS (SELECT 1 FROM entities e WHERE e.user_id=$1 AND e.kind='project' AND e.entity_id=m.project_id)`,[userId]);
      await client.query(`DELETE FROM task_assignments a WHERE a.owner_id=$1 AND NOT EXISTS (SELECT 1 FROM entities e WHERE e.user_id=$1 AND e.kind='task' AND e.entity_id=a.task_id
        AND (a.member_id=$1 OR EXISTS(SELECT 1 FROM project_members m WHERE m.owner_id=$1 AND m.project_id=e.payload->>'projectId' AND m.member_id=a.member_id AND m.status='accepted')))`,[userId]);
      await client.query(`DELETE FROM task_comments c WHERE c.owner_id=$1 AND NOT EXISTS (SELECT 1 FROM entities e WHERE e.user_id=$1 AND e.kind='task' AND e.entity_id=c.task_id)`,[userId]);
      const count = await client.query(
        "SELECT count(*)::int AS total FROM entities WHERE user_id=$1",
        [userId],
      );
      if (count.rows[0].total > 10000)
        throw new Error("This account has reached its record limit.");
      await client.query(
        "UPDATE users SET workspace_revision=workspace_revision+1 WHERE id=$1",
        [userId],
      );
      const result = await this.read(client, userId);
      const currentShares = await this.sharedTasks(client, userId, taskIds);
      const notifications: SharedChange[] = [];
      for (const taskId of taskIds) {
        const before = shared.find(s => s.task_id === taskId);
        const after = currentShares.find(s => s.task_id === taskId);
        const prior = before?.members ?? [], current = after?.members ?? [];
        const lost = prior.filter(id => !current.includes(id));
        const retained = prior.filter(id => current.includes(id));
        const added = current.filter(id => !prior.includes(id));
        if (lost.length) notifications.push({ ownerId: userId, taskId, members: lost, before: before!.payload, after: null });
        if (retained.length) notifications.push({ ownerId: userId, taskId, members: retained, before: before!.payload, after: after!.payload });
        if (added.length) notifications.push({ ownerId: userId, taskId, members: added, before: {}, after: after!.payload });
      }
      await client.query("COMMIT");
      if (notifications.length && this.onSharedChange) this.onSharedChange(notifications);
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}
