import { describe, expect, it } from 'vitest';
import { aiPack as pack } from '@grad-sim/content';
import {
  advanceWeek,
  borrow,
  contactProbability,
  describeInbox,
  followUp,
  interviewQuestions,
  buy,
  checkPlan,
  chooseCareer,
  computeEnding,
  computeLanding,
  contactLab,
  defaultPlan,
  enroll,
  fallbackLabId,
  hasFlag,
  interview,
  migrate,
  newGame,
  repay,
  resolveInbox,
  shopStatus,
  turnOnFlag,
  type GameState,
  type WeeklyPlan,
} from '../src/index';

function enrolled(seed = 'life'): GameState {
  let s = newGame(pack, { name: '테스트', background: 'cs', startTerm: 3, seed });
  for (const lab of pack.labs) {
    if (s.contacts.length >= 4) break;
    s = contactLab(pack, s, lab.id, { interest: 0, pitch: 0, question: 0 });
    if (s.contacts.at(-1)!.replied) s = interview(pack, s, lab.id, [0, 0, 0]);
    if (s.contacts.some((c) => c.admitted)) break;
  }
  return enroll(pack, s, s.contacts.find((c) => c.admitted)?.labId ?? fallbackLabId(pack, s)!);
}
const clear = (s: GameState) => {
  while (s.inbox.length) s = resolveInbox(pack, s, 1);
  return s;
};
const plan = (s: GameState, p: Partial<WeeklyPlan> = {}): WeeklyPlan => ({ ...defaultPlan(s), research: 20, study: 5, rest: 5, ...p });
const item = (id: string) => pack.shop.find((x) => x.id === id)!;

describe('상점', () => {
  it('사면 돈이 나가고 효과가 바로 적용되며, 주간 한도가 있다', () => {
    let s = clear(enrolled('shop'));
    s.stats.stamina = 50;
    const money = s.stats.money;
    s = buy(pack, s, 'samgyetang');
    expect(s.stats.money).toBe(money - item('samgyetang').price);
    expect(s.stats.stamina).toBe(57);
    expect(shopStatus(pack, s, item('samgyetang')).reason).toBe('이번 주 한도');
    expect(() => buy(pack, s, 'samgyetang')).toThrow();
  });
  it('영양제는 기간 플래그, 장비는 한 번만', () => {
    let s = clear(enrolled('gear'));
    s = buy(pack, buy(pack, s, 'vitamin'), 'monitor');
    expect(hasFlag(s, 'vitamin')).toBe(true);
    expect(s.flags.vitamin).toBe(s.week + 4);
    expect(shopStatus(pack, s, item('monitor')).owned).toBe(true);
    expect(() => buy(pack, s, 'monitor')).toThrow();
  });
  it('선물은 연인이 있을 때만 살 수 있고 애정도를 올린다', () => {
    let s = clear(enrolled('gift'));
    expect(shopStatus(pack, s, item('flowers')).ok).toBe(false);
    turnOnFlag(pack, s, 'relationship');
    expect(s.hidden.affection).toBe(pack.balance.affectionStart);
    s = buy(pack, s, 'flowers');
    expect(s.hidden.affection).toBe(pack.balance.affectionStart + 7);
  });
  it('잔고가 모자라면 살 수 없다', () => {
    const s = clear(enrolled('poor'));
    s.stats.money = 1000;
    expect(shopStatus(pack, s, item('chicken')).reason).toBe('잔고 부족');
  });
});

