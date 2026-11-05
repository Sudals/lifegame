import type { Contact, ContactOption, ContentPack, Lab } from '@grad-sim/content';
import { eventText, pushEvent, rollEvent } from './events';
import { runActivities } from './activities';
import { doBorrow, doBuy, doRepay, monthlyInterest, suggestedLoan } from './economy';
import { activeFlags, applyFlagWeekly, expireFlags, flagMonthly, hasFlag } from './flags';
import { applyChoice, borrowMoney, RELATIONSHIP_FLAG, turnOffFlag, turnOnFlag } from './outcome';
import {
  addEventPaper,
  createThesis,
  discardIdeas,
  experimentFailChoices,
  exploreIdeas,
  log,
  pickTopic,
  progressResearch,
  resolveExperimentFail,
} from './research';
import { attendCost, findVenue, queueRebuttals, rebuttalChoices, resolveRebuttal, resolveReviews, submitPaper } from './review';
import { hashString, Rng } from './rng';
import { acceptedCount, careerOffers, computeEnding } from './scoring';
import { applyEffects, checkPlan, counselingOption, getLab, normalizePlan } from './stats';
import { fillTemplate } from './text';
import {
  clamp,
  clone,
  GAME_VERSION,
  PLAN_DEFAULTS,
  type Background,
  type GameState,
  type InboxItem,
  type StartTerm,
  type WeeklyPlan,
} from './state';
import { dateOf, formatDate, isMonthStart, isSemesterEnd, masterDeadlineWeek, ongoingConferences, semesterIndex, upcomingDeadlines } from './time';

export const MAX_CONTACTS = 4;

const BACKGROUND_STATS: Record<Background, { research: number; label: string }> = {
  cs: { research: 30, label: '컴퓨터공학' },
  math: { research: 27, label: '수학' },
  ee: { research: 25, label: '전자공학' },
  other: { research: 16, label: '비전공' },
};

export function backgroundLabel(b: Background): string {
  return BACKGROUND_STATS[b].label;
}

export interface NewGameOptions {
  name: string;
  background: Background;
  startTerm: StartTerm;
  seed?: string;
  startYear?: number;
}

export function newGame(pack: ContentPack, opts: NewGameOptions): GameState {
  const seed = opts.seed?.trim() || `${Date.now().toString(36)}`;
  const rng = Rng.fromSeed(seed);
  const state: GameState = {
    version: GAME_VERSION,
    seed,
    rngState: {},
    major: pack.major,
    phase: 'contact',
    player: { name: opts.name.trim() || '김석사', background: opts.background },
    startYear: opts.startYear ?? 2027,
    startMonth: opts.startTerm,
    week: 0,
    stats: { research: BACKGROUND_STATS[opts.background].research, stress: 20, stamina: 80, luck: rng.int(20, 80), money: pack.balance.startMoney },
    hidden: {
      trust: 50,
      relation: 50,
      network: 5,
      sleepDebt: 0,
      highStressWeeks: 0,
      maxStressWeeks: 0,
      leaveTaken: 0,
      lastCounselingAlert: -99,
      stressSum: 0,
      sleepSum: 0,
      affection: 0,
      grantsWon: 0,
      lastMoneyAlert: -99,
    },
    labId: null,
    contacts: [],
    credits: 0,
    semesterDeadlineWeek: masterDeadlineWeek(pack),
    extended: false,
    papers: [],
    ideaCandidates: null,
    exploredWeek: -1,
    attendedConference: null,
    inbox: [],
    firedEvents: [],
    log: [],
    lastPlan: null,
    nextId: 1,
    ending: null,
    flags: {},
    scheduled: [],
    debt: 0,
    purchases: {},
    activityLast: {},
    logMark: 0,
  };
  state.rngState = rng.save();
  log(state, `${state.player.name}, ${state.startYear}년 ${state.startMonth}월 입학을 목표로 연구실 컨택을 시작한다.`, 'info');
  return state;
}

/** 엔진의 모든 공개 액션: 상태를 복제 → 변경 → RNG 상태 저장 (원본 불변) */
function act(state: GameState, fn: (s: GameState, rng: Rng) => void): GameState {
  const s = clone(state);
  const rng = Rng.restore(s.rngState);
  fn(s, rng);
  s.rngState = rng.save();
  return s;
}

// ───────────────────────── 컨택 & 면접 ─────────────────────────

