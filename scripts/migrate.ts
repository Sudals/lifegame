/**
 * drizzle/ 의 SQL 마이그레이션을 Neon에 적용 (HTTP 드라이버, direct/비풀링 URL 사용).
 *   pnpm db:generate   # 스키마 변경 → drizzle/*.sql 생성 (오프라인)
 *   pnpm db:migrate    # 적용
 * Neon 권장: 운영 적용 전 `neon checkout dev --create` 브랜치에서 먼저 검증.
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFiles } from './api-adapter.js';

const root = resolve(fileURLToPath(import.meta.url), '../..');
loadEnvFiles(root);
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL_UNPOOLED가 없습니다. `neon env pull`을 실행하세요.');

const started = Date.now();
await migrate(drizzle({ client: neon(url) }), { migrationsFolder: resolve(root, 'drizzle') });
const tables = await neon(url)`select table_name from information_schema.tables where table_schema = 'public' order by 1`;
console.log(JSON.stringify({ migrated: true, branch: process.env.NEON_BRANCH ?? null, tables: tables.map((t) => t.table_name), ms: Date.now() - started }));
