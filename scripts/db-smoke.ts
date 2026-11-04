/** Neon 연결 스모크 테스트: 세이브 왕복 후 정리 (pnpm db:smoke) */
import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFiles } from './api-adapter.js';

loadEnvFiles(resolve(fileURLToPath(import.meta.url), '../..'));
const { getDb, schema } = await import('../api/_db/client.js');

const db = getDb();
const [p] = await db.insert(schema.players).values({ nickname: 'smoke-test' }).returning();
await db.insert(schema.saves).values({ playerId: p!.id, slot: 1, gameVersion: '0.1.0', data: { hello: 'neon' } });
const [save] = await db.select().from(schema.saves).where(eq(schema.saves.playerId, p!.id));
await db.delete(schema.players).where(eq(schema.players.id, p!.id)); // cascade로 saves 삭제
const left = await db.select().from(schema.saves).where(eq(schema.saves.playerId, p!.id));
console.log(JSON.stringify({ ok: (save?.data as { hello?: string }).hello === 'neon' && left.length === 0, playerId: p!.id }));
