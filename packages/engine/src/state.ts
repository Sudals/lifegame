import type { RngState } from './rng';

export const GAME_VERSION = '0.1.0';

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
}

export interface InboxChoice {
  label: string;
  hint?: string;
}

export type InboxItem =
  | { kind: 'event'; eventId: string }
  | { kind: 'rebuttal'; paperId: string; scores: number[] }
  | { kind: 'experiment-fail'; paperId: string }
  | { kind: 'counseling' }
  | { kind: 'leave' }
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
}

export interface WeeklyPlan {
  sleepPerDay: number; // 4~10
  research: number; // 주당 시간
  study: number;
  rest: number;
  focusPaperId: string | null;
  counseling: boolean;
  attendConferenceId: string | null; // 개최 중 학회 참석
}

export type Phase = 'contact' | 'semester' | 'career' | 'ended';

export interface Ending {
  careerId: string | null; // null = 중도 포기/수료
  title: string;
  score: number;
  breakdown: Record<string, number>;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  epithet: string;
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
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