/** 메일 초안: 항목 id → 선택지 번호 (content/contact.json). 빠진 항목은 0번 */
export type MailDraft = Record<string, number>;

function optionValue(o: ContactOption | undefined, state: GameState, lab: Lab): number {
  if (!o) return 0;
  return o.value + (o.research ?? 0) * state.stats.research + (o.industry ?? 0) * (lab.industry - 3);
}

export function contactProbability(pack: ContentPack, state: GameState, labId: string, mail: MailDraft): number {
  const lab = getLab(pack, labId);
  if (!lab) return 0;
  const parts = pack.contact.mail.reduce((sum, part) => sum + optionValue(part.options[mail[part.id] ?? 0], state, lab), 0);
  return clamp(0.5 + parts - lab.admissionCut / 200, 0.05, 0.95);
}

/** 답장 없는 연구실에 한 번 보내는 리마인드 메일 */
export function followUpProbability(pack: ContentPack, state: GameState, labId: string): number {
  const lab = getLab(pack, labId);
  if (!lab) return 0;
  const f = pack.contact.followUp;
  return clamp(f.base + f.luck * state.stats.luck + f.research * state.stats.research - f.cut * lab.admissionCut, 0.03, f.max);
}

export function followUp(pack: ContentPack, state: GameState, labId: string): GameState {
  return act(state, (s, rng) => {
    const c = s.contacts.find((x) => x.labId === labId);
    const lab = getLab(pack, labId);
    if (s.phase !== 'contact' || !c || !lab || c.replied || c.followedUp) throw new Error('리마인드 메일을 보낼 수 없습니다.');
    c.followedUp = true;
    c.replied = rng.chance(followUpProbability(pack, s, labId));
    log(
      s,
      c.replied ? `"메일을 늦게 봤네요, 미안해요." ${lab.professor}님이 면접을 보자고 하신다!` : `리마인드 메일에도 ${lab.professor}님은 답이 없다. 인연이 아닌가 보다.`,
      c.replied ? 'good' : 'bad',
    );
  });
}

export function contactLab(pack: ContentPack, state: GameState, labId: string, mail: MailDraft): GameState {
  return act(state, (s, rng) => {
    if (s.phase !== 'contact') throw new Error('컨택 기간이 아닙니다.');
    if (s.contacts.some((c) => c.labId === labId)) throw new Error('이미 컨택한 연구실입니다.');
    if (s.contacts.length >= MAX_CONTACTS) throw new Error('컨택 기회를 모두 사용했습니다.');
    const lab = getLab(pack, labId);
    if (!lab) throw new Error('없는 연구실입니다.');
    const replied = rng.chance(contactProbability(pack, s, labId, mail));
    s.contacts.push({ labId, replied, interviewed: false, admitted: false });
    log(s, replied ? `${lab.professor}님에게서 답장이 왔다! 면접을 보자고 하신다.` : `${lab.professor}님에게서 답장이 없다... (읽음 표시도 없다)`, replied ? 'good' : 'bad');
  });
}

/** 연구실마다 면접 질문 3개: 분야 질문 1개(있으면) + 공통 질문. 같은 회차·연구실이면 항상 같다 */
export function interviewQuestions(pack: ContentPack, state: GameState, labId: string): Contact['interview'] {
  const lab = getLab(pack, labId);
  const pool = pack.contact.interview;
  const h = (k: string) => hashString(`${state.seed}:${labId}:${k}`);
  const byHash = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => h(a.id) - h(b.id));
  const fieldQs = byHash(pool.filter((q) => q.fields?.some((f) => lab?.fields.includes(f))));
  const general = byHash(pool.filter((q) => !q.fields));
  const picked = [...fieldQs.slice(0, 1), ...general].slice(0, 3);
  // 첫 질문은 늘 "어떤 연구를 하고 싶나요?" 류가 자연스럽다
  return picked.sort((a, b) => (a.id === 'plan' ? -1 : b.id === 'plan' ? 1 : 0));
}

