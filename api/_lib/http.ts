import { z } from 'zod';

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export async function parseBody<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T> | Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return error('JSON 본문이 필요합니다.');
  }
  const r = schema.safeParse(raw);
  if (!r.success) return error(r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return r.data;
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    console.error('[api]', e);
    return error('서버 오류가 발생했습니다.', 500);
  }
}

export const uuid = z.string().uuid();
