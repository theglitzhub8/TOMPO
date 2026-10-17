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
export class Store {
  readonly pool: Pool;
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
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}
