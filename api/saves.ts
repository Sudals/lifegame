import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from './_db/client.js';
import { error, handle, json, parseBody, uuid } from './_lib/http.js';

const Slot = z.coerce.number().int().min(1).max(3);
const PutBody = z.object({
  playerId: uuid,
  slot: Slot,
  gameVersion: z.string().min(1).max(20),
  data: z.record(z.string(), z.unknown()),
});

const MAX_SAVE_BYTES = 512 * 1024;

/** GET /api/saves?playerId=…[&slot=1] — 슬롯 목록 또는 단일 세이브 */
export function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const url = new URL(req.url);
    const playerId = uuid.safeParse(url.searchParams.get('playerId'));
    if (!playerId.success) return error('playerId가 필요합니다.');
    const db = getDb();
    const slotParam = url.searchParams.get('slot');
    if (slotParam === null) {
      // 목록은 data(jsonb)를 제외하고 가져와 전송량 절약
      const rows = await db
        .select({ slot: schema.saves.slot, gameVersion: schema.saves.gameVersion, updatedAt: schema.saves.updatedAt })
        .from(schema.saves)
        .where(eq(schema.saves.playerId, playerId.data))
        .orderBy(schema.saves.slot);
      return json(rows);
    }
    const slot = Slot.safeParse(slotParam);
    if (!slot.success) return error('slot은 1~3입니다.');
    const [row] = await db
      .select({ slot: schema.saves.slot, gameVersion: schema.saves.gameVersion, data: schema.saves.data, updatedAt: schema.saves.updatedAt })
      .from(schema.saves)
      .where(and(eq(schema.saves.playerId, playerId.data), eq(schema.saves.slot, slot.data)))
      .limit(1);
    return row ? json(row) : error('세이브가 없습니다.', 404);
  });
}

/** PUT /api/saves — 클라우드 세이브 업로드 (슬롯 upsert) */
export function PUT(req: Request): Promise<Response> {
  return handle(async () => {
    const body = await parseBody(req, PutBody);
    if (body instanceof Response) return body;
    if (JSON.stringify(body.data).length > MAX_SAVE_BYTES) return error('세이브 용량 초과', 413);
    const [row] = await getDb()
      .insert(schema.saves)
      .values({ playerId: body.playerId, slot: body.slot, gameVersion: body.gameVersion, data: body.data })
      .onConflictDoUpdate({
        target: [schema.saves.playerId, schema.saves.slot],
        set: { gameVersion: body.gameVersion, data: body.data, updatedAt: sql`now()` },
      })
      .returning({ slot: schema.saves.slot, updatedAt: schema.saves.updatedAt });
    return json(row);
  });
}