describe('학자금 대출', () => {
  it('한도 안에서 빌리고, 월급날 이자가 나가며, 갚을 수 있다', () => {
    let s = clear(enrolled('loan'));
    const money = s.stats.money;
    s = borrow(pack, s, 3_000_000);
    expect(s.debt).toBe(3_000_000);
    expect(s.stats.money).toBe(money + 3_000_000);
    expect(() => borrow(pack, s, pack.balance.loanLimit)).toThrow();
    // 다음 월급날(4주 뒤) 이자
    for (let i = 0; i < 5; i++) s = clear(advanceWeek(pack, s, plan(s)));
    const pay = s.log.find((l) => l.week === 4 && l.text.includes('월급날'))!;
    expect(pay.text).toMatch(/대출 이자 -4,250/);
    s = repay(pack, s, 1_000_000);
    expect(s.debt).toBe(2_000_000);
  });
  it('잔고가 마이너스가 되면 대출 안내가 오고, 받으면 잔고가 메워진다', () => {
    let s = clear(enrolled('minus'));
    s = clear(advanceWeek(pack, s, plan(s))); // 월급날(0주차)을 지나서
    s.stats.money = -500_000;
    s = advanceWeek(pack, s, plan(s));
    const i = s.inbox.findIndex((x) => x.kind === 'loan');
    expect(i).toBeGreaterThanOrEqual(0);
    // 대출 안내 앞의 다른 항목은 거절로 처리
    while (s.inbox[0]?.kind !== 'loan') s = resolveInbox(pack, s, 1);
    s = resolveInbox(pack, s, 0);
    expect(s.debt).toBeGreaterThan(0);
    expect(s.stats.money).toBeGreaterThan(0);
  });
  it('졸업 시 순자산(잔고−대출)으로 자산 점수를 매긴다', () => {
    const s = clear(enrolled('asset'));
    s.stats.money = 6_000_000;
    const rich = computeEnding(pack, s, 'company');
    s.debt = 9_000_000;
    const indebted = computeEnding(pack, s, 'company');
    expect(rich.breakdown['자산']).toBe(40);
    expect(indebted.breakdown['자산']).toBe(-20);
    expect(indebted.assets).toEqual({ money: 6_000_000, debt: 9_000_000, net: -3_000_000 });
  });
});

describe('주간 활동 · 식비', () => {
  it('활동은 시간과 돈을 쓰고 효과를 준다', () => {
    const s = clear(enrolled('act'));
    s.stats.stress = 50;
    const base = checkPlan(pack, s, plan(s));
    const withSauna = checkPlan(pack, s, plan(s, { activities: ['sauna'] }));
    expect(base.freeHours - withSauna.freeHours).toBe(3);
    expect(withSauna.activityCost).toBe(12000);
    const a = advanceWeek(pack, s, plan(s));
    const b = advanceWeek(pack, s, plan(s, { activities: ['sauna'] }));
    expect(b.stats.stress).toBeLessThan(a.stats.stress);
    expect(a.stats.money - b.stats.money).toBe(12000);
    expect(b.log.some((l) => l.text.startsWith('[목욕탕·사우나]'))).toBe(true);
  });
  it('알바는 돈을 벌고, 쿨다운 활동은 다시 하려면 기다려야 한다', () => {
    const s = clear(enrolled('job'));
    const a = advanceWeek(pack, s, plan(s));
    const b = advanceWeek(pack, s, plan(s, { activities: ['tutoring', 'survey'] }));
    expect(b.stats.money - a.stats.money).toBe(150000 + 30000);
    expect(checkPlan(pack, clear(b), plan(b, { activities: ['survey'] })).errors[0]).toMatch(/주 후 가능/);
  });
  it('데이트는 연인이 있어야 하고 애정도를 올린다. 방치하면 줄어든다', () => {
    let s = clear(enrolled('date'));
    expect(checkPlan(pack, s, plan(s, { activities: ['date-cafe'] })).ok).toBe(false);
    turnOnFlag(pack, s, 'relationship');
    const start = s.hidden.affection;
    const dated = advanceWeek(pack, s, plan(s, { activities: ['date-cafe'] }));
    const alone = advanceWeek(pack, s, plan(s));
    expect(dated.hidden.affection).toBe(start + 8 - pack.balance.affectionDecay);
    expect(alone.hidden.affection).toBe(start - pack.balance.affectionDecay);
  });
  it('애정도가 바닥나면 이별한다', () => {
    let s = clear(enrolled('breakup'));
    turnOnFlag(pack, s, 'relationship');
    s.hidden.affection = 2;
    s = advanceWeek(pack, s, plan(s));
    expect(hasFlag(s, 'relationship')).toBe(false);
    expect(s.log.some((l) => l.text.includes('연애가 끝났다'))).toBe(true);
  });
  it('식비 수준에 따라 매주 지출과 체력이 달라진다', () => {
    const s = clear(enrolled('food'));
    s.stats.stamina = 60;
    const cheap = advanceWeek(pack, s, plan(s, { food: 0 }));
    const rich = advanceWeek(pack, s, plan(s, { food: 2 }));
    const [lo, , hi] = pack.balance.foodLevels;
    expect(cheap.stats.money - rich.stats.money).toBe(hi!.cost - lo!.cost);
    expect(rich.stats.stamina).toBeGreaterThan(cheap.stats.stamina);
  });
});

