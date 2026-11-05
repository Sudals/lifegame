import type { ContentPack, CounselingOption, Effects, GpuGrade, Lab } from '@grad-sim/content';
import { inSemester } from './time';
import { flagEfficiency, flagHours } from './flags';
import { activityStatus } from './activities';
import { clamp, PLAN_DEFAULTS, type GameState, type WeeklyPlan } from './state';

export const GPU_RANK: Record<GpuGrade, number> = { A: 4, B: 3, C: 2, D: 1 };
export const CONFERENCE_HOURS = 20;

export function getLab(pack: ContentPack, id: string | null): Lab | null {
  if (!id) return null;
  return pack.labs.find((l) => l.id === id) ?? null;
}

/** 플래너 상담 종류 (없는 id면 첫 번째) */
export function counselingOption(pack: ContentPack, id: string | undefined): CounselingOption {
  return pack.counseling.find((c) => c.id === id) ?? pack.counseling[0]!;
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
  project: number; // 계획 반영(비율 적용)
  chores: number; // 계획 반영(비율 적용)
  projectBase: number; // 연구실 기준 과제 시간
  choresBase: number;
  extra: { name: string; hours: number }[]; // 조교·외주 등 플래그 시간
}

/** 저장된 계획에 새 필드가 없을 수 있으므로 기본값 보정 + 범위 제한 */
export function normalizePlan(pack: ContentPack, plan: WeeklyPlan): WeeklyPlan {
  const b = pack.balance;
  const p = { ...PLAN_DEFAULTS, ...plan } as WeeklyPlan;
  return {
    ...p,
    living: clamp(Math.round(p.living), b.livingMin, b.livingMax),
    projectRatio: clamp(p.projectRatio, b.projectRatioMin, b.projectRatioMax),
    choreRatio: clamp(p.choreRatio, 0, 1),
    split: clamp(p.split, 0.2, 0.8),
    food: clamp(Math.round(p.food ?? 1), 0, 2),
    counselingId: counselingOption(pack, p.counselingId).id,
    activities: [...new Set((p.activities ?? []).filter((id) => pack.activities.some((a) => a.id === id)))],
  };
}

export function forcedHours(pack: ContentPack, state: GameState, plan?: WeeklyPlan): ForcedHours {
  const b = pack.balance;
  const lab = getLab(pack, state.labId);
  const p = normalizePlan(pack, plan ?? ({ ...PLAN_DEFAULTS } as unknown as WeeklyPlan));
  const projectBase = lab ? lab.projectLoad * b.projectHoursPerStar : 0;
  const choresBase = lab ? lab.chores * b.baseChoreHoursPerStar : 0;
  return {
    living: plan ? p.living : b.livingHoursPerWeek,
    class: inSemester(state.week) && state.credits < b.requiredCredits ? b.classHoursPerWeek : 0,
    project: Math.round(projectBase * (plan ? p.projectRatio : 1)),
    chores: Math.round(choresBase * (plan ? p.choreRatio : 1)),
    projectBase,
    choresBase,
    extra: flagHours(pack, state),
  };
}

export function canDualTask(pack: ContentPack, state: GameState): boolean {
  return state.stats.research >= pack.balance.dualTaskResearch;
}

export interface PlanCheck {
  ok: boolean;
  forced: ForcedHours;
  sleepHours: number;
  extraHours: number; // 상담·학회
  activityHours: number; // 이번 주 활동
  activityCost: number;
  foodCost: number;
  freeHours: number; // 연구/공부/휴식에 배분 가능한 시간
  allocated: number;
  errors: string[];
}

export function checkPlan(pack: ContentPack, state: GameState, rawPlan: WeeklyPlan): PlanCheck {
  const plan = normalizePlan(pack, rawPlan);
  const forced = forcedHours(pack, state, plan);
  const sleepHours = Math.round(plan.sleepPerDay * 7);
  const flagH = forced.extra.reduce((a, x) => a + x.hours, 0);
  const extraHours = flagH + (plan.counseling ? counselingOption(pack, plan.counselingId).hours : 0) + (plan.attendConferenceId ? CONFERENCE_HOURS : 0);
  const acts = plan.activities.map((id) => pack.activities.find((a) => a.id === id)!);
  const activityHours = acts.reduce((a, x) => a + x.hours, 0);
  const activityCost = acts.reduce((a, x) => a + x.cost, 0);
  const foodCost = pack.balance.foodLevels[plan.food]!.cost;
  const fixed = forced.living + forced.class + forced.project + forced.chores + sleepHours + extraHours + activityHours;
  const freeHours = 168 - fixed;
  const allocated = plan.research + plan.study + plan.rest;
  const errors: string[] = [];
  for (const a of acts) {
    const st = activityStatus(pack, state, a);
    if (!st.ok) errors.push(`${a.name}: ${st.reason}`);
  }
  if (activityCost > 0 && activityCost > state.stats.money) errors.push(`활동 비용 ${activityCost.toLocaleString()}원이 잔고보다 많습니다.`);
  if (plan.sleepPerDay < 4 || plan.sleepPerDay > 10) errors.push('수면은 하루 4~10시간 사이로 설정하세요.');
  if ([plan.research, plan.study, plan.rest].some((v) => v < 0 || !Number.isFinite(v))) errors.push('시간은 0 이상이어야 합니다.');
  if (allocated > freeHours) errors.push(`배분 가능한 시간(${freeHours}h)을 ${allocated - freeHours}h 초과했습니다.`);
  return { ok: errors.length === 0, forced, sleepHours, extraHours, activityHours, activityCost, foodCost, freeHours, allocated, errors };
}

/** 체력·스트레스·수면 부채에 따른 시간당 효율 */
export function efficiency(pack: ContentPack, state: GameState): number {
  const s = state.stats;
  let eff = (0.5 + (0.5 * s.stamina) / 100) * flagEfficiency(pack, state);
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
