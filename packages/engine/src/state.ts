import type { RngState } from './rng';

export const GAME_VERSION = '0.3.1';

export type Background = 'cs' | 'math' | 'ee' | 'other';
export type StartTerm = 3 | 9;

export interface Stats {
  research: number; // 0~100+
  stress: number; // 0~100
  stamina: number; // 0~100
  luck: number; // 숨김 0~100
  money: number; // 원
}

export interface Hidden {
  trust: number; // 교수 신뢰도 0~100
  relation: number; // 연구실 관계도 0~100
  network: number; // 네트워크 0~100
  sleepDebt: number; // 누적 시간
  highStressWeeks: number; // 스트레스 경보 이상 연속 주
  maxStressWeeks: number; // 스트레스 100 연속 주
  leaveTaken: number; // 휴학 횟수
  lastCounselingAlert: number; // 마지막 상담 권유 주차
  stressSum: number; // 웰빙 보너스용 누적
  sleepSum: number;
  affection: number; // 연인 애정도 0~100 (연애 중일 때만)
  grantsWon: number; // 수주한 과제 수 (진로 평가)
  lastMoneyAlert: number; // 마지막 잔고 부족 안내 주차
}

export type PaperStage =
  | 'experiment'
  | 'writing'
  | 'ready' // 투고 대기
  | 'review'
  | 'revision' // 저널 Major Revision
  | 'accepted'
  | 'abandoned';

export interface ReviewRecord {
  venueId: string;
  kind: 'conference' | 'journal';
  scores: number[];
  decision: string; // 'oral' | 'spotlight' | 'poster' | 'accept' | 'minor' | 'major' | 'reject'
  week: number;
}

export interface Paper {
  id: string;
  topicId: string;
  title: string;
  field: string;
  kind: 'paper' | 'thesis';
  stage: PaperStage;
  progress: number; // 현 단계 진척도 0~100
  quality: number; // 논문 완성도
  authorOrder: 1 | 2 | 3;
  checkpoints: number; // 실험 중간 판정 횟수
  venueId?: string;
  venueKind?: 'conference' | 'journal';
  submittedWeek?: number;
  resultWeek?: number;
  rebuttalDone?: boolean;
  rebuttalBonus?: number;
  presentation?: string; // 채택 시 'oral' | 'spotlight' | 'poster' | 'journal'
  acceptedWeek?: number;
  reviews: ReviewRecord[];
  crunchWeeks: number;
  /** 이벤트로 생긴 공동연구 등 주제 카드가 없는 논문의 예상 기간 */
  weeks?: number;
}

export interface InboxChoice {
  label: string;
  hint?: string;
}

export type InboxItem =
  | { kind: 'event'; eventId: string; variant?: number; vars?: Record<string, string> }
  | { kind: 'rebuttal'; paperId: string; scores: number[] }
  | { kind: 'experiment-fail'; paperId: string }
  | { kind: 'leave' }
  | { kind: 'loan'; amount: number }
  | { kind: 'notice'; title: string; text: string };

export interface LogEntry {
  week: number;
  text: string;
  tone?: 'good' | 'bad' | 'info';
}

export interface ContactRecord {
  labId: string;
  replied: boolean;
  interviewed: boolean;
  admitted: boolean;
  followedUp?: boolean; // 리마인드 메일을 보냈는가
}

export interface WeeklyPlan {
  sleepPerDay: number; // 4~10
  research: number; // 주당 시간
  study: number;
  rest: number;
  focusPaperId: string | null;
  /** 연구력 70 이상: 두 번째 작업 (연구 시간을 split 비율로 나눔) */
  secondFocusPaperId: string | null;
  split: number; // 첫 작업 비중 0.2~0.8
  living: number; // 식사·이동·생활 (주당)
  projectRatio: number; // 과제 시간 배율 0.5~1.5
  choreRatio: number; // 잡무 처리 비율 0~1
  counseling: boolean;
  counselingId: string; // 상담 종류 (content/counseling.json)
  attendConferenceId: string | null; // 개최 중 학회 참석
  food: number; // 식비 수준 0 절약 · 1 보통 · 2 여유
  activities: string[]; // 이번 주 활동 id
}

export type Phase = 'contact' | 'semester' | 'career' | 'ended';

export interface Ending {
  careerId: string | null; // null = 중도 포기/수료
  title: string;
  score: number;
  breakdown: Record<string, number>;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  epithet: string;
  /** 졸업 1년 후 진로 안착 평가 */
  landing?: Landing;
  assets?: { money: number; debt: number; net: number };
}

