import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * 로컬 개발/프리뷰용: Node http 요청을 Vercel Functions(Web Request/Response,
 * 메서드별 named export) 핸들러로 연결한다. 배포 시에는 Vercel이 api/를 직접 실행.
 */
export type ApiModule = Record<string, unknown>;
export type ApiLoader = (name: string) => Promise<ApiModule | null>;

export async function handleApi(req: IncomingMessage, res: ServerResponse, load: ApiLoader): Promise<boolean> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (!url.pathname.startsWith('/api/')) return false;

  const name = url.pathname.slice('/api/'.length).replace(/\/$/, '');
  const send = (status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  };
  if (!/^[a-z0-9-]+$/.test(name)) {
    send(404, { error: 'not found' });
    return true;
  }

  let mod: ApiModule | null;
  try {
    mod = await load(name);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND' || /Failed to load url|Cannot find module/.test(String(e))) {
      send(404, { error: 'not found' });
      return true;
    }
    throw e;
  }
  const method = (req.method ?? 'GET').toUpperCase();
  const fn = mod?.[method];
  if (typeof fn !== 'function') {
    send(mod ? 405 : 404, { error: mod ? 'method not allowed' : 'not found' });
    return true;
  }

  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  const hasBody = method !== 'GET' && method !== 'HEAD' && chunks.length > 0;
  const request = new Request(url, { method, headers, body: hasBody ? Buffer.concat(chunks) : undefined });

  const response = (await (fn as (r: Request) => Promise<Response>)(request)) as Response;
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
  return true;
}

export function loadEnvFiles(dir: string): void {
  for (const f of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(`${dir}/${f}`);
    } catch {
      /* 없음 */
    }
  }
}
