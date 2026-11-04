import { z } from 'zod';
import { getDb, schema } from './_db/client.js';
import { handle, json, parseBody } from './_lib/http.js';

const Body = z.object({ nickname: z.string().trim().min(1).max(20) });

/** POST /api/players — 익명 플레이어 생성 (v0.1: 익명 UUID) */
export function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const body = await parseBody(req, Body);
    if (body instanceof Response) return body;
    const [row] = await getDb()
      .insert(schema.players)
      .values({ nickname: body.nickname })
      .returning({ id: schema.players.id, nickname: schema.players.nickname });
    return json(row, 201);
  });
}