describe('과제 수주', () => {
  it('제안서를 쓰면 결과 이벤트가 예약되고, 선정되면 매달 과제 인건비가 들어온다', () => {
    let s = clear(enrolled('grant'));
    s.inbox.push({ kind: 'event', eventId: 'proposal-nrf', variant: 0, vars: {} });
    s = resolveInbox(pack, s, 0);
    expect(hasFlag(s, 'proposal-writing')).toBe(true);
    expect(s.scheduled.some((x) => x.eventId === 'grant-nrf-result-strong')).toBe(true);
    turnOnFlag(pack, s, 'grant-nrf', 48);
    expect(s.hidden.grantsWon).toBe(1);
    for (let i = 0; i < 5; i++) s = clear(advanceWeek(pack, s, plan(s)));
    expect(s.log.find((l) => l.week === 4 && l.text.includes('월급날'))!.text).toMatch(/연구재단 과제 \+300,000/);
  });
});

describe('진로 안착', () => {
  it('졸업 후 진로마다 대학원 생활 지표로 안착도를 평가하고 이야기를 들려준다', () => {
    const s = clear(enrolled('landing'));
    const weak = computeLanding(pack, s, pack.careers.find((c) => c.id === 'research-scientist')!);
    s.stats.research = 95;
    s.hidden.network = 45;
    s.stats.luck = 90;
    s.papers.push({ id: 'x', topicId: 'llm-eval', title: 'X', field: 'llm', kind: 'paper', stage: 'accepted', progress: 100, quality: 90, authorOrder: 1, checkpoints: 3, reviews: [], crunchWeeks: 0, venueId: 'neurips', venueKind: 'conference', presentation: 'oral' });
    s.papers.push({ id: 'y', topicId: 'llm-eval', title: 'Y', field: 'llm', kind: 'paper', stage: 'accepted', progress: 100, quality: 90, authorOrder: 1, checkpoints: 3, reviews: [], crunchWeeks: 0, venueId: 'icml', venueKind: 'conference', presentation: 'poster' });
    const strong = computeLanding(pack, s, pack.careers.find((c) => c.id === 'research-scientist')!);
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.tier).toBeLessThan(weak.tier); // 0 = 대성공
    expect(strong.story).not.toBe(weak.story);
    expect(strong.notes.some((n) => n.good)).toBe(true);
    const e = computeEnding(pack, s, 'research-scientist');
    expect(e.landing?.label).toBe(strong.label);
    expect(e.breakdown['정착']).toBe(Math.round((strong.score - 50) * pack.balance.landingScoreScale));
  });
  it('모든 진로에 5단계 이야기가 있고 엔딩에 실린다', () => {
    for (const c of pack.careers) expect(new Set(c.landing.texts).size).toBe(5);
    let s = clear(enrolled('career'));
    s.phase = 'career';
    s = chooseCareer(pack, s, 'company');
    expect(s.ending?.landing?.story.length).toBeGreaterThan(10);
  });
});

