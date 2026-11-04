import type { ContentPack, Venue } from '@grad-sim/content';
import { hashString } from './rng';
import type { GameState } from './state';

export interface GameDate {
  year: number;
  month: number;
  weekOfMonth: number; // 1~4
}

const WPM = 4;

export function dateOf(state: Pick<GameState, 'startYear' | 'startMonth'>, week: number): GameDate {
  const monthsElapsed = Math.floor(week / WPM);
  const m0 = state.startMonth - 1 + monthsElapsed;
  return { year: state.startYear + Math.floor(m0 / 12), month: (m0 % 12) + 1, weekOfMonth: (week % WPM) + 1 };
}

export function weekOf(state: Pick<GameState, 'startYear' | 'startMonth'>, year: number, month: number, weekOfMonth: number): number {
  return ((year - state.startYear) * 12 + (month - state.startMonth)) * WPM + (weekOfMonth - 1);
}

export function formatDate(d: GameDate): string {
  return `${d.year}년 ${d.month}월 ${d.weekOfMonth}주차`;
}

/** 입학 후 6개월 블록 = 학기(4개월) + 방학(2개월) */
export function semesterIndex(week: number): number {
  return Math.floor(week / 24);
}

export function inSemester(week: number): boolean {
  return week % 24 < 16;
}

export function isSemesterEnd(week: number): boolean {
  return week % 24 === 16;
}

export function isMonthStart(week: number): boolean {
  return week % WPM === 0;
}

/** 석사 졸업 심사 주차 = 마지막 학기 종료 시점 */
export function masterDeadlineWeek(pack: ContentPack): number {
  return (pack.balance.masterSemesters - 1) * 24 + 16;
}

function venueRunsInYear(v: Venue, year: number): boolean {
  if (v.years === 'odd') return year % 2 === 1;
  if (v.years === 'even') return year % 2 === 0;
  return true;
}

export interface Deadline {
  venueId: string;
  year: number;
  week: number; // 마감 주차
  resultWeek: number;
  heldWeek: number; // 개최 시작 주차
}

/** 실제 연도마다 수 주씩 변동 → 시드 기반 ±1주 결정적 오프셋 */
export function deadlineFor(state: GameState, v: Venue, year: number): Deadline | null {
  if (!venueRunsInYear(v, year)) return null;
  const offset = (hashString(`${state.seed}:${v.id}:${year}`) % 3) - 1;
  const week = weekOf(state, year, v.deadline.month, v.deadline.week) + offset;
  const heldYear = v.heldMonth < v.deadline.month ? year + 1 : year;
  return {
    venueId: v.id,
    year,
    week,
    resultWeek: week + v.notifyAfterWeeks,
    heldWeek: weekOf(state, heldYear, v.heldMonth, 1),
  };
}

export function upcomingDeadlines(pack: ContentPack, state: GameState, horizonWeeks = 52): Deadline[] {
  const { year } = dateOf(state, state.week);
  const out: Deadline[] = [];
  for (const v of pack.venues) {
    for (const y of [year - 1, year, year + 1, year + 2]) {
      const d = deadlineFor(state, v, y);
      if (d && d.week >= state.week && d.week <= state.week + horizonWeeks) out.push(d);
    }
  }
  return out.sort((a, b) => a.week - b.week);
}

/** 현재 주에 개최 중인 학회 (개최월 4주 중) */
export function ongoingConferences(pack: ContentPack, state: GameState): Deadline[] {
  const { year } = dateOf(state, state.week);
  const out: Deadline[] = [];
  for (const v of pack.venues) {
    for (const y of [year - 2, year - 1, year]) {
      const d = deadlineFor(state, v, y);
      if (d && state.week >= d.heldWeek && state.week < d.heldWeek + 4) out.push(d);
    }
  }
  return out;
}
