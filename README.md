# 졸업할 수 있을까? — 대학원 시뮬레이션

컨택 메일 한 통부터 졸업 심사까지, 실제 학회 데드라인 달력 위에서 연구력·스트레스·체력·운·돈을 관리하는 선택지 기반 라이프 시뮬레이션. (v0.1 MVP: 인공지능학과, 석사 루트)

- 기획안: [docs/01_기획안_대학원시뮬레이션.md](docs/01_기획안_대학원시뮬레이션.md)
- 개발환경: [docs/02_개발환경_대학원시뮬레이션.md](docs/02_개발환경_대학원시뮬레이션.md)

## 구조

```
apps/web          Vite + React 게임 본체 (Vercel 정적 배포)
  art/            도트 그래픽 생성기 (팔레트·캐릭터·배경·이펙트 → public/art/*.png)
  src/art/        무대(640x360)·캐릭터·타자기 대사·이펙트 런타임
api/              Vercel Functions — health / players / saves / runs(랭킹)
  _db/            Drizzle 스키마 + Neon 클라이언트
packages/engine   순수 TS 게임 로직 (시드 RNG, 주간 턴, 연구 파이프라인, 심사, 이벤트, 스코어, 밸런스 봇)
packages/content  연구실 7 · 주제 카드 49 · 학회 17 · 저널 9 · 아이디어 경로 9 · 이벤트 21 · 진로 7 (JSON + zod)
drizzle/          SQL 마이그레이션
scripts/          로컬 서버(serve.ts), 마이그레이션, DB 스모크 테스트
neon.ts           Neon 서비스 선언 (.neon 링크 파일은 neon init/link가 생성, git 제외)
```

## 시작하기

```bash
corepack enable   # 또는 npm i -g pnpm@9
pnpm install
neon env pull     # .env.local 에 DATABASE_URL, DATABASE_URL_UNPOOLED
pnpm db:migrate   # 테이블 생성 (처음 한 번)
pnpm dev          # http://localhost:5173
```

프로덕션 빌드 확인: `npm run build && npm start` → http://localhost:4173

## 그래픽

외부 이미지 없이 코드로 생성한 HD 도트 (고정 팔레트 51색, 640x360 무대 정수/비율 확대).

```bash
pnpm --filter web art                         # public/art/*.png + src/art/manifest.json 재생성
pnpm --filter web art:preview <폴더> characters|scenes|fx   # 확대 미리보기
```

- 배경 11종 · 캐릭터 11명(표정 6 × 기본/눈깜빡/말하기) · 이펙트/도장/아이콘/UI 9-slice
- 애니메이션: 숨쉬기, 랜덤 눈깜빡임, 말할 때 입 모양, 타자기 대사, 모니터 코드 스크롤·깜빡임, 김, 서버 LED, 형광등 깜빡임,
  창밖 비/별, 디더 장면 전환, 주간 달력 넘김, 스탯 증감 팝업, 채택(도장+꽃가루)/리젝(도장+먹구름+흔들림), 졸업 불꽃놀이, 번아웃 비네트
- 라이선스: [docs/ASSETS_LICENSE.md](docs/ASSETS_LICENSE.md)

## 테스트

```bash
pnpm test                                  # 콘텐츠 스키마 + 엔진 단위테스트 + 몬테카를로 밸런스(전략 3종 × 150회)
pnpm --filter @grad-sim/engine sim         # 밸런스 상세 리포트
pnpm db:smoke                              # Neon 왕복 테스트
pnpm test:e2e                              # npm start 후: 봇 1회차 → 클라우드 세이브/로드 → 랭킹 등록/조회 → 테스트 행 정리
pnpm exec tsx scripts/ui-walkthrough.ts <폴더>   # npm start 후: 설치된 Chrome으로 실제 UI 플레이 + 스크린샷
```

## 배포 (Vercel)
레포 연결 → 루트 그대로 사용 (`vercel.json`). Vercel 프로젝트 환경변수에 `DATABASE_URL`을 넣거나 Neon 통합을 설치.
