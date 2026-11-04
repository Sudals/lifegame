import { describe, expect, it } from 'vitest';
import { aiPack as pack } from '@grad-sim/content';
import {
  advanceWeek,
  checkPlan,
  contactLab,
  dateOf,
  deadlineFor,
  defaultPlan,
  enroll,
  fallbackLabId,
  interview,
  newGame,
  resolveInbox,
  reviewMargin,
  Rng,
  runBot,
  topTierCount,
  type GameState,
} from '../src/index';

function enrolled(seed = 'test'): GameState {
  let s = newGame(pack, { name: '테스트', background: 'cs', startTerm: 3, seed });
  for (const lab of pack.labs) {
    if (s.contacts.length >= 4) break;
    s = contactLab(pack, s, lab.id, { interest: 0, pitch: 0, question: 0 });
    if (s.contacts.at(-1)!.replied) s = interview(pack, s, lab.id, [0, 0, 0]);
    if (s.contacts.some((c) => c.admitted)) break;
  }
  const id = s.contacts.find((c) => c.admitted)?.labId ?? fallbackLabId(pack, s)!;
  return enroll(pack, s, id);
}

describe('rng', () => {
  it('같은 시드는 같은 수열, 상태 저장/복원 가능', () => {
    const a = Rng.fromSeed('x');
    const b = Rng.fromSeed('x');
    expect([a.next(), a.next()]).toEqual([b.next(), b.next()]);
    const saved = a.save();
    const v = a.next();
    expect(Rng.restore(JSON.parse(JSON.stringify(saved))).next()).toBe(v);
  });
});

describe('달력', () => {
  it('3월 입학 기준 주차 → 날짜', () => {
    const s = newGame(pack, { name: 'a', background: 'cs', startTerm: 3, seed: 's' });
    expect(dateOf(s, 0)).toEqual({ year: 2027, month: 3, weekOfMonth: 1 });
    expect(dateOf(s, 4 * 10)).toEqual({ year: 2028, month: 1, weekOfMonth: 1 });
  });
  it('ICCV는 홀수년, ECCV는 짝수년만 열린다', () => {
    const s = newGame(pack, { name: 'a', background: 'cs', startTerm: 3, seed: 's' });
    const iccv = pack.venues.find((v) => v.id === 'iccv')!;
    const eccv = pack.venues.find((v) => v.id === 'eccv')!;
    expect(deadlineFor(s, iccv, 2027)).not.toBeNull();
    expect(deadlineFor(s, iccv, 2028)).toBeNull();
    expect(deadlineFor(s, eccv, 2028)).not.toBeNull();
  });
  it('마감 오프셋은 ±1주 이내', () => {
    const s = newGame(pack, { name: 'a', background: 'cs', startTerm: 3, seed: 'off' });
    const v = pack.venues.find((x) => x.id === 'neurips')!;
    const d = deadlineFor(s, v, 2027)!;
    const nominal = (5 - 3) * 4 + 2; // 2027-05 3주차
    expect(Math.abs(d.week - nominal)).toBeLessThanOrEqual(1);
  });
});

