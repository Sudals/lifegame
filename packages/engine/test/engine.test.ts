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
  paperScore,
  resolveInbox,
  reviewMargin,
  Rng,
  runBot,
  submitTargets,
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
  it('NMI는 가장 어려운 저널이고, 채택되면 다른 S 저널보다 점수가 높다', () => {
    const s = enrolled();
    expect(submitTargets(pack, s).some((t) => t.venueId === 'nmi' && t.kind === 'journal')).toBe(true);
    const nmi = pack.journals.find((j) => j.id === 'nmi')!;
    expect(Math.max(...pack.journals.map((j) => j.cut))).toBe(nmi.cut);
    const accepted = (venueId: string) => ({ stage: 'accepted', kind: 'paper', venueId, venueKind: 'journal', authorOrder: 1 }) as never;
    expect(paperScore(pack, accepted('nmi'))).toBeGreaterThan(paperScore(pack, accepted('tpami')));
    expect(topTierCount(pack, { papers: [accepted('nmi')] } as never)).toBe(1);
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

// ───────────── v0.2: 월급·동시 작업·시간 배분·분기·돈 이벤트 ─────────────
import { describeInbox, eventVars, fillTemplate, flagMonthly, hasFlag, migrate, PLAN_DEFAULTS, weeklyMonologue, type WeeklyPlan } from '../src/index';

const plan = (s: GameState, p: Partial<WeeklyPlan> = {}): WeeklyPlan => ({ ...defaultPlan(s), ...p });
const clearInbox = (s: GameState) => {
  while (s.inbox.length) s = resolveInbox(pack, s, 1);
  return s;
};

describe('월급', () => {
  it('월급은 4주(한 달)에 한 번만 들어온다', () => {
    let s = enrolled('payday');
    for (let w = 0; w < 12; w++) s = advanceWeek(pack, clearInbox(s), plan(s));
    const pays = s.log.filter((l) => l.text.includes('월급날'));
    expect(pays.map((l) => l.week)).toEqual([0, 4, 8]);
    expect(pays[0]!.text).toMatch(/3월 월급날/);
  });
  it('아무 일 없던 주에는 상황 독백이 나온다 (지난 월급 문구를 반복하지 않음)', () => {
    const s = enrolled('mono');
    const m = weeklyMonologue(pack, s);
    expect(m.text.length).toBeGreaterThan(5);
    expect(m.text).not.toMatch(/월급/);
  });
});

describe('두 작업 동시 진행 (연구력 70+)', () => {
  function twoPapers(research: number) {
    let s = enrolled('dual');
    s = clearInbox(s);
    s.stats.research = research;
    s.papers.push(
      { id: 'a', topicId: 'llm-eval', title: 'A', field: 'llm', kind: 'paper', stage: 'experiment', progress: 0, quality: 30, authorOrder: 1, checkpoints: 2, reviews: [], crunchWeeks: 0 },
      { id: 'b', topicId: 'rec-fair', title: 'B', field: 'recsys', kind: 'paper', stage: 'experiment', progress: 0, quality: 30, authorOrder: 1, checkpoints: 2, reviews: [], crunchWeeks: 0 },
    );
    return advanceWeek(pack, s, plan(s, { focusPaperId: 'a', secondFocusPaperId: 'b', research: 40, study: 0, rest: 0 }));
  }
  it('연구력 70 이상이면 두 논문이 함께 진척된다', () => {
    const s = twoPapers(75);
    expect(s.papers.find((p) => p.id === 'a')!.progress).toBeGreaterThan(0);
    expect(s.papers.find((p) => p.id === 'b')!.progress).toBeGreaterThan(0);
  });
  it('연구력 70 미만이면 첫 번째 작업만 진행된다', () => {
    const s = twoPapers(50);
    expect(s.papers.find((p) => p.id === 'a')!.progress).toBeGreaterThan(0);
    expect(s.papers.find((p) => p.id === 'b')!.progress).toBe(0);
  });
});

describe('시간 배분 조정', () => {
  it('생활시간을 줄이면 배분 가능 시간이 늘고 체력이 깎인다', () => {
    const s = clearInbox(enrolled('living'));
    const base = checkPlan(pack, s, plan(s, { living: 28 }));
    const tight = checkPlan(pack, s, plan(s, { living: 14 }));
    expect(tight.freeHours - base.freeHours).toBe(14);
    const a = advanceWeek(pack, s, plan(s, { living: 28, research: 20, study: 0, rest: 10 }));
    const b = advanceWeek(pack, s, plan(s, { living: 14, research: 20, study: 0, rest: 10 }));
    expect(b.stats.stamina).toBeLessThan(a.stats.stamina);
  });
  it('과제를 덜 하면 교수 신뢰가 떨어진다', () => {
    const s = clearInbox(enrolled('project'));
    const full = advanceWeek(pack, s, plan(s, { projectRatio: 1 }));
    const half = advanceWeek(pack, s, plan(s, { projectRatio: 0.5 }));
    expect(half.hidden.trust).toBeLessThan(full.hidden.trust);
  });
  it('범위를 벗어난 값은 보정된다', () => {
    const s = clearInbox(enrolled('clamp'));
    const c = checkPlan(pack, s, plan(s, { living: 0, projectRatio: 9 }));
    expect(c.forced.living).toBe(pack.balance.livingMin);
    expect(c.forced.project).toBe(Math.round(c.forced.projectBase * pack.balance.projectRatioMax));
  });
});

describe('분기·돈 이벤트', () => {
  it('선택이 후속 이벤트를 예약하고, 그 주가 되면 등장한다', () => {
    let s = clearInbox(enrolled('branch'));
    s.inbox.push({ kind: 'event', eventId: 'dentist', variant: 0, vars: {} });
    s = resolveInbox(pack, s, 1); // 마감 끝나고 간다 → 충치 방치 + 6주 뒤 악화
    expect(hasFlag(s, 'toothache')).toBe(true);
    expect(s.scheduled.some((x) => x.eventId === 'dentist-worse')).toBe(true);
    let seen = false;
    for (let w = 0; w < 8 && !seen; w++) {
      s = advanceWeek(pack, s, plan(s));
      seen = s.inbox.some((i) => i.kind === 'event' && i.eventId === 'dentist-worse');
      if (!seen) s = clearInbox(s);
    }
    expect(seen).toBe(true);
  });
  it('잔고가 부족한 선택지는 고를 수 없다 (가능한 선택지로 대체)', () => {
    let s = clearInbox(enrolled('broke'));
    s.stats.money = 1000;
    s.inbox.push({ kind: 'event', eventId: 'laptop-broken', variant: 0, vars: {} });
    const view = describeInbox(pack, s, s.inbox[0]!);
    expect(view.choices[0]!.disabled).toBe(true);
    s = resolveInbox(pack, s, 0);
    expect(s.stats.money).toBe(1000); // 150만 원 노트북을 사지 않았다
    expect(hasFlag(s, 'new-gear')).toBe(false);
  });
  it('조교 플래그는 매달 수입과 주당 시간을 만든다', () => {
    const s = clearInbox(enrolled('ta'));
    s.flags.ta = s.week + 10;
    expect(flagMonthly(pack, s)).toEqual([{ name: '학부 조교', amount: 400000 }]);
    expect(checkPlan(pack, s, plan(s)).extraHours).toBeGreaterThanOrEqual(6);
  });
  it('모든 이벤트 문장·선택지·결과에 치환되지 않은 변수가 없다', () => {
    const s = clearInbox(enrolled('tmpl'));
    const vars = eventVars(pack, s, Rng.fromSeed('v'));
    for (const e of pack.events) {
      const texts = [e.title, e.text, ...e.variants, ...e.choices.flatMap((c) => [c.label, c.result, ...c.outcomes.map((o) => o.result)])];
      for (const t of texts) expect(fillTemplate(t, vars), `${e.id}: ${t}`).not.toMatch(/[{}]/);
    }
  });
  it('이전 버전 세이브를 마이그레이션한다', () => {
    const old = clearInbox(enrolled('old')) as unknown as Record<string, unknown>;
    delete old.flags;
    delete old.scheduled;
    const m = migrate(old as unknown as GameState);
    expect(m.flags).toEqual({});
    expect(m.scheduled).toEqual([]);
    expect(advanceWeek(pack, m, { ...PLAN_DEFAULTS, ...defaultPlan(m) }).week).toBe(m.week + 1);
  });
});