export interface Landing {
  score: number; // 0~100
  tier: number; // 0 대성공 ~ 4 위기
  label: string;
  story: string;
  notes: { text: string; good: boolean }[];
}

export interface GameState {
  version: string;
  seed: string;
  rngState: RngState;
  major: string;
  phase: Phase;
  player: { name: string; background: Background };
  startYear: number;
  startMonth: StartTerm;
  week: number; // 시작 시점부터 경과 주 (0부터)
  stats: Stats;
  hidden: Hidden;
  labId: string | null;
  contacts: ContactRecord[];
  credits: number;
  semesterDeadlineWeek: number; // 졸업 심사 주차
  extended: boolean;
  papers: Paper[];
  ideaCandidates: { topicIds: string[]; sourceId: string } | null;
  exploredWeek: number; // 아이디어 탐색은 주 1회
  attendedConference: { venueId: string; week: number } | null;
  inbox: InboxItem[];
  firedEvents: string[];
  log: LogEntry[];
  lastPlan: WeeklyPlan | null;
  nextId: number;
  ending: Ending | null;
  /** 상태 플래그: id → 만료 주차 (PERMANENT = 영구) */
  flags: Record<string, number>;
  /** 예약된 후속 이벤트 (분기) */
  scheduled: { eventId: string; week: number }[];
  /** 학자금 대출 잔액 */
  debt: number;
  /** 상점 구매 기록: id → 마지막 구매 주차·그 주 구매 수·누적 */
  purchases: Record<string, { week: number; count: number; total: number }>;
  /** 활동: id → 마지막으로 한 주차 */
  activityLast: Record<string, number>;
  /** 무대 대사로 보여줄 로그 시작 위치 (지난 진행 이후 로그만) */
  logMark: number;
}

export const PERMANENT = 1_000_000;

export const PLAN_DEFAULTS: Pick<WeeklyPlan, 'secondFocusPaperId' | 'split' | 'living' | 'projectRatio' | 'choreRatio' | 'food' | 'activities' | 'counselingId'> = Object.freeze({
  secondFocusPaperId: null,
  split: 0.5,
  living: 28,
  projectRatio: 1,
  choreRatio: 1,
  food: 1,
  activities: Object.freeze([]) as unknown as string[],
  counselingId: 'clinic',
});

/** v0.3에서 이름이 바뀐 id */
const RENAMED_LABS: Record<string, string> = { 'dbi-hanyang': 'dbi' };
const RENAMED_TOPICS: Record<string, string> = { 'dbi-ecommerce': 'dbi-credit', 'dbi-tabnet': 'dbi-medimg', 'dbi-edge': 'dbi-multiexit' };

/** 이전 버전 세이브를 현재 형식으로 */
export function migrate(state: GameState): GameState {
  const s = clone(state);
  s.flags ??= {};
  s.scheduled ??= [];
  s.debt ??= 0;
  s.purchases ??= {};
  s.activityLast ??= {};
  s.logMark ??= s.log.length;
  s.hidden.affection ??= (s.flags.relationship ?? -1) > s.week ? 60 : 0;
  s.hidden.grantsWon ??= 0;
  s.hidden.lastMoneyAlert ??= -99;
  // v0.2 이벤트 대출(플래그) → 학자금 대출 잔액
  if (s.flags.loan !== undefined) {
    if (s.flags.loan > s.week) s.debt += 3_000_000;
    delete s.flags.loan;
  }
  if (s.labId && RENAMED_LABS[s.labId]) s.labId = RENAMED_LABS[s.labId]!;
  for (const c of s.contacts) c.labId = RENAMED_LABS[c.labId] ?? c.labId;
  for (const p of s.papers) p.topicId = RENAMED_TOPICS[p.topicId] ?? p.topicId;
  // v0.3.0: 상담 권유는 이제 선택지가 많은 이벤트
  s.inbox = s.inbox.map((i) => ((i as { kind: string }).kind === 'counseling' ? { kind: 'event', eventId: 'counseling-alert', variant: 0, vars: {} } : i));
  if (s.ideaCandidates) s.ideaCandidates.topicIds = s.ideaCandidates.topicIds.map((t) => RENAMED_TOPICS[t] ?? t);
  if (s.lastPlan) s.lastPlan = { ...PLAN_DEFAULTS, ...s.lastPlan, activities: s.lastPlan.activities ?? [] };
  s.version = GAME_VERSION;
  return s;
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
