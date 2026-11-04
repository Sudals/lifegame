/**
 * API 왕복 E2E: 실제 게임 1회차(봇)를 돌려 → 클라우드 세이브 → 로드 비교 → 랭킹 등록/조회 → 생성한 행 정리.
 *   npm start (다른 터미널)  →  pnpm exec tsx scripts/e2e-api.ts [baseUrl]
 */
import { aiPack as pack } from '@grad-sim/content';
import { GAME_VERSION, runBot } from '@grad-sim/engine';
import { neon } from '@neondatabase/serverless';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { loadEnvFiles } from './api-adapter.js';

loadEnvFiles(resolve(fileURLToPath(import.meta.url), '../..'));
const BASE = process.argv[2] ?? 'http://localhost:4173';

function firstDiff(a: unknown, b: unknown, path: string): string | null {
  if (isDeepStrictEqual(a, b)) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const d = firstDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
      if (d) return d;
    }
  }
  return `${path}: ${JSON.stringify(a)?.slice(0, 80)} ≠ ${JSON.stringify(b)?.slice(0, 80)}`;
}

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown> & unknown[];
  console.log(`${method} ${path} → ${res.status}`);
  if (!res.ok) throw new Error(`${method} ${path} 실패: ${JSON.stringify(json)}`);
  return json;
}

const { state } = runBot(pack, 'e2e-api', 'diligent');
console.log(`봇 회차 종료: W${state.week}, 엔딩=${state.ending?.title}, 점수=${state.ending?.score}, 세이브 크기=${JSON.stringify(state).length}B`);

let playerId: string | null = null;
let runId: string | null = null;
try {
  const health = await call('GET', '/api/health');
  console.log('  ', JSON.stringify(health));

  const player = await call('POST', '/api/players', { nickname: 'e2e-test' });
  playerId = player.id as string;

  await call('PUT', '/api/saves', { playerId, slot: 2, gameVersion: GAME_VERSION, data: state });
  const list = await call('GET', `/api/saves?playerId=${playerId}`);
  console.log('   목록:', JSON.stringify(list));
  const loaded = await call('GET', `/api/saves?playerId=${playerId}&slot=2`);
  // jsonb는 키 순서를 보존하지 않으므로 구조 비교
  const same = isDeepStrictEqual(loaded.data, JSON.parse(JSON.stringify(state)));
  console.log(`   로드한 GameState가 원본과 구조적으로 동일: ${same}`);
  if (!same) {
    const diff = firstDiff(loaded.data, JSON.parse(JSON.stringify(state)), '');
    throw new Error(`세이브 왕복 불일치: ${diff}`);
  }

  // 같은 슬롯 덮어쓰기(upsert)
  await call('PUT', '/api/saves', { playerId, slot: 2, gameVersion: GAME_VERSION, data: { ...state, week: 1 } });
  const again = await call('GET', `/api/saves?playerId=${playerId}&slot=2`);
  console.log(`   upsert 후 week=${(again.data as { week: number }).week} (기대값 1)`);

  const run = await call('POST', '/api/runs', {
    playerId,
    nickname: 'e2e-test',
    major: state.major,
    labId: state.labId,
    career: state.ending!.careerId ?? 'dropout',
    score: state.ending!.score,
    grade: state.ending!.grade,
    papers: [],
    seed: state.seed,
  });
  runId = run.id as string;
  const ranking = await call('GET', '/api/runs?major=ai&limit=50');
  const found = (ranking as unknown as { id: string; score: number }[]).find((r) => r.id === runId);
  console.log(`   랭킹에서 등록 기록 확인: ${found ? `score ${found.score}` : '없음'}`);
  if (!found) throw new Error('랭킹 조회 실패');

  const bad = await fetch(`${BASE}/api/saves?playerId=not-a-uuid`);
  console.log(`GET /api/saves?playerId=not-a-uuid → ${bad.status} (기대값 400)`);
  console.log('E2E OK');
} finally {
  // 테스트로 만든 행만 정리 (운영 DB)
  const sql = neon(process.env.DATABASE_URL!);
  if (runId) await sql`delete from runs where id = ${runId}`;
  if (playerId) await sql`delete from players where id = ${playerId}`; // saves는 cascade
  const [left] = await sql`select (select count(*) from runs where nickname = 'e2e-test') as runs, (select count(*) from players where nickname = 'e2e-test') as players`;
  console.log('정리 완료, 남은 테스트 행:', JSON.stringify(left));
}
