import react from '@vitejs/plugin-react';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { handleApi, loadEnvFiles } from '../../scripts/api-adapter';

const repoRoot = resolve(__dirname, '../..');

/** dev 서버에서 /api/* 를 api/*.ts(Vercel Functions)로 연결 — DB URL은 서버 측 process.env에만 존재 */
function localApi(): Plugin {
  return {
    name: 'grad-sim-local-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      loadEnvFiles(repoRoot);
      server.middlewares.use((req, res, next) => {
        handleApi(req, res, async (name) => {
          const file = join(repoRoot, 'api', `${name}.ts`);
          return existsSync(file) ? server.ssrLoadModule(file) : null;
        })
          .then((handled) => {
            if (!handled) next();
          })
          .catch((e) => {
            console.error('[api]', e);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(e) }));
          });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localApi()],
  envDir: repoRoot, // VITE_* 만 클라이언트에 노출됨
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  server: { port: 5173 },
});