export function interview(pack: ContentPack, state: GameState, labId: string, answers: number[]): GameState {
  return act(state, (s, rng) => {
    const c = s.contacts.find((x) => x.labId === labId);
    const lab = getLab(pack, labId);
    if (!c || !lab || !c.replied || c.interviewed) throw new Error('면접 대상이 아닙니다.');
    const answerScore = interviewQuestions(pack, s, labId).reduce((sum, q, i) => sum + optionValue(q.options[answers[i] ?? -1], s, lab), 0);
    const score = s.stats.research + answerScore + s.stats.luck / 10 + rng.normal(0, 6);
    c.interviewed = true;
    c.admitted = score >= lab.admissionCut;
    log(s, c.admitted ? `${lab.name} 합격! 🎉` : `${lab.name} 불합격... 다른 연구실을 알아보자.`, c.admitted ? 'good' : 'bad');
  });
}

/** 컨택 기회를 다 쓰고도 합격이 없으면: 추가 모집(입학 커트 최저 연구실) */
export function fallbackLabId(pack: ContentPack, state: GameState): string | null {
  const exhausted = state.contacts.length >= MAX_CONTACTS && state.contacts.every((c) => !c.replied || c.interviewed);
  if (!exhausted || state.contacts.some((c) => c.admitted)) return null;
  return [...pack.labs].sort((a, b) => a.admissionCut - b.admissionCut)[0]!.id;
}

export function enroll(pack: ContentPack, state: GameState, labId: string): GameState {
  return act(state, (s) => {
    const ok = s.contacts.some((c) => c.labId === labId && c.admitted) || fallbackLabId(pack, s) === labId;
    if (!ok || s.phase !== 'contact') throw new Error('입학할 수 없는 연구실입니다.');
    const lab = getLab(pack, labId)!;
    s.labId = labId;
    s.phase = 'semester';
    s.logMark = s.log.length; // 컨택 기간 로그는 무대 대사로 다시 보여주지 않는다
    log(s, `${formatDate(dateOf(s, 0))}, ${lab.name}(${lab.professor})에 입학했다. 대학원 생활 시작!`, 'good');
  });
}

// ───────────────────────── 주간 진행 ─────────────────────────

/** 학회 참석은 12주에 한 번 (시간·예산 제약) */
export const CONFERENCE_COOLDOWN_WEEKS = 12;
export function canAttendConference(state: GameState): boolean {
  return !state.attendedConference || state.week - state.attendedConference.week >= CONFERENCE_COOLDOWN_WEEKS;
}

export function defaultPlan(state: GameState): WeeklyPlan {
  return state.lastPlan
    ? { ...PLAN_DEFAULTS, ...state.lastPlan, attendConferenceId: null, counseling: false }
    : { ...PLAN_DEFAULTS, sleepPerDay: 7, research: 30, study: 10, rest: 10, focusPaperId: null, counseling: false, attendConferenceId: null };
}

