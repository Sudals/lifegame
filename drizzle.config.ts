import { defineConfig } from 'drizzle-kit';

// 마이그레이션은 direct(비풀링) 연결 사용 — Neon 권장
for (const f of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(f);
  } catch {
    /* 파일 없음 */
  }
}

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL_UNPOOLED가 없습니다. `neon env pull`을 실행하세요.');

export default defineConfig({
  schema: './api/_db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
});
