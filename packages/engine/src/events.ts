import type { ContentPack, GameEvent } from '@grad-sim/content';
import { hasFlag } from './flags';
import type { Rng } from './rng';
import { acceptedCount } from './scoring';
import { getLab } from './stats';
import type { GameState } from './state';
import { eventVars } from './text';
import { dateOf, inSemester } from './time';

export function eventEligible(pack: ContentPack, state: GameState, e: GameEvent, scheduled = false): boolean {
  if (e.once && state.firedEvents.includes(e.id)) return false;
  const w = e.when;
  const s = state.stats;
  const lab = getLab(pack, state.labId);
  if (w.flags && !w.flags.every((f) => hasFlag(state, f))) return false;
  if (w.notFlags && w.notFlags.some((f) => hasFlag(state, f))) return false;
  if (w.anyFlags && !w.anyFlags.some((f) => hasFlag(state, f))) return false;
  if (scheduled) return true; // 예약된 후속 이벤트는 플래그 조건만 확인
  if (w.months && !w.months.includes(dateOf(state, state.week).month)) return false;
  if (w.minStress !== undefined && s.stress < w.minStress) return false;
  if (w.maxStress !== undefined && s.stress > w.maxStress) return false;
  if (w.maxStamina !== undefined && s.stamina > w.maxStamina) return false;
  if (w.minMoney !== undefined && s.money < w.minMoney) return false;
  if (w.maxMoney !== undefined && s.money > w.maxMoney) return false;
  if (w.minWeek !== undefined && state.week < w.minWeek) return false;
  if (w.minResearch !== undefined && s.research < w.minResearch) return false;
  if (w.maxResearch !== undefined && s.research > w.maxResearch) return false;
  if (w.minTrust !== undefined && state.hidden.trust < w.minTrust) return false;
  if (w.maxTrust !== undefined && state.hidden.trust > w.maxTrust) return false;
  if (w.minAccepted !== undefined && acceptedCount(state) < w.minAccepted) return false;
  if (w.semester !== undefined && inSemester(state.week) !== w.semester) return false;
  if (w.labIds && (!lab || !w.labIds.includes(lab.id))) return false;
  if (w.minHumanity !== undefined && (!lab || lab.humanity < w.minHumanity)) return false;
  if (w.maxHumanity !== undefined && (!lab || lab.humanity > w.maxHumanity)) return false;
  if (w.hasPaperStage && !state.papers.some((p) => p.stage === w.hasPaperStage)) return false;
  if (w.minIndustry !== undefined && (!lab || lab.industry < w.minIndustry)) return false;
  if (w.maxAffection !== undefined && state.hidden.affection > w.maxAffection) return false;
  // 같은 이벤트가 너무 자주 반복되지 않도록 최근 8개 제외
  if (state.firedEvents.slice(-8).includes(e.id)) return false;
  return true;
}

function fire(pack: ContentPack, state: GameState, e: GameEvent, rng: Rng): void {
  const variants = [e.text, ...e.variants];
  state.firedEvents.push(e.id);
  if (state.firedEvents.length > 120) state.firedEvents.splice(0, state.firedEvents.length - 120);
  state.inbox.push({ kind: 'event', eventId: e.id, variant: rng.int(0, variants.length - 1), vars: eventVars(pack, state, rng) });
}

/** 엔진이 직접 띄우는 이벤트 (상담 권유 등) */
export function pushEvent(pack: ContentPack, state: GameState, eventId: string, rng: Rng): void {
  const e = pack.events.find((x) => x.id === eventId);
  if (!e) throw new Error(`없는 이벤트: ${eventId}`);
  fire(pack, state, e, rng);
}

/** 예약 이벤트(분기 후속) 먼저, 그다음 조건 기반 랜덤 이벤트 (주당 최대 1개) */
export function rollEvent(pack: ContentPack, state: GameState, rng: Rng): void {
  const due = state.scheduled.filter((x) => x.week <= state.week);
  state.scheduled = state.scheduled.filter((x) => x.week > state.week);
  for (const d of due) {
    const e = pack.events.find((x) => x.id === d.eventId);
    if (e && eventEligible(pack, state, e, true)) fire(pack, state, e, rng);
  }
  if (due.length) return;
  if (!rng.chance(pack.balance.eventChancePerWeek)) return;
  const pool = pack.events.filter((e) => e.random && eventEligible(pack, state, e));
  if (pool.length === 0) return;
  fire(pack, state, rng.weighted(pool, (x) => x.weight), rng);
}

export function eventText(pack: ContentPack, item: { eventId: string; variant?: number }): string {
  const e = pack.events.find((x) => x.id === item.eventId)!;
  const variants = [e.text, ...e.variants];
  return variants[Math.min(item.variant ?? 0, variants.length - 1)]!;
}