export function advanceWeek(pack: ContentPack, state: GameState, rawPlan: WeeklyPlan): GameState {
  const plan = normalizePlan(pack, rawPlan);
  if (state.phase !== 'semester') throw new Error('학기 중이 아닙니다.');
  if (state.inbox.length > 0) throw new Error('먼저 처리할 일이 있습니다.');
  const check = checkPlan(pack, state, plan);
  if (!check.ok) throw new Error(check.errors.join(' '));

  return act(state, (s, rng) => {
    const b = pack.balance;
    const lab = getLab(pack, s.labId)!;
    const st = s.stats;
    const h = s.hidden;
    const { forced } = check;
    s.logMark = s.log.length; // 이번 주 진행부터의 로그만 무대 대사로

    // 학회 참석
    if (plan.attendConferenceId) {
      const conf = ongoingConferences(pack, s).find((d) => d.venueId === plan.attendConferenceId);
      const v = pack.venues.find((x) => x.id === plan.attendConferenceId);
      if (conf && v && canAttendConference(s)) {
        const cost = attendCost(pack, s, v.id);
        const presenting = cost === 0;
        applyEffects(s, { money: -cost, research: 1.5, network: presenting ? 8 : 4, stamina: -4, stress: v.abroad ? -8 : -3 });
        s.attendedConference = { venueId: v.id, week: s.week };
        log(s, `${v.displayName} 참석${presenting ? ' (발표, 연구실 지원)' : ''}. 세상은 넓고 똑똑한 사람은 많다.`, 'good');
      }
    }

    // 체력 · 수면
    const sleep = plan.sleepPerDay;
    h.sleepDebt = Math.max(0, h.sleepDebt + (6 - sleep) * 7);
    const jobHours = plan.activities.reduce((a, id) => a + (pack.activities.find((x) => x.id === id && x.category === 'money')?.hours ?? 0), 0);
    const workload = plan.research + plan.study + forced.class + forced.project + forced.chores + jobHours;
    let dStamina = (sleep - 6) * b.staminaPerSleepHourOver6 + plan.rest * b.staminaPerRestHour;
    dStamina -= Math.max(0, workload - b.overworkThreshold) * b.staminaPerOverworkHour;
    if (h.sleepDebt > 20) dStamina -= 3;

    // 스트레스 (데드라인 3주 이내 + 작성 중이면 압박)
    const writing = s.papers.some((p) => p.stage === 'writing' && p.kind === 'paper');
    const deadlinePressure = writing && upcomingDeadlines(pack, s, 3).length > 0 ? b.stressDeadline : 0;
    const sleepStress = sleep < 6 ? (6 - sleep) * b.stressPerSleepDeficitHour : -(sleep - 6) * b.stressReliefPerSleepHourOver6;
    let dStress =
      b.stressPerWeek +
      deadlinePressure +
      sleepStress +
      forced.chores * b.stressPerChoreHour +
      (5 - lab.humanity) * b.stressPerMissingHumanity -
      plan.rest * b.stressReliefPerRestHour;
    if (st.money < 0) dStress += 5;
    // 식비: 고른 수준만큼 매주 나가고, 먹는 만큼 몸과 기분이 달라진다
    const food = b.foodLevels[plan.food]!;
    st.money -= food.cost;
    dStamina += food.stamina;
    dStress += food.stress;
    if (lab.style === 'micro') dStress += 1.5;
    const counsel = plan.counseling ? counselingOption(pack, plan.counselingId) : null;
    if (counsel) {
      // 잠을 못 자면 상담만으로는 회복이 더디다
      dStress += (counsel.effects.stress ?? 0) * (sleep < b.counselingMinSleep ? b.counselingPoorSleepFactor : 1);
      st.money -= counsel.cost;
    }

    // 생활시간(식사·이동)을 줄이면 체력·스트레스, 늘리면 여유
    const living = forced.living - b.livingHoursPerWeek;
    if (living < 0) {
      dStamina += living * b.skipMealStamina;
      dStress -= living * b.skipMealStress;
    } else dStress -= living * 0.1;

    // 과제·잡무를 덜/더 하면 신뢰·관계 변화
    const pr = plan.projectRatio;
    if (forced.projectBase > 0) {
      if (pr < 1) h.trust = clamp(h.trust - (1 - pr) * b.projectTrustPenalty, 0, 100);
      else if (pr > 1) h.trust = clamp(h.trust + (pr - 1) * b.projectTrustBonus, 0, 100);
    }
    if (forced.choresBase > 0 && plan.choreRatio < 1) {
      h.relation = clamp(h.relation - (1 - plan.choreRatio) * b.choreRelationPenalty, 0, 100);
      h.trust = clamp(h.trust - (1 - plan.choreRatio) * 1.5, 0, 100);
    }

    // 연구력 (수확 체감은 applyEffects에서 적용)
    const labMeeting = lab.track * b.labMeetingPerTrackStar;
    const dResearch = plan.study * b.researchPerStudyHour + plan.research * b.researchPerResearchHour + labMeeting + forced.project * 0.004;

    applyEffects(s, { stamina: dStamina, stress: dStress, research: dResearch });
    if (counsel) {
      const { stress: _stress, ...rest } = counsel.effects;
      applyEffects(s, rest);
      log(s, `[${counsel.name}] ${counsel.result}${counsel.cost ? ` (-${counsel.cost.toLocaleString()}원)` : ''}`, 'good');
    }
    applyFlagWeekly(pack, s);
    runActivities(pack, s, plan.activities, rng);
    updateRelationship(pack, s);
    if (plan.research > 0) h.trust = clamp(h.trust + 0.3, 0, 100);
    else h.trust = clamp(h.trust - 1.5, 0, 100);

    // 연구 진척
    progressResearch(pack, s, plan, rng);

    // 월급날 (매달 1주차, 한 달에 한 번)
    if (isMonthStart(s.week)) {
      const m = dateOf(s, s.week).month;
      const salary = lab.salary;
      const stipend = lab.projectLoad * b.projectStipendPerStar;
      const extras = flagMonthly(pack, s);
      const extraSum = extras.reduce((a, x) => a + x.amount, 0);
      const interest = monthlyInterest(pack, s);
      const net = salary + stipend + extraSum - b.livingCostPerMonth - interest;
      st.money += net;
      const parts = [
        `인건비 ${salary.toLocaleString()}`,
        `기본 과제수당 ${stipend.toLocaleString()}`,
        ...extras.map((x) => `${x.name} ${x.amount > 0 ? '+' : ''}${x.amount.toLocaleString()}`),
        `월세·공과금 -${b.livingCostPerMonth.toLocaleString()}`,
        ...(interest ? [`대출 이자 -${interest.toLocaleString()}`] : []),
      ];
      log(s, `💰 ${m}월 월급날: ${parts.join(' · ')} → ${net >= 0 ? '+' : ''}${net.toLocaleString()}원`, net >= 0 ? 'info' : 'bad');
    }
    // 등록금 (학기 시작 주) — 연구실 장학 비율만큼 면제
    if (s.week % 24 === 0) {
      const due = Math.round((b.tuitionPerSemester * (1 - lab.tuitionCover)) / 10000) * 10000;
      const sem = semesterIndex(s.week) + 1;
      if (due > 0) {
        st.money -= due;
        log(s, `🎓 ${sem}학기 등록금 ${b.tuitionPerSemester.toLocaleString()}원 중 장학 ${Math.round(lab.tuitionCover * 100)}% — 본인 부담 ${due.toLocaleString()}원 납부.`, 'bad');
      } else log(s, `🎓 ${sem}학기 등록금은 연구실 장학으로 전액 면제됐다.`, 'good');
    }

    // 잔고가 마이너스면 학자금 대출 안내 (거절해도 상점·은행 탭에서 언제든)
    if (st.money < 0 && s.week - h.lastMoneyAlert >= b.moneyAlertWeeks) {
      const amount = suggestedLoan(pack, s);
      if (amount > 0) {
        h.lastMoneyAlert = s.week;
        s.inbox.push({ kind: 'loan', amount });
      }
    }

    // 심사
    queueRebuttals(pack, s, rng);
    resolveReviews(pack, s, rng);

    // 학점
    if (isSemesterEnd(s.week + 1) && forced.class > 0) {
      s.credits = Math.min(b.requiredCredits, s.credits + b.creditsPerSemester);
      log(s, `학기 종료. 이수 학점 ${s.credits}/${b.requiredCredits}`, 'info');
    }

    // 체력 0 → 입원
    if (st.stamina <= 0) {
      st.stamina = 35;
      applyEffects(s, { money: -300000, stress: 5, trust: -3 });
      s.inbox.push({ kind: 'notice', title: '과로로 쓰러졌다', text: '응급실에서 수액을 맞았다. 의사 선생님이 "잠 좀 주무세요"라고 했다. (진료비 30만 원)' });
    }

    // 멘탈 — 도움 받기는 항상 좋은 선택으로 설계
    h.highStressWeeks = st.stress >= b.counselingAlertStress ? h.highStressWeeks + 1 : 0;
    h.maxStressWeeks = st.stress >= 100 ? h.maxStressWeeks + 1 : 0;
    if (h.highStressWeeks >= b.counselingAlertWeeks && s.week - h.lastCounselingAlert >= 8) {
      h.lastCounselingAlert = s.week;
      pushEvent(pack, s, 'counseling-alert', rng);
    }

    h.stressSum += st.stress;
    h.sleepSum += sleep;
    s.lastPlan = { ...plan };

    rollEvent(pack, s, rng);

    // 다음 주로
    s.week += 1;
    for (const name of expireFlags(pack, s)) log(s, `「${name}」 기간이 끝났다.`, 'info');
    if (s.week >= s.semesterDeadlineWeek - 16) createThesis(s);
    if (h.maxStressWeeks >= b.dropoutStressWeeks) {
      // 번아웃 한계: 첫 번째는 휴학 권유, 휴학 후 재발 시 중도 포기
      h.maxStressWeeks = 0;
      if (h.leaveTaken >= MAX_LEAVES) {
        log(s, '몸과 마음이 더는 버티지 못했다. 학교를 떠나기로 했다.', 'bad');
        finish(pack, s, null);
        return;
      }
      s.inbox.unshift({ kind: 'leave' });
    }
    if (s.week >= s.semesterDeadlineWeek) graduationReview(pack, s);
  });
}

