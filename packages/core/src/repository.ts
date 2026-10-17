import { defaults, validate, type EntityMap } from "./model.ts";
export interface Database {
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    ...params: (string | number | null)[]
  ): Promise<unknown>;
  getAllAsync<T>(
    sql: string,
    ...params: (string | number | null)[]
  ): Promise<T[]>;
}
export const migration = `PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS entities (kind TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(kind,id));
CREATE TABLE IF NOT EXISTS outbox (sequence INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, entity_id TEXT NOT NULL, payload TEXT NOT NULL, revision INTEGER NOT NULL, created_at TEXT NOT NULL);
PRAGMA user_version = 1;`;
export class Repository {
  private queue: Promise<unknown> = Promise.resolve();
  private db: Database;
  constructor(db: Database) {
    this.db = db;
  }
  async initialize() {
    await this.db.execAsync(migration);
  }
  async list<K extends keyof EntityMap>(kind: K): Promise<EntityMap[K][]> {
    await this.queue;
    const rows = await this.db.getAllAsync<{ payload: string }>(
      "SELECT payload FROM entities WHERE kind = ? ORDER BY id",
      kind,
    );
    return rows.map((row) => {
      const entity = JSON.parse(row.payload);
      validate(kind, entity);
      return entity;
    });
  }
  async preferences() {
    return (await this.list("preferences"))[0] ?? { ...defaults };
  }
  save<K extends keyof EntityMap>(kind: K, entity: EntityMap[K]) {
    return this.saveMany(kind, [entity]);
  }
  saveMany<K extends keyof EntityMap>(kind: K, entities: EntityMap[K][]) {
    return this.saveBatch(entities.map((entity) => ({ kind, entity })));
  }
  saveBatch(
    entries: { kind: keyof EntityMap; entity: EntityMap[keyof EntityMap] }[],
  ) {
    const records = entries.map(({ kind, entity }) => {
      validate(kind, entity);
      return {
        entity,
        kind,
        id:
          kind === "preferences" ? "singleton" : (entity as { id: string }).id,
        payload: JSON.stringify(entity),
      };
    });
    const operation = this.queue.then(async () => {
      await this.db.execAsync("BEGIN IMMEDIATE");
      try {
        for (const { kind, entity, id, payload } of records) {
          if (kind === "task") {
            const project = (entity as EntityMap["task"]).projectId;
            if (
              project &&
              !(
                await this.db.getAllAsync(
                  "SELECT id FROM entities WHERE kind = ? AND id = ?",
                  "project",
                  project,
                )
              ).length
            )
              throw new Error("Project does not exist");
          }
          await this.db.runAsync(
            "INSERT INTO entities(kind,id,payload) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload, revision=entities.revision+1",
            kind,
            id,
            payload,
          );
          await this.db.runAsync(
            "INSERT INTO outbox(kind,entity_id,payload,revision,created_at) SELECT kind,id,payload,revision,? FROM entities WHERE kind=? AND id=?",
            new Date().toISOString(),
            kind,
            id,
          );
        }
        await this.db.execAsync("COMMIT");
      } catch (error) {
        await this.db.execAsync("ROLLBACK");
        throw error;
      }
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
  async remove<K extends keyof EntityMap>(kind: K, id: string) {
    const operation = this.queue.then(async () => {
      await this.db.execAsync("BEGIN IMMEDIATE");
      try {
        await this.db.runAsync(
          "DELETE FROM entities WHERE kind = ? AND id = ?",
          kind,
          id,
        );
        await this.db.runAsync(
          "INSERT INTO outbox(kind,entity_id,payload,revision,created_at) VALUES(?,?,?,?,?)",
          kind,
          id,
          "null",
          0,
          new Date().toISOString(),
        );
        await this.db.execAsync("COMMIT");
      } catch (error) {
        await this.db.execAsync("ROLLBACK");
        throw error;
      }
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
  async pendingChanges() {
    await this.queue;
    return this.db.getAllAsync<{
      sequence: number;
      kind: string;
      entity_id: string;
      payload: string;
      revision: number;
    }>("SELECT * FROM outbox ORDER BY sequence");
  }
}
