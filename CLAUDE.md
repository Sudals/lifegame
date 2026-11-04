# CLAUDE.md

대학원 시뮬레이션 「졸업할 수 있을까?」 — 기획: `docs/01_기획안_대학원시뮬레이션.md`, 환경: `docs/02_개발환경_대학원시뮬레이션.md`

## 작업 규칙
- 게임 로직은 `packages/engine`에만 작성. React/DOM import 금지.
- 모든 랜덤은 `engine/src/rng.ts`의 시드 RNG 사용 (Math.random 금지). 엔진 공개 액션은 상태를 복제해 반환(원본 불변).
- 콘텐츠(연구실/주제/학회/이벤트)는 `packages/content/majors/<전공>/*.json`에 추가하고 zod 스키마 + 참조 무결성 통과 필수.
- 밸런스 수치 하드코딩 금지 → `content/majors/ai/balance.json`. 수치 변경 후 `pnpm --filter @grad-sim/engine sim`으로 몬테카를로 리포트 확인.
- 새 기능은 vitest 테스트 동반. `pnpm test` 통과 후 커밋.
- 도트 에셋: 640x360 기준, palette.hex 외 색상 금지. 외부 에셋은 `docs/ASSETS_LICENSE.md`에 기록.
- 세이브 포맷 변경 시 `GAME_VERSION`(engine/src/state.ts) 올리고 migrate 함수 추가.

## DB (Neon)
- 스키마: `api/_db/schema.ts` (Drizzle). 변경 시 `pnpm db:generate` → 검토 → `pnpm db:migrate`.
- 운영(production) 브랜치에 적용 전 `neon checkout dev --create`로 개발 브랜치에서 먼저 검증.
- 드라이버: `@neondatabase/serverless` HTTP (`drizzle-orm/neon-http`). 개발 네트워크에서 5432 포트가 막혀 있어 TCP 드라이버(pg) 사용 불가.
- DB 접근은 `api/`에서만. `VITE_*`에 DB URL 금지. `api/` 아래 함수가 아닌 모듈은 `_` 접두 폴더(`_db`, `_lib`)에 둔다 (Vercel 규칙).

## 명령
- `pnpm dev` — Vite + 로컬 API (http://localhost:5173)
- `npm run build && npm start` — 프로덕션 빌드 로컬 실행 (http://localhost:4173)
- `pnpm test` / `pnpm db:smoke`