/** 연애: 애정도는 매주 조금씩 줄고, 데이트·선물로 채운다. 바닥나면 이별 */
function updateRelationship(pack: ContentPack, s: GameState): void {
  if (!hasFlag(s, RELATIONSHIP_FLAG)) return;
  const b = pack.balance;
  const h = s.hidden;
  h.affection = clamp(h.affection - b.affectionDecay, 0, 100);
  if (h.affection >= b.affectionHigh) applyEffects(s, { stress: -1.5 });
  else if (h.affection <= b.affectionLow) applyEffects(s, { stress: 1 });
  if (h.affection <= 0) {
    turnOffFlag(s, RELATIONSHIP_FLAG);
    applyEffects(s, { stress: 12 });
    log(s, '💔 연락이 점점 뜸해지더니... "우리 그만하자." 연애가 끝났다.', 'bad');
  }
}

export const LEAVE_WEEKS = 4;
export const SICK_LEAVE_WEEKS = 2;
export const MAX_LEAVES = 2;

/** 휴학(한 달) / 병가(2주): 시간은 흐르고 월급은 없지만 몸과 마음이 회복된다 */
function takeLeave(pack: ContentPack, s: GameState, weeks = LEAVE_WEEKS): void {
  const b = pack.balance;
  const from = s.week;
  const full = weeks >= LEAVE_WEEKS;
  s.week += weeks;
  s.hidden.leaveTaken += 1;
  s.stats.stress = full ? b.leaveStress : b.sickLeaveStress;
  s.stats.stamina = full ? b.leaveStamina : b.sickLeaveStamina;
  s.hidden.sleepDebt = 0;
  s.stats.money -= Math.round((b.livingCostPerMonth * weeks) / LEAVE_WEEKS);
  // 휴학 중 발표된 심사 결과는 복학 주에 확인
  for (const p of s.papers) if (p.stage === 'review' && p.resultWeek !== undefined && p.resultWeek < s.week) p.resultWeek = s.week;
  for (let w = from; w < s.week; w++) {
    s.hidden.stressSum += 40;
    s.hidden.sleepSum += 8;
    // 한 달 병가는 학기를 포기하지 않는다: 그 사이 학기가 끝나면 학점 인정
    if (isSemesterEnd(w + 1) && s.credits < pack.balance.requiredCredits) {
      s.credits = Math.min(pack.balance.requiredCredits, s.credits + pack.balance.creditsPerSemester);
    }
  }
  if (s.week >= s.semesterDeadlineWeek - 16) createThesis(s);
  log(s, full ? '한 달간 휴학했다. 늦잠과 산책, 그리고 엄마 밥. 다시 해볼 힘이 생겼다.' : '2주 병가를 냈다. 휴대폰을 끄고 잠만 잤다. 조금 살 것 같다.', 'good');
}

