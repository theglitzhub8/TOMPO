import { Pool, type PoolClient } from 'pg';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type Kind = 'task'|'project'|'routine'|'preferences';
export type Event = {kind:Kind; entityId:string; payload:unknown; revision:number};
export class Store {
  readonly pool: Pool;
  constructor(url=process.env.DATABASE_URL){ if(!url) throw new Error('DATABASE_URL is required'); this.pool=new Pool({connectionString:url, max:10}); }
  async migrate(){ const sql=await readFile(join(process.cwd(),'migrations/001_initial.sql'),'utf8'); await this.pool.query(sql); }
  async user(externalId:string){ const r=await this.pool.query('INSERT INTO users(external_id) VALUES($1) ON CONFLICT(external_id) DO UPDATE SET external_id=EXCLUDED.external_id RETURNING id', [externalId]); return r.rows[0].id as string; }
  async list(userId:string,kind:Kind){ const r=await this.pool.query('SELECT entity_id as id,payload,revision,updated_at FROM entities WHERE user_id=$1 AND kind=$2 ORDER BY entity_id',[userId,kind]); return r.rows; }
  async upsert(client:PoolClient,userId:string,e:Event){ const r=await client.query(`INSERT INTO entities(user_id,kind,entity_id,payload) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,kind,entity_id) DO UPDATE SET payload=EXCLUDED.payload,revision=entities.revision+1,updated_at=now() RETURNING revision`,[userId,e.kind,e.entityId,e.payload]); const revision=r.rows[0].revision; await client.query('INSERT INTO sync_events(user_id,kind,entity_id,payload,revision) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[userId,e.kind,e.entityId,e.payload,revision]); return revision; }
  async save(userId:string,events:Event[]){ const c=await this.pool.connect(); try{await c.query('BEGIN'); const out=[]; for(const e of events) out.push({...e,revision:await this.upsert(c,userId,e)}); await c.query('COMMIT'); return out;}catch(err){await c.query('ROLLBACK');throw err}finally{c.release()} }
  async remove(userId:string,kind:Kind,entityId:string){ await this.pool.query('DELETE FROM entities WHERE user_id=$1 AND kind=$2 AND entity_id=$3',[userId,kind,entityId]); }
  async changes(userId:string,after:number){const r=await this.pool.query('SELECT kind,entity_id as "entityId",payload,revision FROM sync_events WHERE user_id=$1 AND id>$2 ORDER BY id',[userId,after]); return r.rows;}
}
