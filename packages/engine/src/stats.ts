import type { ContentPack, Effects, GpuGrade, Lab } from '@grad-sim/content';
import { inSemester } from './time';
import { clamp, type GameState, type WeeklyPlan } from './state';

export const GPU_RANK: Record<GpuGrade, number> = { A: 4, B: 3, C: 2, D: 1 };
export const CONFERENCE_HOURS = 20;

export function getLab(pack: ContentPack, id: string | null): Lab | null {
  if (!id) return null;
  return pack.labs.find((l) => l.id === id) ?? null;
}

export function applyEffects(state: GameState, fx: Effects): void {
  const s = state.stats;
  const h = state.hidden;
  // 연구력 상승은 수확 체감 (높을수록 덜 오른다)
  if (fx.research) s.research = Math.max(0, s.research + (fx.research > 0 ? (fx.research * 100) / (100 + s.research) : fx.research));
  if (fx.stress) s.stress = clamp(s.stress + fx.stress, 0, 100);
  if (fx.stamina) s.stamina = clamp(s.stamina + fx.stamina, 0, 100);
  if (fx.money) s.money = Math.round(s.money + fx.money);
  if (fx.luck) s.luck = clamp(s.luck + fx.luck, 0, 100);
  if (fx.trust) h.trust = clamp(h.trust + fx.trust, 0, 100);
  if (fx.relation) h.relation = clamp(h.relation + fx.relation, 0, 100);
  if (fx.network) h.network = clamp(h.network + fx.network, 0, 100);
}

export interface ForcedHours {
  living: number;
  class: number;
  project: number;
  chores: number;
}

export function forcedHours(pack: ContentPack, state: GameState): ForcedHours {
  const b = pack.balance;
  const lab = getLab(pack, state.labId);
  return {
    living: b.livingHoursPerWeek,
    class: inSemester(state.week) && state.credits < b.requiredCredits ? b.classHoursPerWeek : 0,
    project: lab ? lab.projectLoad * b.projectHoursPerStar : 0,
    chores: lab ? lab.chores * b.baseChoreHoursPerStar : 0,
  };
}

export interface PlanCheck {
  ok: boolean;
  forced: ForcedHours;
  sleepHours: number;
  extraHours: number; // 상담·학회
  freeHours: number; // 연구/공부/휴식에 배분 가능한 시간
  allocated: number;
  errors: string[];
}

export function checkPlan(pack: ContentPack, state: GameState, plan: WeeklyPlan): PlanCheck {
  const forced = forcedHours(pack, state);
  const sleepHours = Math.round(plan.sleepPerDay * 7);
  const extraHours = (plan.counseling ? pack.balance.counselingHours : 0) + (plan.attendConferenceId ? CONFERENCE_HOURS : 0);
  const fixed = forced.living + forced.class + forced.project + forced.chores + sleepHours + extraHours;
  const freeHours = 168 - fixed;
  const allocated = plan.research + plan.study + plan.rest;
  const errors: string[] = [];
  if (plan.sleepPerDay < 4 || plan.sleepPerDay > 10) errors.push('수면은 하루 4~10시간 사이로 설정하세요.');
  if ([plan.research, plan.study, plan.rest].some((v) => v < 0 || !Number.isFinite(v))) errors.push('시간은 0 이상이어야 합니다.');
  if (allocated > freeHours) errors.push(`배분 가능한 시간(${freeHours}h)을 ${allocated - freeHours}h 초과했습니다.`);
  return { ok: errors.length === 0, forced, sleepHours, extraHours, freeHours, allocated, errors };
}

/** 체력·스트레스·수면 부채에 따른 시간당 효율 */
export function efficiency(pack: ContentPack, state: GameState): number {
  const s = state.stats;
  let eff = 0.5 + (0.5 * s.stamina) / 100;
  if (s.stress >= pack.balance.burnoutStress) eff *= 0.6;
  else if (s.stress >= 70) eff *= 0.85;
  if (state.hidden.sleepDebt > 20) eff *= 0.9;
  return eff;
}

export function mentalState(pack: ContentPack, state: GameState): '정상' | '피로' | '번아웃' {
  if (state.stats.stress >= pack.balance.burnoutStress) return '번아웃';
  if (state.stats.stress >= 70 || state.stats.stamina < 30) return '피로';
  return '정상';
}