export interface GraduationCheck {
  credits: boolean;
  thesis: boolean;
  paper: boolean;
}

export function graduationStatus(pack: ContentPack, state: GameState): GraduationCheck {
  return {
    credits: state.credits >= pack.balance.requiredCredits,
    thesis: state.papers.some((p) => p.kind === 'thesis' && p.stage === 'accepted'),
    paper: acceptedCount(state) >= 1,
  };
}

function graduationReview(pack: ContentPack, s: GameState): void {
  const g = graduationStatus(pack, s);
  if (g.credits && g.thesis && g.paper) {
    s.stats.money -= pack.balance.thesisFee;
    log(s, `학위논문 심사비 ${pack.balance.thesisFee.toLocaleString()}원을 냈다.`, 'info');
    s.phase = 'career';
    s.inbox = [];
    log(s, '🎓 학위 심사 통과! 이제 진로를 선택하자.', 'good');
  } else if (!s.extended) {
    s.extended = true;
    s.semesterDeadlineWeek += 24;
    s.inbox.push({
      kind: 'notice',
      title: '졸업 연기',
      text: `졸업 요건 미충족 (학점 ${g.credits ? '✓' : '✗'} / 학위논문 ${g.thesis ? '✓' : '✗'} / 논문 게재 ${g.paper ? '✓' : '✗'}). 한 학기 연장된다.`,
    });
    log(s, '졸업이 한 학기 연기되었다.', 'bad');
  } else {
    log(s, '연장 학기에도 졸업 요건을 채우지 못했다. 수료로 마무리한다.', 'bad');
    finish(pack, s, null);
  }
}

