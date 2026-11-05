import type { ContentPack, Effects, Outcome } from '@grad-sim/content';
import { clearFlag, hasFlag, setFlag } from './flags';
import type { Rng } from './rng';
import { applyEffects } from './stats';
import { clamp, type GameState } from './state';

/** 연애 상태 플래그 — 애정도 시스템과 연결된다 */
export const RELATIONSHIP_FLAG = 'relationship';

export type Tone = 'good' | 'bad' | 'info';

/** 이벤트 선택지·활동·상점 물건이 공유하는 결과 묶음 */
export interface ChoiceLike {
  effects?: Effects;
  result?: string;
  setFlags?: { id: string; weeks?: number }[];
  clearFlags?: string[];
  schedule?: { eventId: string; weeks: number };
  outcomes?: Outcome[];
  borrow?: number;
}

/** 플래그 켜기 + 부수 효과 (연애 시작 → 애정도, 과제 수주 → 경력) */
export function turnOnFlag(pack: ContentPack, s: GameState, id: string, weeks?: number): void {
  const was = hasFlag(s, id);
  setFlag(s, id, weeks);
  if (was) return;
  if (id === RELATIONSHIP_FLAG) s.hidden.affection = pack.balance.affectionStart;
  if (pack.flags.find((f) => f.id === id)?.grant) s.hidden.grantsWon += 1;
}

export function turnOffFlag(s: GameState, id: string): void {
  clearFlag(s, id);
  if (id === RELATIONSHIP_FLAG) s.hidden.affection = 0;
}

/** 효과 적용. 애정도는 연애 중일 때만 */
export function applyAll(pack: ContentPack, s: GameState, fx: Effects | undefined): void {
  if (!fx) return;
  const { affection, ...rest } = fx;
  applyEffects(s, rest);
  if (affection && hasFlag(s, RELATIONSHIP_FLAG)) s.hidden.affection = clamp(s.hidden.affection + affection, 0, 100);
}

/** 학자금 대출 실행 (한도까지). 실제로 빌린 금액 */
export function borrowMoney(pack: ContentPack, s: GameState, amount: number): number {
  const room = Math.max(0, pack.balance.loanLimit - s.debt);
  const got = Math.min(room, Math.max(0, Math.round(amount)));
  s.debt += got;
  s.stats.money += got;
  return got;
}

function outcomeWeight(s: GameState, o: Outcome): number {
  let w = o.p;
  if (o.luck) w *= s.stats.luck / 50; // 1 = 평균
  if (o.skill) {
    const v = o.skill === 'research' ? s.stats.research : o.skill === 'network' ? s.hidden.network * 2 : s.hidden.trust;
    w *= Math.max(0.2, v / 50);
  }
  return w;
}

/** 선택 결과 적용 → 로그용 결과 문구와 톤 */
export function applyChoice(pack: ContentPack, s: GameState, c: ChoiceLike, rng: Rng): { result: string; tone: Tone } {
  applyAll(pack, s, c.effects);
  for (const f of c.setFlags ?? []) turnOnFlag(pack, s, f.id, f.weeks);
  for (const f of c.clearFlags ?? []) turnOffFlag(s, f);
  if (c.schedule) s.scheduled.push({ eventId: c.schedule.eventId, week: s.week + c.schedule.weeks });
  let result = c.result ?? '';
  let tone: Tone = 'info';
  if (c.borrow) {
    const got = borrowMoney(pack, s, c.borrow);
    if (got < c.borrow) result += got > 0 ? ` (대출 한도 때문에 ${got.toLocaleString()}원만 받았다)` : ' (대출 한도를 다 써서 받지 못했다)';
  }
  if (c.outcomes?.length) {
    const o = rng.weighted(c.outcomes, (x) => outcomeWeight(s, x));
    applyAll(pack, s, o.effects);
    for (const f of o.setFlags) turnOnFlag(pack, s, f.id, f.weeks);
    for (const f of o.clearFlags) turnOffFlag(s, f);
    if (o.schedule) s.scheduled.push({ eventId: o.schedule.eventId, week: s.week + o.schedule.weeks });
    result = [result, o.result].filter(Boolean).join(' ');
    tone = o.tone ?? (o.luck || o.skill ? 'good' : 'bad');
  }
  return { result, tone };
}