describe('주간 진행', () => {
  it('엔진 액션은 원본 상태를 변경하지 않는다', () => {
    const s = enrolled();
    const snapshot = JSON.stringify(s);
    advanceWeek(pack, s, defaultPlan(s));
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('168시간을 초과하는 계획은 거부된다', () => {
    const s = enrolled();
    const plan = { ...defaultPlan(s), research: 200 };
    expect(checkPlan(pack, s, plan).ok).toBe(false);
    expect(() => advanceWeek(pack, s, plan)).toThrow();
  });

  it('수면 부족은 체력을 깎고, 충분한 수면은 회복시킨다', () => {
    const s = enrolled();
    const low = advanceWeek(pack, s, { ...defaultPlan(s), sleepPerDay: 4, research: 20, study: 0, rest: 0 });
    const high = advanceWeek(pack, s, { ...defaultPlan(s), sleepPerDay: 8, research: 20, study: 0, rest: 10 });
    expect(low.stats.stamina).toBeLessThan(s.stats.stamina);
    expect(high.stats.stamina).toBeGreaterThan(low.stats.stamina);
  });

  it('같은 시드 + 같은 선택 = 같은 결과 (재현성)', () => {
    const a = runBot(pack, 'replay', 'diligent');
    const b = runBot(pack, 'replay', 'diligent');
    expect(a.state.ending).toEqual(b.state.ending);
    expect(a.state.log).toEqual(b.state.log);
  });
});

describe('번아웃 → 휴학', () => {
  it('스트레스 100이 6주 지속되면 휴학을 권유하고, 휴학 시 4주가 지나며 회복된다', () => {
    const s = enrolled('burnout');
    s.stats.stress = 100;
    s.hidden.maxStressWeeks = 5;
    let g = s;
    // 이벤트가 먼저 끼어들 수 있으므로 최대 몇 주 진행
    for (let i = 0; i < 3 && !g.inbox.some((x) => x.kind === 'leave'); i++) {
      while (g.inbox.length) g = resolveInbox(pack, g, 0);
      g.stats.stress = 100;
      g = advanceWeek(pack, g, { ...defaultPlan(g), sleepPerDay: 4, research: 40, study: 0, rest: 0 });
    }
    expect(g.inbox[0]?.kind).toBe('leave');
    const week = g.week;
    const after = resolveInbox(pack, g, 0);
    expect(after.week).toBe(week + 4);
    expect(after.stats.stress).toBe(30);
    expect(after.hidden.leaveTaken).toBe(1);
  });
});

describe('심사', () => {
  it('완성도가 높을수록 심사 마진이 크다', () => {
    const s = enrolled();
    const v = pack.venues.find((x) => x.id === 'neurips')!;
    const paper = { quality: 60, field: 'llm', rebuttalBonus: 0 } as never;
    const better = { quality: 80, field: 'llm', rebuttalBonus: 0 } as never;
    expect(reviewMargin(s, better, v)).toBeGreaterThan(reviewMargin(s, paper, v));
  });
});

describe('밸런스 시뮬레이션 (몬테카를로, 기획안 12장 기준)', () => {
  const N = 150;
  const report: Record<string, { graduationRate: number; topTierRate: number; avgScore: number }> = {};
  for (const strat of ['diligent', 'allnighter', 'balanced'] as const) {
    let graduated = 0;
    let topTier = 0;
    let scoreSum = 0;
    for (let i = 0; i < N; i++) {
      const { state } = runBot(pack, `${strat}-${i}`, strat);
      expect(state.phase).toBe('ended');
      expect(Number.isFinite(state.ending!.score)).toBe(true);
      if (state.ending!.careerId) graduated++;
      if (topTierCount(pack, state) > 0) topTier++;
      scoreSum += state.ending!.score;
    }
    report[strat] = { graduationRate: graduated / N, topTierRate: topTier / N, avgScore: Math.round(scoreSum / N) };
  }
  console.log(JSON.stringify(report));

  it('모든 회차가 엔딩에 도달한다 (무한 루프·NaN 없음)', () => expect(Object.keys(report)).toHaveLength(3));
  it('성실형·워라밸형은 대부분 졸업한다', () => {
    expect(report.diligent!.graduationRate).toBeGreaterThan(0.85);
    expect(report.balanced!.graduationRate).toBeGreaterThan(0.85);
  });
  it('A+/S 1저자 확률은 석사 기간 중 대략 10~45% (목표 20~30%)', () => {
    for (const s of ['diligent', 'balanced'] as const) {
      expect(report[s]!.topTierRate).toBeGreaterThan(0.1);
      expect(report[s]!.topTierRate).toBeLessThan(0.45);
    }
  });
  it('밤샘형은 위험하다: 졸업률·점수 모두 워라밸형보다 낮다 (웰빙 보너스)', () => {
    expect(report.allnighter!.graduationRate).toBeLessThan(report.balanced!.graduationRate);
    expect(report.allnighter!.avgScore).toBeLessThan(report.balanced!.avgScore);
  });
});