function finish(pack: ContentPack, s: GameState, careerId: string | null): void {
  s.phase = 'ended';
  s.inbox = [];
  s.ending = computeEnding(pack, s, careerId);
}

export function chooseCareer(pack: ContentPack, state: GameState, careerId: string): GameState {
  return act(state, (s) => {
    if (s.phase !== 'career') throw new Error('진로 선택 단계가 아닙니다.');
    if (!careerOffers(pack, s).some((c) => c.id === careerId)) throw new Error('받지 못한 오퍼입니다.');
    finish(pack, s, careerId);
    log(s, `진로 결정: ${s.ending!.title}`, 'good');
  });
}

// ───────────────────────── 연구 액션 래퍼 ─────────────────────────

export const explore = (pack: ContentPack, state: GameState, sourceId: string) => act(state, (s, rng) => exploreIdeas(pack, s, sourceId, rng));
export const chooseTopic = (pack: ContentPack, state: GameState, topicId: string) => act(state, (s, rng) => void pickTopic(pack, s, topicId, rng));
export const dropIdeas = (state: GameState) => act(state, (s) => discardIdeas(s));
export const submit = (pack: ContentPack, state: GameState, paperId: string, venueId: string) =>
  act(state, (s, rng) => submitPaper(pack, s, paperId, venueId, rng));

// ───────────────────────── 인박스(이벤트·판정) ─────────────────────────

export interface InboxView {
  title: string;
  speaker?: string;
  text: string;
  choices: { label: string; hint?: string; disabled?: boolean }[];
}

export function describeInbox(pack: ContentPack, state: GameState, item: InboxItem): InboxView {
  switch (item.kind) {
    case 'event': {
      const e = pack.events.find((x) => x.id === item.eventId)!;
      const v = item.vars;
      return {
        title: fillTemplate(e.title, v),
        speaker: e.speaker,
        text: fillTemplate(eventText(pack, item), v),
        choices: e.choices.map((c) => {
          const cost = c.requireMoney ?? (c.effects.money && c.effects.money < 0 ? -c.effects.money : 0);
          const disabled = c.requireMoney !== undefined && state.stats.money < c.requireMoney;
          const tags = [
            c.hint ? fillTemplate(c.hint, v) : '',
            cost > 0 ? `-${cost.toLocaleString()}원` : c.effects.money && c.effects.money > 0 ? `+${c.effects.money.toLocaleString()}원` : '',
            c.outcomes.length ? '결과는 운에 따라' : '',
            ...c.setFlags.map((f) => {
              const def = pack.flags.find((x) => x.id === f.id);
              return def && !def.hidden ? `「${def.name}」${f.weeks ? ` ${f.weeks}주` : ''}` : '';
            }),
          ].filter(Boolean);
          return { label: fillTemplate(c.label, v), hint: disabled ? `잔고 부족 (${c.requireMoney!.toLocaleString()}원 필요)` : tags.join(' · ') || undefined, disabled };
        }),
      };
    }
    case 'rebuttal': {
      const p = state.papers.find((x) => x.id === item.paperId)!;
      const v = p.venueId ? findVenue(pack, p.venueId) : null;
      return {
        title: `리버탈 — ${v?.displayName ?? ''}`,
        text: `「${p.title}」 예비 리뷰 점수: ${item.scores.map((x, i) => `R${i + 1} ${x}`).join(' · ')}. Reviewer 2는 "novelty가 부족하다"고 한다.`,
        choices: rebuttalChoices(),
      };
    }
    case 'experiment-fail': {
      const p = state.papers.find((x) => x.id === item.paperId)!;
      return { title: '실험 실패', text: `「${p.title}」 베이스라인을 못 넘었다. 어떻게 할까?`, choices: experimentFailChoices() };
    }
    case 'notice':
      return { title: item.title, text: item.text, choices: [{ label: '확인' }] };
    case 'loan':
      return {
        title: '잔고 부족',
        speaker: '학자금 대출 안내',
        text: `통장 잔고가 ${state.stats.money.toLocaleString()}원이다. 마이너스 잔고는 스트레스를 키운다. 학자금 대출(연 ${(pack.balance.loanAnnualRate * 100).toFixed(1)}%)을 받을까? 졸업할 때 남은 대출은 순자산에서 빠진다.`,
        choices: [
          { label: `${item.amount.toLocaleString()}원 대출받는다`, hint: `대출 잔액 ${(state.debt + item.amount).toLocaleString()}원 / 한도 ${pack.balance.loanLimit.toLocaleString()}원` },
          { label: '알바·대회로 메워본다', hint: '활동 탭의 알바·대회 · 상점·은행 탭에서 언제든 대출 가능' },
        ],
      };
    case 'leave':
      return {
        title: '번아웃',
        speaker: '학생상담센터',
        text: '몇 주째 한계 상태예요. 잠시 멈추는 것도 용기예요. 휴학이나 병가로 회복하고 돌아오는 건 어떨까요?',
        choices: [
          { label: '한 달 휴학한다', hint: `스트레스·체력 크게 회복, ${LEAVE_WEEKS}주 경과, 월급 없음` },
          { label: '2주 병가를 낸다', hint: `절반쯤 회복, ${SICK_LEAVE_WEEKS}주 경과 · 휴학 횟수에 포함` },
          { label: '교수님과 면담해 업무를 줄인다', hint: '스트레스↓ · 6주간 업무 조정(주 4시간 면제) · 교수 신뢰↓' },
          { label: '그래도 버틴다', hint: '스트레스 소폭↓ — 다시 한계에 오면 휴학을 권유받는다' },
          { label: '학교를 그만둔다', hint: '중도 포기 엔딩' },
        ],
      };
  }
}