describe('무대 대사 · 세이브', () => {
  it('입학 직후·주간 진행 후 무대에는 그 이후 로그만 나온다 (컨택 기간 로그 중복 없음)', () => {
    const s = enrolled('mark');
    const fresh = s.log.slice(s.logMark);
    expect(fresh).toHaveLength(1);
    expect(fresh[0]!.text).toMatch(/입학했다/);
    const next = advanceWeek(pack, clear(s), plan(s));
    expect(next.log.slice(next.logMark).some((l) => /입학했다|컨택/.test(l.text))).toBe(false);
  });
  it('v0.2 세이브: DBI 연구실 id와 이벤트 대출을 새 형식으로 옮긴다', () => {
    const old = clear(enrolled('v02')) as unknown as Record<string, unknown> & GameState;
    old.version = '0.2.0';
    old.labId = 'dbi-hanyang';
    old.flags = { loan: old.week + 1_000_000 };
    for (const k of ['debt', 'purchases', 'activityLast', 'logMark'] as const) delete (old as Partial<GameState>)[k];
    delete (old.hidden as Partial<GameState['hidden']>).affection;
    old.papers.push({ id: 'z', topicId: 'dbi-ecommerce', title: 'Z', field: 'recsys', kind: 'paper', stage: 'experiment', progress: 0, quality: 30, authorOrder: 1, checkpoints: 0, reviews: [], crunchWeeks: 0 });
    const m = migrate(old);
    expect(m.labId).toBe('dbi');
    expect(m.debt).toBe(3_000_000);
    expect(m.flags.loan).toBeUndefined();
    expect(m.papers.at(-1)!.topicId).toBe('dbi-credit');
    expect(m.hidden.affection).toBe(0);
    expect(advanceWeek(pack, m, plan(m)).week).toBe(m.week + 1);
  });
});

describe('컨택 · 면접 선택지', () => {
  const fresh = () => newGame(pack, { name: '컨택', background: 'cs', startTerm: 3, seed: 'contact-x' });
  it('메일 5개 항목 모두 답장 확률에 영향을 준다', () => {
    const s = fresh();
    const best = Object.fromEntries(pack.contact.mail.map((p) => [p.id, 0]));
    const worst = Object.fromEntries(pack.contact.mail.map((p) => [p.id, p.options.length - 1]));
    expect(pack.contact.mail.length).toBe(5);
    expect(contactProbability(pack, s, 'vision-park', best)).toBeGreaterThan(contactProbability(pack, s, 'vision-park', worst) + 0.4);
    // 확률이 0.05~0.95로 잘리지 않는 무난한 초안에서 항목 하나씩 바꿔본다
    const mid = { subject: 1, interest: 3, pitch: 3, question: 1, timing: 1 };
    for (const part of pack.contact.mail) {
      const good = contactProbability(pack, s, 'theory-yoon', { ...mid, [part.id]: 0 });
      const bad = contactProbability(pack, s, 'theory-yoon', { ...mid, [part.id]: part.options.length - 1 });
      expect(good).toBeGreaterThan(bad);
    }
  });
  it('산학 경험 어필은 산학 등급이 높은 연구실에서 더 통한다', () => {
    const s = fresh();
    const i = pack.contact.mail.find((p) => p.id === 'pitch')!.options.findIndex((o) => o.industry);
    const mid = { subject: 1, interest: 3, question: 1, timing: 1 };
    const lift = (lab: string) => contactProbability(pack, s, lab, { ...mid, pitch: i }) - contactProbability(pack, s, lab, { ...mid, pitch: 4 });
    expect(lift('ind-han')).toBeGreaterThan(lift('theory-yoon'));
  });
  it('면접 질문은 연구실 분야에 맞춰 3개, 같은 회차면 항상 같다', () => {
    const s = fresh();
    for (const lab of pack.labs) {
      const qs = interviewQuestions(pack, s, lab.id);
      expect(new Set(qs.map((q) => q.id)).size).toBe(3);
      expect(qs.filter((q) => q.fields?.some((f) => lab.fields.includes(f)))).toHaveLength(1);
      expect(interviewQuestions(pack, s, lab.id).map((q) => q.id)).toEqual(qs.map((q) => q.id));
    }
    expect(interviewQuestions(pack, s, 'theory-yoon').some((q) => q.id === 'generalize')).toBe(true);
  });
  it('답장이 없으면 리마인드 메일을 한 번 보낼 수 있다 (컨택 기회는 그대로)', () => {
    let s = fresh();
    let lab = '';
    for (const l of pack.labs) {
      s = contactLab(pack, s, l.id, Object.fromEntries(pack.contact.mail.map((p) => [p.id, p.options.length - 1])));
      if (!s.contacts.at(-1)!.replied) {
        lab = l.id;
        break;
      }
    }
    expect(lab).not.toBe('');
    const used = s.contacts.length;
    s = followUp(pack, s, lab);
    expect(s.contacts.find((c) => c.labId === lab)!.followedUp).toBe(true);
    expect(s.contacts.length).toBe(used);
    expect(() => followUp(pack, s, lab)).toThrow();
  });
});

