import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from './_db/client.js';
import { handle, json, parseBody, uuid } from './_lib/http.js';

const PostBody = z.object({
  playerId: uuid.nullable(),
  nickname: z.string().trim().min(1).max(20),
  major: z.string().min(1).max(20),
  labId: z.string().min(1).max(40),
  career: z.string().min(1).max(40),
  score: z.number().int().min(-1000).max(100000),
  grade: z.enum(['S', 'A', 'B', 'C', 'D']),
  papers: z.array(z.object({ venue: z.string(), tier: z.string(), authorOrder: z.number().int() })).max(50),
  seed: z.string().min(1).max(100),
});

/** GET /api/runs?major=ai&limit=20 — 랭킹 조회 */
export function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const url = new URL(req.url);
    const major = url.searchParams.get('major') ?? 'ai';
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 20) || 20));
    const rows = await getDb()
      .select({
        id: schema.runs.id,
        nickname: schema.runs.nickname,
        labId: schema.runs.labId,
        career: schema.runs.career,
        score: schema.runs.score,
        grade: schema.runs.grade,
        finishedAt: schema.runs.finishedAt,
      })
      .from(schema.runs)
      .where(eq(schema.runs.major, major))
      .orderBy(desc(schema.runs.score), schema.runs.finishedAt)
      .limit(limit);
    return json(rows);
  });
}

/**
 * POST /api/runs — 엔딩 기록 등록.
 * TODO(v0.2): seed + 선택 로그로 engine을 재실행해 점수를 서버에서 검증 (치팅 방지).
 */
export function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const body = await parseBody(req, PostBody);
    if (body instanceof Response) return body;
    const [row] = await getDb().insert(schema.runs).values(body).returning({ id: schema.runs.id, score: schema.runs.score });
    return json(row, 201);
  });
}
