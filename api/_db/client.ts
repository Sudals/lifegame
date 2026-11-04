import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

/**
 * Neon 연결: @neondatabase/serverless (HTTP, 443 포트).
 * - API는 요청당 단일 쿼리(upsert 포함)만 쓰므로 HTTP 트랜스포트로 충분하고, 커넥션 풀 관리가 필요 없다.
 * - 개발 네트워크에서 Postgres 5432 포트가 막혀 있어도 동작한다.
 * - 트랜잭션이 필요해지면 drizzle-orm/neon-serverless(WebSocket Pool)로, Vercel Fluid compute에서
 *   상시 풀이 필요하면 node-postgres + attachDatabasePool로 교체 (Neon skill 권장 패턴).
 * DB 접근은 api/에서만 — 프론트(VITE_*)에 DB URL 노출 금지.
 */
let db: NeonHttpDatabase<typeof schema> | null = null;

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL이 설정되지 않았습니다 (.env.local 확인 / neon env pull).');
  db = drizzle({ client: neon(url), schema });
  return db;
}

export { schema };
