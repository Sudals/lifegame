import { sql } from 'drizzle-orm';
import { getDb } from './_db/client.js';
import { handle, json } from './_lib/http.js';

/** GET /api/health — DB 연결 확인 */
export function GET(): Promise<Response> {
  return handle(async () => {
    const started = Date.now();
    const r = await getDb().execute(sql`select now() as now, current_database() as db, version() as version`);
    const row = r.rows[0] as { now: string; db: string; version: string };
    return json({ ok: true, db: row.db, now: row.now, postgres: String(row.version).split(' ').slice(0, 2).join(' '), latencyMs: Date.now() - started });
  });
}