describe('상담 선택지', () => {
  it('플래너에서 상담 종류를 고르면 시간·비용·효과가 달라진다', () => {
    const s = clear(enrolled('counsel-type'));
    s.stats.stress = 70;
    const run = (id: string) => advanceWeek(pack, s, plan(s, { counseling: true, counselingId: id }));
    const none = advanceWeek(pack, s, plan(s));
    expect(checkPlan(pack, s, plan(s, { counseling: true, counselingId: 'online' })).extraHours).toBe(1);
    expect(none.stats.money - run('campus').stats.money).toBe(0);
    expect(none.stats.money - run('private').stats.money).toBe(90000);
    expect(run('private').stats.stress).toBeLessThan(run('online').stats.stress);
    expect(run('campus').log.some((l) => l.text.startsWith('[학생상담센터]'))).toBe(true);
  });
  it('스트레스가 계속 높으면 7가지 선택지가 있는 상담 권유가 온다', () => {
    let s = clear(enrolled('counsel-alert'));
    for (let i = 0; i < 8 && !s.inbox.some((x) => x.kind === 'event' && x.eventId === 'counseling-alert'); i++) {
      s.stats.stress = 95;
      s = advanceWeek(pack, s, plan(s));
      if (!s.inbox.some((x) => x.kind === 'event' && x.eventId === 'counseling-alert')) s = clear(s);
    }
    const item = s.inbox.find((x) => x.kind === 'event' && x.eventId === 'counseling-alert')!;
    expect(item).toBeDefined();
    expect(describeInbox(pack, s, item).choices.length).toBeGreaterThanOrEqual(7);
  });
  it('정기 상담을 시작하면 8주 뒤 종결 면담이 예약된다', () => {
    let s = clear(enrolled('therapy'));
    s.stats.money = 1_000_000;
    s.inbox.push({ kind: 'event', eventId: 'counseling-alert', variant: 0, vars: {} });
    s = resolveInbox(pack, s, 2);
    expect(hasFlag(s, 'therapy')).toBe(true);
    expect(s.scheduled.some((x) => x.eventId === 'therapy-review' && x.week === s.week + 8)).toBe(true);
  });
  it('번아웃: 2주 병가, 업무 조정(주 4시간 면제)도 고를 수 있다', () => {
    const s = clear(enrolled('burnout-x'));
    s.inbox.push({ kind: 'leave' });
    expect(describeInbox(pack, s, s.inbox[0]!).choices).toHaveLength(5);
    const sick = resolveInbox(pack, s, 1);
    expect(sick.week).toBe(s.week + 2);
    expect(sick.stats.stress).toBe(pack.balance.sickLeaveStress);
    const light = resolveInbox(pack, s, 2);
    expect(light.week).toBe(s.week);
    expect(hasFlag(light, 'light-duty')).toBe(true);
    expect(checkPlan(pack, light, plan(light)).freeHours - checkPlan(pack, s, plan(s)).freeHours).toBe(4);
  });
  it('v0.3.0 세이브의 상담 알림은 새 상담 이벤트로 바뀐다', () => {
    const old = clear(enrolled('v030')) as GameState;
    old.version = '0.3.0';
    (old.inbox as unknown[]).push({ kind: 'counseling' });
    const m = migrate(old);
    expect(m.inbox[0]).toMatchObject({ kind: 'event', eventId: 'counseling-alert' });
  });
});
