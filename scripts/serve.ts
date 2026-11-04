/**
 * 프로덕션 빌드 로컬 실행: apps/web/dist 정적 서빙 + /api/* → api/*.ts (Vercel과 동일 구조)
 *   npm run build && npm start
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { handleApi, loadEnvFiles } from './api-adapter.js';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const dist = join(root, 'apps/web/dist');
loadEnvFiles(root);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

if (!existsSync(join(dist, 'index.html'))) {
  console.error('apps/web/dist가 없습니다. 먼저 `npm run build`를 실행하세요.');
  process.exit(1);
}

const port = Number(process.env.PORT ?? 4173);
createServer(async (req, res) => {
  try {
    const handled = await handleApi(req, res, async (name) => {
      const file = join(root, 'api', `${name}.ts`);
      return existsSync(file) ? ((await import(pathToFileURL(file).href)) as Record<string, unknown>) : null;
    });
    if (handled) return;

    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    let file = normalize(join(dist, pathname));
    if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html'); // SPA rewrite
    res.setHeader('content-type', MIME[extname(file)] ?? 'application/octet-stream');
    createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.end('internal error');
  }
}).listen(port, () => console.log(`grad-sim ▶ http://localhost:${port}  (api: /api/health, /api/players, /api/saves, /api/runs)`));
