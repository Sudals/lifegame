import type { ContentPack, GameEvent } from '@grad-sim/content';
import type { Rng } from './rng';
import { getLab } from './stats';
import type { GameState } from './state';
import { dateOf } from './time';

export function eventEligible(pack: ContentPack, state: GameState, e: GameEvent): boolean {
  if (e.once && state.firedEvents.includes(e.id)) return false;
  const w = e.when;
  const s = state.stats;
  const lab = getLab(pack, state.labId);
  if (w.months && !w.months.includes(dateOf(state, state.week).month)) return false;
  if (w.minStress !== undefined && s.stress < w.minStress) return false;
  if (w.maxStress !== undefined && s.stress > w.maxStress) return false;
  if (w.maxStamina !== undefined && s.stamina > w.maxStamina) return false;
  if (w.minMoney !== undefined && s.money < w.minMoney) return false;
  if (w.maxMoney !== undefined && s.money > w.maxMoney) return false;
  if (w.minWeek !== undefined && state.week < w.minWeek) return false;
  if (w.labIds && (!lab || !w.labIds.includes(lab.id))) return false;
  if (w.minHumanity !== undefined && (!lab || lab.humanity < w.minHumanity)) return false;
  if (w.maxHumanity !== undefined && (!lab || lab.humanity > w.maxHumanity)) return false;
  if (w.hasPaperStage && !state.papers.some((p) => p.stage === w.hasPaperStage)) return false;
  // 같은 이벤트가 너무 자주 반복되지 않도록 최근 6개 제외
  if (state.firedEvents.slice(-6).includes(e.id)) return false;
  return true;
}

/** 조건 기반 트리거 + 가중치 랜덤. 주당 최대 1개. */
export function rollEvent(pack: ContentPack, state: GameState, rng: Rng): void {
  if (!rng.chance(pack.balance.eventChancePerWeek)) return;
  const pool = pack.events.filter((e) => eventEligible(pack, state, e));
  if (pool.length === 0) return;
  const e = rng.weighted(pool, (x) => x.weight);
  state.firedEvents.push(e.id);
  state.inbox.push({ kind: 'event', eventId: e.id });
}