export function resolveInbox(pack: ContentPack, state: GameState, choice: number): GameState {
  return act(state, (s, rng) => {
    const item = s.inbox.shift();
    if (!item) return;
    switch (item.kind) {
      case 'event': {
        const e = pack.events.find((x) => x.id === item.eventId)!;
        const affordable = (i: number) => {
          const ch = e.choices[i];
          return !!ch && (ch.requireMoney === undefined || s.stats.money >= ch.requireMoney);
        };
        // 잔고가 부족한 선택지는 고를 수 없음 → 가능한 첫 선택지로
        const idx = affordable(choice) ? choice : e.choices.findIndex((_, i) => affordable(i));
        const c = e.choices[idx < 0 ? e.choices.length - 1 : idx]!;
        const { result, tone } = applyChoice(pack, s, c, rng);
        if (c.addPaper) addEventPaper(s, c.addPaper);
        log(s, `[${fillTemplate(e.title, item.vars)}] ${fillTemplate(result, item.vars)}`, tone);
        break;
      }
      case 'rebuttal':
        resolveRebuttal(s, item.paperId, choice);
        break;
      case 'experiment-fail':
        resolveExperimentFail(s, item.paperId, choice);
        break;
      case 'notice':
        break;
      case 'loan':
        if (choice === 0) {
          const got = borrowMoney(pack, s, item.amount);
          log(s, `🏦 학자금 대출 ${got.toLocaleString()}원을 받았다. (잔액 ${s.debt.toLocaleString()}원)`, 'info');
        } else log(s, '대출 없이 버텨보기로 했다. 알바 공고를 뒤적인다.', 'info');
        break;
      case 'leave':
        if (choice === 0 || choice === 1) {
          takeLeave(pack, s, choice === 0 ? LEAVE_WEEKS : SICK_LEAVE_WEEKS);
          if (s.week >= s.semesterDeadlineWeek) graduationReview(pack, s);
        } else if (choice === 2) {
          applyEffects(s, { stress: -20, trust: -3 });
          turnOnFlag(pack, s, 'light-duty', 6);
          log(s, '"그동안 많이 무리했네요." 6주간 과제와 잡무를 줄여주시기로 했다.', 'good');
        } else if (choice === 3) {
          applyEffects(s, { stress: -10 });
          log(s, '이를 악물었다. 주간 플래너에서 상담과 휴식을 꼭 챙기자.', 'info');
        } else {
          log(s, '대학원을 떠나기로 했다. 새로운 길도 길이다.', 'info');
          finish(pack, s, null);
        }
        break;
    }
  });
}

// ───────────────────────── 상점 · 은행 ─────────────────────────

export const buy = (pack: ContentPack, state: GameState, itemId: string) => act(state, (s, rng) => doBuy(pack, s, itemId, rng));
export const borrow = (pack: ContentPack, state: GameState, amount: number) => act(state, (s) => doBorrow(pack, s, amount));
export const repay = (pack: ContentPack, state: GameState, amount: number) => act(state, (s) => doRepay(pack, s, amount));

export { careerOffers, activeFlags, hasFlag };
